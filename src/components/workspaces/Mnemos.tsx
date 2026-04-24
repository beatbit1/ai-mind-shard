import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useServerFn } from "@tanstack/react-start";
import {
  RecallTrace,
  type TraceLine,
  type TraceStats,
  ts,
} from "./RecallTrace";
import { chat0g, commitMemory, recallMemories, zgStatus } from "@/server/zg.functions";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  rootHash?: string;
  txHash?: string;
};

const SEEDS = [
  "Explain ERC-4337 account abstraction step by step",
  "Audit a Solidity withdraw() for reentrancy and write a fix",
  "How do I index Uniswap v4 hook events efficiently?",
  "Compare CREATE vs CREATE2 gas + address derivation",
];

const RECALL_SEEDS = [
  "What were we working on last session?",
  "Continue where we left off",
  "Summarize what I asked you before",
];

const STORE_PREFIX = "tonara.mnemos.v2.";
const ROOTS_PREFIX = "tonara.mnemos.roots.";
const SESSION_PREFIX = "tonara.mnemos.session.";

export function Mnemos() {
  const { isConnected, address } = useAccount();
  const wallet = address ?? "guest";
  const storeKey = useMemo(() => STORE_PREFIX + wallet, [wallet]);
  const rootsKey = useMemo(() => ROOTS_PREFIX + wallet, [wallet]);
  const sessionKey = useMemo(() => SESSION_PREFIX + wallet, [wallet]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [returned, setReturned] = useState(false);
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [stats, setStats] = useState<TraceStats>({});
  const [zgError, setZgError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatFn = useServerFn(chat0g);
  const commitFn = useServerFn(commitMemory);
  const recallFn = useServerFn(recallMemories);
  const statusFn = useServerFn(zgStatus);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, working]);

  // Probe 0G status once on mount / wallet change
  useEffect(() => {
    if (!isConnected) return;
    statusFn({})
      .then((r) => {
        if (!r.ok) setZgError(r.error.message);
        else {
          setZgError(null);
          setStats((s) => ({ ...s, cost: `${r.ledgerOG.toFixed(5)} OG` }));
        }
      })
      .catch((e) => setZgError(String(e)));
  }, [isConnected, statusFn]);

  function pushTrace(level: TraceLine["level"], msg: string) {
    setTrace((t) => [...t, { t: ts(), level, msg }]);
  }

  function getRoots(): string[] {
    try {
      return JSON.parse(localStorage.getItem(rootsKey) ?? "[]");
    } catch {
      return [];
    }
  }
  function appendRoot(root: string) {
    const list = getRoots();
    list.push(root);
    localStorage.setItem(rootsKey, JSON.stringify(list.slice(-100)));
  }
  function getSessionId(): string {
    let s = localStorage.getItem(sessionKey);
    if (!s) {
      s = crypto.randomUUID();
      localStorage.setItem(sessionKey, s);
    }
    return s;
  }

  function loadLocal(): Msg[] {
    try {
      return JSON.parse(localStorage.getItem(storeKey) ?? "[]");
    } catch {
      return [];
    }
  }
  function saveLocal(msgs: Msg[]) {
    try {
      localStorage.setItem(storeKey, JSON.stringify(msgs.slice(-40)));
    } catch {
      /* ignore */
    }
  }

  async function send(text: string) {
    if (!isConnected || !text.trim() || working) return;
    const trimmed = text.trim();
    setInput("");
    setWorking(true);
    setTrace([]);

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: trimmed };
    let next = [...messages, userMsg];
    setMessages(next);

    // 1) Commit user message to 0G Storage
    pushTrace("info", `encrypting · AES-256-GCM · ${new TextEncoder().encode(trimmed).length}B`);
    pushTrace("info", "uploading to 0G Storage · indexer.upload(zgFile)");
    const commitUser = await commitFn({
      data: { wallet, role: "user", text: trimmed, sessionId: getSessionId() },
    });

    if (commitUser.ok) {
      appendRoot(commitUser.rootHash);
      userMsg.rootHash = commitUser.rootHash;
      userMsg.txHash = commitUser.txHash;
      pushTrace("ok", `committed · root ${short(commitUser.rootHash)} · ${commitUser.latencyMs}ms`);
      setStats({
        latency: `${commitUser.latencyMs} ms`,
        shards: "1",
        cost: `${commitUser.sizeBytes}B`,
        memoryId: short(commitUser.rootHash),
      });
    } else {
      pushTrace("err", `storage · ${commitUser.error.message}`);
      setZgError(commitUser.error.message);
    }

    // 2) If returning session and vague, recall first
    let recalled: Array<{ role: "user" | "assistant"; text: string }> = [];
    const isVague =
      returned && (trimmed.length < 50 || /last|remember|earlier|before|continue|recap|summari/i.test(trimmed));
    if (isVague) {
      const roots = getRoots();
      if (roots.length > 0) {
        pushTrace("info", `recalling ${Math.min(roots.length, 20)} memories from 0G`);
        const r = await recallFn({ data: { rootHashes: roots } });
        if (r.ok) {
          recalled = r.memories.map((m) => ({ role: m.role, text: m.text }));
          pushTrace("ok", `reassembled ${r.memories.length} shards · ${r.latencyMs}ms`);
        } else {
          pushTrace("err", `recall · ${r.error.message}`);
        }
      }
    }

    // 3) Inference via 0G Compute
    pushTrace("info", "discovering inference provider · 0G Compute");
    const history = next.slice(-10).map((m) => ({ role: m.role, content: m.text }));
    const ctx = recalled.length > 0
      ? [{ role: "system" as const, content: `Recalled prior memories from 0G Storage:\n${recalled.map((m) => `[${m.role}] ${m.text}`).join("\n")}` }]
      : [];
    const chat = await chatFn({ data: { messages: [...ctx, ...history] } });

    let replyText = "";
    if (chat.ok) {
      replyText = chat.reply;
      pushTrace(
        "ok",
        `inference · ${chat.model} · ${chat.latencyMs}ms · provider ${short(chat.provider)}${chat.verified ? " · ✓verified" : ""}`,
      );
      setStats((s) => ({ ...s, cost: `${chat.ledgerOG.toFixed(5)} OG ledger` }));
    } else {
      replyText =
        chat.error.kind === "not_configured"
          ? `⚠️ 0G not configured yet: ${chat.error.message}\n\nAdd ZG_PRIVATE_KEY and ZG_MEMORY_ENC_KEY in Cloud secrets to enable real inference.`
          : chat.error.kind === "unfunded"
            ? `⚠️ Wallet unfunded. Send testnet OG to ${chat.error.address ?? "your 0G wallet"} from https://faucet.0g.ai`
            : `⚠️ Inference failed: ${chat.error.message}`;
      pushTrace("err", `inference · ${chat.error.message}`);
      setZgError(chat.error.message);
    }

    const assistantMsg: Msg = { id: crypto.randomUUID(), role: "assistant", text: replyText };
    next = [...next, assistantMsg];
    setMessages(next);

    // 4) Commit assistant reply
    if (chat.ok) {
      pushTrace("info", "encrypting reply · uploading");
      const commitA = await commitFn({
        data: { wallet, role: "assistant", text: replyText, sessionId: getSessionId() },
      });
      if (commitA.ok) {
        appendRoot(commitA.rootHash);
        assistantMsg.rootHash = commitA.rootHash;
        assistantMsg.txHash = commitA.txHash;
        pushTrace("ok", `committed · root ${short(commitA.rootHash)}`);
      } else {
        pushTrace("warn", `reply not persisted · ${commitA.error.message}`);
      }
    }

    saveLocal(next);
    setWorking(false);
  }

  function simulateReturn() {
    saveLocal(messages);
    setMessages([]);
    setTrace([]);
    setStats({});
    setReturned(true);
    // New session id so the next exchange is treated as a fresh session
    localStorage.setItem(sessionKey, crypto.randomUUID());
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-4 lg:grid-cols-[3fr_2fr]">
      <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-1">
        <div className="flex h-full flex-col rounded-xl bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Coding & blockchain research · 0G Compute
              </div>
              <h2 className="mt-0.5 font-display text-lg font-semibold">Mnemos</h2>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="font-display text-xl text-foreground">
                  {returned ? "Welcome back." : "Your decentralized coding companion."}
                </div>
                <p className="max-w-md text-sm text-muted-foreground">
                  {returned
                    ? "Ask anything — Mnemos will recall encrypted memories from 0G Storage."
                    : "Solidity, EVM, ERC-4337, indexing, audits. Every exchange is encrypted and persisted to decentralized memory; inference runs on the 0G network."}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {(returned ? RECALL_SEEDS : SEEDS).map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={!isConnected}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-foreground text-background"
                      : "border border-border bg-surface text-foreground"
                  }`}
                >
                  <div>{m.text}</div>
                  {m.rootHash && (
                    <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] opacity-60">
                      <LockGlyph /> 0G root {short(m.rootHash)}
                      {m.txHash && (
                        <a
                          href={`https://chainscan-galileo.0g.ai/tx/${m.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          tx {short(m.txHash)}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {working && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-border bg-surface px-4 py-2.5">
                  <Dots />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-4">
            {!isConnected ? (
              <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm text-muted-foreground">
                Connect wallet to start a session
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Mnemos about Solidity, EVM, audits, indexing…"
                  className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
                />
                <button
                  type="submit"
                  disabled={working || !input.trim()}
                  className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <RecallTrace lines={trace} stats={stats} title="0G runtime" subtitle="Decentralized inference & memory" />
    </div>
  );
}

function short(s: string) {
  if (!s) return "";
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}

function LockGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function Dots() {
  return (
    <div className="flex gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </div>
  );
}
