import { NextResponse } from "next/server";
import { LIMITS, OPENAI_MODELS } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";
import { getClientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { allowed, retryAfterSeconds } = rateLimit(
    `transcribe:${getClientKey(request)}`,
    LIMITS.transcribe.limit,
    LIMITS.transcribe.windowMs,
  );

  if (!allowed) {
    return NextResponse.json(
      { error: "Moc rychle. Dej tomu chvíli a zkus to znovu." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Audio je povinné." }, { status: 400 });
    }

    if (audio.size > LIMITS.maxAudioBytes) {
      return NextResponse.json(
        { error: "Nahrávka je moc velká." },
        { status: 413 },
      );
    }

    const openai = getOpenAIClient();

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: OPENAI_MODELS.transcription,
      language: "cs",
      prompt: "Krátká věta o nákupu nebo výdaji v češtině.",
    });

    const text = transcription.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "Nepodařilo se rozpoznat řeč. Zkus to napsat." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("[/api/transcribe]", error);

    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return NextResponse.json(
        { error: "Služba není nakonfigurovaná. Chybí API klíč." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Hlas se nepodařilo zpracovat. Zkus to znovu." },
      { status: 500 },
    );
  }
}
