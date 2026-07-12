"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  CheckCircle2,
  History,
  Mic,
  Send,
  ShieldCheck,
} from "lucide-react";
import type { ProcessedExpense, TradeRecord } from "@/lib/types";

const INITIAL_BUDGET = 18_420;
const MAX_HISTORY = 3;

const INITIAL_TRADES: TradeRecord[] = [
  {
    id: 1,
    text: "CrossFit členství",
    amount: 1500,
    intent: "Investice do sebe",
    time: "Včera",
  },
  {
    id: 2,
    text: "Večeře s rodinou",
    amount: 1240,
    intent: "Rodina & Vztahy",
    time: "Před 2 dny",
  },
];

function formatRemaining(amount: number): string {
  return amount.toLocaleString("cs-CZ");
}

function buildStatusMessage(remaining: number, expense?: ProcessedExpense): string {
  if (!expense) {
    return `Tento měsíc jsi v naprostém klidu. Zbývá ti ještě ${formatRemaining(remaining)} Kč.`;
  }

  const intentMessages: Record<ProcessedExpense["intent"], string> = {
    "Nezbytné závazky": "Závazek zaznamenán. Jsi v pořádku.",
    "Radost & Život": "Malá radost zaznamenána. Rozpočet to zvládne.",
    "Investice do sebe": "Investice do sebe uložena. Dobrá volba.",
    "Rodina & Vztahy": "Udělal jsi radost blízkým. Rozpočet to zvládne.",
  };

  return `${intentMessages[expense.intent]} Tvůj vědomý zůstatek je teď ${formatRemaining(remaining)} Kč.`;
}

async function processExpenseText(text: string): Promise<ProcessedExpense> {
  const response = await fetch("/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const data = (await response.json()) as ProcessedExpense & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Nepodařilo se zpracovat výdaj.");
  }

  return data;
}

async function transcribeAudio(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as { text?: string; error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Nepodařilo se přepsat hlas.");
  }

  if (!data.text) {
    throw new Error("Nepodařilo se rozpoznat řeč. Zkus to napsat.");
  }

  return data.text;
}

