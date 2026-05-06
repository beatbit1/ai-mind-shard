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
import { anchorMemoryOnMainnet } from "@/server/zg.mainnet.functions";
import { appendMemoryRecord, getMemoryRoots } from "@/lib/memoryRecords";
import { appendAgentAction } from "@/lib/agentActions";
import { mainnetTxUrl } from "@/contracts/addresses";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  rootHash?: string;
  txHash?: string;
  mainnetTxHash?: string;
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
const SESSION_PREFIX = "tonara.mnemos.session.";

export function Mnemos() {
  const { isConnected, address } = useAccount();
  const wallet = address ?? "guest";
  const storeKey = useMemo(() => STORE_PREFIX + wallet, [wallet]);
  const sessionKey = useMemo(() => SESSION_PREFIX + wallet, [wallet]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [returned] = useState(false);
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [stats, setStats] = useState<TraceStats>({});
  const [, setZgError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatFn = useServerFn(chat0g);
  const commitFn = useServerFn(commitMemory);
  const recallFn = useServerFn(recallMemories);
  const statusFn = useServerFn(zgStatus);
  const anchorFn = useServerFn(anchorMemoryOnMainnet);

  useEffect(() => {
    setMessages(loadLocal());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);

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
    const sessionId = getSessionId();

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: trimmed };
    let next = [...messages, userMsg];
    setMessages(next);

    // 1) Commit user message to 0G Storage
    pushTrace("info", `encrypting · AES-256-GCM · ${new TextEncoder().encode(trimmed).length}B`);
    pushTrace("info", "uploading to 0G Storage · indexer.upload(zgFile)");
    const commitUser = await commitFn({
      data: { wallet, role: "user", text: trimmed, sessionId },
    });

    if (commitUser.ok) {
      appendMemoryRecord(wallet, {
        rootHash: commitUser.rootHash,
        txHash: commitUser.txHash,
        role: "user",
        sessionId,
        ts: Date.now(),
        sizeBytes: commitUser.sizeBytes,
        source: "mnemos",
      });
      appendAgentAction(wallet, {
        kind: "commit",
        source: "mnemos",
        label: `encrypted user message → 0G Storage (${commitUser.sizeBytes}B)`,
        latencyMs: commitUser.latencyMs,
        txHash: commitUser.txHash,
        rootHash: commitUser.rootHash,
        ok: true,
      });
      userMsg.rootHash = commitUser.rootHash;
      userMsg.txHash = commitUser.txHash;
      setMessages([...next]);
      pushTrace("ok", `committed · root ${short(commitUser.rootHash)} · tx ${short(commitUser.txHash)} · ${commitUser.latencyMs}ms`);
      setStats({
        latency: `${commitUser.latencyMs} ms`,
        shards: "1",
        cost: `${commitUser.sizeBytes}B`,
        memoryId: short(commitUser.rootHash),
      });

      // Anchor on 0G Aristotle Mainnet (best-effort; requires user to have called setDelegate once)
      if (isConnected && address) {
        pushTrace("info", "anchoring on 0G Mainnet · MemoryRegistry.commitFor");
        try {
          const anchor: any = await anchorFn({
            data: {
              owner: address,
              rootHash: commitUser.rootHash,
              sizeBytes: commitUser.sizeBytes,
              role: "user",
              sessionId,
            },
          });
          if (anchor.ok) {
            userMsg.mainnetTxHash = anchor.txHash;
            appendMemoryRecord(wallet, {
              rootHash: commitUser.rootHash,
              txHash: commitUser.txHash,
              role: "user",
              sessionId,
              ts: Date.now(),
              sizeBytes: commitUser.sizeBytes,
              source: "mnemos",
              mainnetTxHash: anchor.txHash,
              mainnetIndex: anchor.index,
            });
            setMessages([...next]);
            pushTrace("ok", `mainnet anchored · idx #${anchor.index} · ${short(anchor.txHash)}`);
            appendAgentAction(wallet, {
              kind: "cross-chain",
              source: "mnemos",
              label: `MemoryRegistry.commitFor → 0G Aristotle Mainnet · idx ${anchor.index}`,
              txHash: anchor.txHash,
              rootHash: commitUser.rootHash,
              ok: true,
            });
          } else {
            pushTrace("warn", `mainnet · ${anchor.error}`);
          }
        } catch (e) {
          pushTrace("warn", `mainnet anchor failed · ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } else {
      pushTrace("err", `storage · ${commitUser.error.message}`);
      setZgError(commitUser.error.message);
      appendAgentAction(wallet, {
        kind: "commit",
        source: "mnemos",
        label: `storage upload failed`,
        latencyMs: commitUser.latencyMs,
        ok: false,
        error: commitUser.error.message,
      });
    }

    // 2) If returning session and vague, recall first
    let recalled: Array<{ role: "user" | "assistant"; text: string }> = [];
    const isVague =
      returned && (trimmed.length < 50 || /last|remember|earlier|before|continue|recap|summari/i.test(trimmed));
    if (isVague) {
        const roots = getMemoryRoots(wallet);
      if (roots.length > 0) {
        pushTrace("info", `recalling ${Math.min(roots.length, 20)} memories from 0G`);
        const r = await recallFn({ data: { rootHashes: roots } });
        if (r.ok) {
          recalled = r.memories.map((m) => ({ role: m.role, text: m.text }));
          pushTrace("ok", `reassembled ${r.memories.length} shards · ${r.latencyMs}ms`);
          appendAgentAction(wallet, {
            kind: "reassembly",
            source: "mnemos",
            label: `reassembled ${r.memories.length} shards from 0G Storage`,
            latencyMs: r.latencyMs,
            ok: true,
          });
        } else {
          pushTrace("err", `recall · ${r.error.message}`);
          appendAgentAction(wallet, {
            kind: "reassembly", source: "mnemos",
            label: "shard reassembly failed", ok: false, error: r.error.message,
          });
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
      appendAgentAction(wallet, {
        kind: "inference",
        source: "mnemos",
        label: `${chat.model}${chat.verified ? " · ✓verified" : ""}`,
        latencyMs: chat.latencyMs,
        provider: chat.provider,
        model: chat.model,
        ok: true,
      });
    } else {
      replyText =
        chat.error.kind === "not_configured"
          ? `⚠️ 0G not configured yet: ${chat.error.message}\n\nAdd ZG_PRIVATE_KEY and ZG_MEMORY_ENC_KEY in Cloud secrets to enable real inference.`
          : chat.error.kind === "unfunded"
            ? `⚠️ Wallet unfunded. Send testnet OG to ${chat.error.address ?? "your 0G wallet"} from https://faucet.0g.ai`
            : `⚠️ Inference failed: ${chat.error.message}`;
      pushTrace("err", `inference · ${chat.error.message}`);
      setZgError(chat.error.message);
      appendAgentAction(wallet, {
        kind: "inference", source: "mnemos",
        label: "inference failed", ok: false, error: chat.error.message,
      });
    }

    const assistantMsg: Msg = { id: crypto.randomUUID(), role: "assistant", text: replyText };
    next = [...next, assistantMsg];
    setMessages(next);

    // 4) Commit assistant reply
    if (chat.ok) {
      pushTrace("info", "encrypting reply · uploading");
      const commitA = await commitFn({
        data: { wallet, role: "assistant", text: replyText, sessionId },
      });
      if (commitA.ok) {
        appendMemoryRecord(wallet, {
          rootHash: commitA.rootHash,
          txHash: commitA.txHash,
          role: "assistant",
          sessionId,
          ts: Date.now(),
          sizeBytes: commitA.sizeBytes,
          source: "mnemos",
        });
        appendAgentAction(wallet, {
          kind: "commit", source: "mnemos",
          label: `encrypted assistant reply → 0G Storage (${commitA.sizeBytes}B)`,
          latencyMs: commitA.latencyMs, txHash: commitA.txHash, rootHash: commitA.rootHash,
          ok: true,
        });
        assistantMsg.rootHash = commitA.rootHash;
        assistantMsg.txHash = commitA.txHash;
        setMessages([...next]);
        pushTrace("ok", `committed · root ${short(commitA.rootHash)} · tx ${short(commitA.txHash)}`);

        // Anchor assistant reply on mainnet too
        if (isConnected && address) {
          try {
            const anchor: any = await anchorFn({
              data: {
                owner: address,
                rootHash: commitA.rootHash,
                sizeBytes: commitA.sizeBytes,
                role: "assistant",
                sessionId,
              },
            });
            if (anchor.ok) {
              assistantMsg.mainnetTxHash = anchor.txHash;
              appendMemoryRecord(wallet, {
                rootHash: commitA.rootHash,
                txHash: commitA.txHash,
                role: "assistant",
                sessionId,
                ts: Date.now(),
                sizeBytes: commitA.sizeBytes,
                source: "mnemos",
                mainnetTxHash: anchor.txHash,
                mainnetIndex: anchor.index,
              });
              setMessages([...next]);
              pushTrace("ok", `mainnet anchored · idx #${anchor.index}`);
              appendAgentAction(wallet, {
                kind: "cross-chain",
                source: "mnemos",
                label: `MemoryRegistry.commitFor (assistant) → mainnet · idx ${anchor.index}`,
                txHash: anchor.txHash,
                rootHash: commitA.rootHash,
                ok: true,
              });
            } else {
              pushTrace("warn", `mainnet · ${anchor.error}`);
            }
          } catch (e) {
            pushTrace("warn", `mainnet anchor failed · ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      } else {
        pushTrace("warn", `reply not persisted · ${commitA.error.message}`);
        appendAgentAction(wallet, {
          kind: "commit", source: "mnemos", label: "reply persist failed",
          ok: false, error: commitA.error.message,
        });
      }
    }

    saveLocal(next);
    setWorking(false);
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
                      {m.mainnetTxHash && (
                        <a
                          href={mainnetTxUrl(m.mainnetTxHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1 rounded-sm border border-current px-1 underline"
                          title="Anchored on 0G Aristotle Mainnet"
                        >
                          ⛓ mainnet
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
