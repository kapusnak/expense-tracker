import { NextResponse } from "next/server";
import { EXPENSE_INTENTS, OPENAI_MODELS } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";
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
  try {
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
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
    const message =
      error instanceof Error ? error.message : "Failed to process expense.";

    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
