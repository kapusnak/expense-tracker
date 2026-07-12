export const OPENAI_MODELS = {
  extraction: process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-5.6-luna",
  transcription: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe",
} as const;

export const EXPENSE_INTENTS = [
  "Nezbytné závazky",
  "Radost & Život",
  "Investice do sebe",
  "Rodina & Vztahy",
] as const;

export type ExpenseIntent = (typeof EXPENSE_INTENTS)[number];