export default function CalmSpendPage() {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [remainingBudget, setRemainingBudget] = useState(INITIAL_BUDGET);
  const [statusMessage, setStatusMessage] = useState(() =>
    buildStatusMessage(INITIAL_BUDGET),
  );
  const [recentTrades, setRecentTrades] = useState<TradeRecord[]>(INITIAL_TRADES);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastAdded, setLastAdded] = useState<ProcessedExpense | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);

  const cleanupStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const applyExpense = useCallback((result: ProcessedExpense) => {
    const nextRemaining = remainingBudget - result.amount;

    setRemainingBudget(nextRemaining);
    setLastAdded(result);
    setShowSuccess(true);
    setStatusMessage(buildStatusMessage(nextRemaining, result));

    setRecentTrades((prev) =>
      [
        {
          id: Date.now(),
          text: result.item,
          amount: result.amount,
          intent: result.intent,
          time: "Teď",
        },
        ...prev,
      ].slice(0, MAX_HISTORY),
    );

    window.setTimeout(() => setShowSuccess(false), 4000);
  }, [remainingBudget]);

  const runProcess = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setErrorMessage(null);

      try {
        const result = await processExpenseText(trimmed);
        applyExpense(result);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Něco se pokazilo. Zkus to znovu.",
        );
      }
    },
    [applyExpense],
  );

  const handleProcess = useCallback(
    async (text: string) => {
      if (isProcessingRef.current) return;

      isProcessingRef.current = true;
      setIsProcessing(true);

      try {
        await runProcess(text);
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    },
    [runProcess],
  );

  const stopRecording = useCallback(async () => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) return;

    isRecordingRef.current = false;
    setIsRecording(false);

    const recorder = mediaRecorderRef.current;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      if (recorder.state !== "inactive") {
        recorder.stop();
      } else {
        resolve();
      }
    });

    cleanupStream();

    const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
    audioChunksRef.current = [];

    if (blob.size === 0) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const text = await transcribeAudio(blob);
      await runProcess(text);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Hlas se nepodařilo zpracovat.",
      );
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, [cleanupStream, runProcess]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isProcessingRef.current) return;

    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start();
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch {
      setErrorMessage("Mikrofon není dostupný. Použij textové pole.");
      cleanupStream();
    }
  }, [cleanupStream]);

  const handleSubmitText = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    void handleProcess(input);
    setInput("");
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#2C2A29] flex flex-col justify-between p-6 font-sans antialiased">
      <header className="flex justify-between items-center max-w-md w-full mx-auto pt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs tracking-widest uppercase font-medium text-neutral-400">
            Klid / $10 měsíčně
          </span>
        </div>
        <ShieldCheck className="w-5 h-5 text-neutral-300" />
      </header>

      <main className="max-w-md w-full mx-auto flex flex-col items-center justify-center flex-1 my-auto space-y-12">
        <div className="text-center px-4 space-y-2">
          <p className="text-xl md:text-2xl font-normal leading-relaxed text-neutral-800 transition-all duration-500">
            &ldquo;{statusMessage}&rdquo;
          </p>
        </div>

        <div className="w-full flex flex-col items-center space-y-8">
          <div className="h-8 flex items-center justify-center">
            {showSuccess && lastAdded && (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-medium border border-emerald-100 transition-all animate-bounce">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>
                  AI rozpoznalo: {lastAdded.amount} {lastAdded.currency} jako &ldquo;
                  {lastAdded.intent}&rdquo;
                </span>
              </div>
            )}
            {!showSuccess && isProcessing && (
              <p className="text-xs text-neutral-400">Přemýšlím...</p>
            )}
            {!showSuccess && !isProcessing && errorMessage && (
              <p className="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                {errorMessage}
              </p>
            )}
          </div>

          <button
            type="button"
            aria-label={isRecording ? "Nahrávám hlas" : "Podrž a řekni, co jsi koupil"}
            disabled={isProcessing}
            onPointerDown={(event) => {
              event.preventDefault();
              void startRecording();
            }}
            onPointerUp={() => void stopRecording()}
            onPointerLeave={() => {
              if (isRecordingRef.current) {
                void stopRecording();
              }
            }}
            onPointerCancel={() => {
              if (isRecordingRef.current) {
                void stopRecording();
              }
            }}
            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed touch-none ${
              isRecording
                ? "bg-red-500 text-white shadow-lg shadow-red-200 scale-105"
                : "bg-neutral-900 text-white shadow-xl shadow-neutral-200 hover:bg-neutral-800"
            }`}
          >
            {isRecording ? (
              <div className="flex space-x-1 items-center">
                <span className="w-1.5 h-6 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-8 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-6 bg-white rounded-full animate-bounce" />
              </div>
            ) : (
              <Mic className="w-10 h-10 stroke-[1.5]" />
            )}
          </button>

          <p className="text-xs text-neutral-400 font-normal">
            {isRecording
              ? "Naslouchám tvému hlasu..."
              : isProcessing
                ? "Zpracovávám..."
                : "Podrž a řekni, co jsi koupil"}
          </p>

          <form onSubmit={handleSubmitText} className="w-full max-w-xs relative mt-4">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nebo to sem prostě napiš..."
              disabled={isProcessing}
              className="w-full bg-neutral-100 border-none rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-200 text-neutral-700 placeholder-neutral-400 transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isProcessing || !input.trim()}
              className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      <footer className="max-w-md w-full mx-auto bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm mt-auto">
        <div className="flex items-center gap-2 mb-3 text-neutral-400">
          <History className="w-3.5 h-3.5" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Poslední vědomé výdaje
          </span>
        </div>
        <div className="space-y-2.5">
          {recentTrades.map((trade) => (
            <div
              key={trade.id}
              className="flex justify-between items-center text-sm py-1 border-b border-neutral-50 last:border-0"
            >
              <div>
                <p className="font-medium text-neutral-800 capitalize">{trade.text}</p>
                <span className="text-[11px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-normal">
                  {trade.intent}
                </span>
              </div>
              <div className="text-right">
                <p className="font-semibold text-neutral-900">-{trade.amount} Kč</p>
                <p className="text-[10px] text-neutral-400">{trade.time}</p>
              </div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
