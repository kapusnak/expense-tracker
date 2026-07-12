import type { ProcessedExpense, TradeRecord } from "./types";

export interface CalmState {
  remainingBudget: number;
  recentTrades: TradeRecord[];
}

const STORAGE_KEY = "calm-spend-state-v1";
const MAX_HISTORY = 3;

export const DEFAULT_STATE: CalmState = {
  remainingBudget: 18_420,
  recentTrades: [
    {
      id: 1,
      text: "CrossFit členství",
      amount: 1500,
      currency: "Kč",
      intent: "Investice do sebe",
      time: "Včera",
    },
    {
      id: 2,
      text: "Večeře s rodinou",
      amount: 1240,
      currency: "Kč",
      intent: "Rodina & Vztahy",
      time: "Před 2 dny",
    },
  ],
};

let memoryState: CalmState = DEFAULT_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<CalmState>;
    memoryState = {
      remainingBudget:
        typeof parsed.remainingBudget === "number"
          ? parsed.remainingBudget
          : DEFAULT_STATE.remainingBudget,
      recentTrades: Array.isArray(parsed.recentTrades)
        ? parsed.recentTrades.slice(0, MAX_HISTORY)
        : DEFAULT_STATE.recentTrades,
    };
  } catch {
    // Corrupted or unavailable storage: keep defaults.
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
  } catch {
    // Storage may be unavailable (private mode); ignore.
  }
}

export function subscribe(listener: () => void): () => void {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): CalmState {
  ensureLoaded();
  return memoryState;
}

export function getServerSnapshot(): CalmState {
  return DEFAULT_STATE;
}

export function addExpense(expense: ProcessedExpense): void {
  ensureLoaded();

  const trade: TradeRecord = {
    id: Date.now(),
    text: expense.item,
    amount: expense.amount,
    currency: expense.currency,
    intent: expense.intent,
    time: "Teď",
  };

  memoryState = {
    remainingBudget: memoryState.remainingBudget - expense.amount,
    recentTrades: [trade, ...memoryState.recentTrades].slice(0, MAX_HISTORY),
  };

  persist();
  listeners.forEach((listener) => listener());
}
