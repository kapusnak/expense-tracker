import { NextResponse } from "next/server";
import { OPENAI_MODELS } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
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
        { error: "Could not transcribe audio. Try again or type it." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to transcribe audio.";

    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
