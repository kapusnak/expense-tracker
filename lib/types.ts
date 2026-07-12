import type { ExpenseIntent } from "./config";

export interface ProcessedExpense {
  item: string;
  amount: number;
  currency: string;
  intent: ExpenseIntent;
}

export interface TradeRecord {
  id: number;
  text: string;
  amount: number;
  currency: string;
  intent: ExpenseIntent;
  time: string;
}
