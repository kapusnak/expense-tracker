import { NextResponse } from "next/server";
import { EXPENSE_INTENTS, LIMITS, OPENAI_MODELS } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import type { ProcessedExpense } from "@/lib/types";

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    amount: {
      type: "number",
      description: "Total amount spent. Sum all amounts if multiple items are mentioned.",
    },
    currency: {
      type: "string",
      description: "Currency code or symbol, default Kč for Czech inputs.",
    },
    items: {
      type: "string",
      description: "Short human-readable description of purchased items.",
    },
    intent: {
      type: "string",
      enum: EXPENSE_INTENTS,
      description: "One of four mindful spending categories.",
    },
  },
  required: ["amount", "currency", "items", "intent"],
} as const;

const SYSTEM_PROMPT = `You extract expense data from Czech natural language input.
Return JSON with:
- amount: total spent (sum if multiple items)
- currency: default "Kč" unless another currency is clearly stated
- items: short human description of what was bought
- intent: exactly one of these categories:
  • "Nezbytné závazky" — rent, bills, utilities, mandatory payments
  • "Radost & Život" — coffee, hobbies, everyday pleasures
  • "Investice do sebe" — fitness, courses, books, personal growth
  • "Rodina & Vztahy" — family dinners, gifts, kids, partner

Be concise. If amount is unclear, make a reasonable estimate and keep items descriptive.`;

export async function POST(request: Request) {
  const { allowed, retryAfterSeconds } = rateLimit(
    `process:${getClientKey(request)}`,
    LIMITS.process.limit,
    LIMITS.process.windowMs,
  );

  if (!allowed) {
    return NextResponse.json(
      { error: "Moc rychle. Dej tomu chvíli a zkus to znovu." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  try {
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "Text je povinný." }, { status: 400 });
    }

    if (text.length > LIMITS.maxInputChars) {
      return NextResponse.json(
        { error: `Text je moc dlouhý (max ${LIMITS.maxInputChars} znaků).` },
        { status: 413 },
      );
    }

    const openai = getOpenAIClient();

    const response = await openai.responses.create({
      model: OPENAI_MODELS.extraction,
      reasoning: { effort: "minimal" },
      instructions: SYSTEM_PROMPT,
      input: text,
      text: {
        format: {
          type: "json_schema",
          name: "expense_extraction",
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
        verbosity: "low",
      },
    });

    const parsed = JSON.parse(response.output_text) as {
      amount: number;
      currency: string;
      items: string;
      intent: ProcessedExpense["intent"];
    };

    const result: ProcessedExpense = {
      item: parsed.items,
      amount: parsed.amount,
      currency: parsed.currency || "Kč",
      intent: parsed.intent,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/process]", error);

    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return NextResponse.json(
        { error: "Služba není nakonfigurovaná. Chybí API klíč." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Výdaj se nepodařilo zpracovat. Zkus to znovu." },
      { status: 500 },
    );
  }
}
