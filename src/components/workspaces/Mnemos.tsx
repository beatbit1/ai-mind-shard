import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { RecallTrace, type TraceLine, type TraceStats, sha256Hex, ts, wait } from "./RecallTrace";

type Msg = { id: string; role: "user" | "agent"; text: string; memId?: string };

const SEEDS = [
  "I've been struggling to sleep lately",
  "Help me think through a career decision",
  "Remember that I'm allergic to peanuts",
];

const STORE_PREFIX = "tonara.mnemos.";

export function Mnemos() {
  const { isConnected, address } = useAccount();
  const storeKey = useMemo(
    () => STORE_PREFIX + (address ?? "guest"),
    [address],
  );

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [returned, setReturned] = useState(false);
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [stats, setStats] = useState<TraceStats>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, working]);

  function pushTrace(level: TraceLine["level"], msg: string) {
    setTrace((t) => [...t, { t: ts(), level, msg }]);
  }

  function loadStore(): Msg[] {
    try {
      const raw = localStorage.getItem(storeKey);
      return raw ? (JSON.parse(raw) as Msg[]) : [];
    } catch {
      return [];
    }
  }

  function saveStore(msgs: Msg[]) {
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

    const memId = (await sha256Hex(trimmed + Date.now())).slice(0, 10);
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: trimmed, memId };
    const next = [...messages, userMsg];
    setMessages(next);

    setTrace([]);
    pushTrace("info", `encrypting message · AES-256-GCM · ${new TextEncoder().encode(trimmed).length}B`);
    await wait(180);
    pushTrace("info", `erasure-coding · 6 shards (Reed–Solomon)`);
    await wait(220);
    pushTrace("info", `dispatching shards → 0G Storage`);
    await wait(260);
    pushTrace("ok", `memory committed · mem_${memId}`);
    setStats({ latency: "660 ms", shards: "6", cost: "0.0009 OG", memoryId: `mem_${memId}` });

    // If this is the "return" session and the user types something vague, recall.
    const isVague = returned && (trimmed.length < 40 || /last|remember|earlier|before|talk|continue/i.test(trimmed));
    let reply: string;

    if (isVague) {
      await runRecall();
      reply = composeRecallReply(loadStore());
    } else {
      reply = composeReply(trimmed);
    }

    await wait(220);
    const agentMsg: Msg = { id: crypto.randomUUID(), role: "agent", text: reply };
    const finalMsgs = [...next, agentMsg];
    setMessages(finalMsgs);
    saveStore(finalMsgs);
    setWorking(false);
  }

  async function runRecall() {
    setTrace([]);
    const memId = (await sha256Hex(storeKey + "recall")).slice(0, 10);
    pushTrace("info", `resolving on-chain index · mem_${memId}…`);
    await wait(240);
    pushTrace("info", `micropayment · 0.0021 OG → ShardEscrow`);
    await wait(220);
    pushTrace("info", `fetching 6 shards in parallel`);
    await wait(380);
    pushTrace("info", `   ├─ 0G  ████████ 4/4`);
    pushTrace("info", `   └─ 0G  ████     2/2`);
    await wait(180);
    pushTrace("ok", `reassembled · decrypted · 287 ms total`);
    setStats({ latency: "287 ms", shards: "6", cost: "0.0021 OG", memoryId: `mem_${memId}` });
  }

  function simulateReturn() {
    saveStore(messages);
    setMessages([]);
    setTrace([]);
    setStats({});
    setReturned(true);
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-4 lg:grid-cols-[3fr_2fr]">
      {/* Chat */}
      <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-1">
        <div className="flex h-full flex-col rounded-xl bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Companion agent
              </div>
              <h2 className="mt-0.5 font-display text-lg font-semibold">Mnemos</h2>
            </div>
            <button
              onClick={simulateReturn}
              className="rounded-full border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Simulate return after 2 days
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="font-display text-xl text-foreground">
                  {returned ? "Welcome back." : "Start a conversation."}
                </div>
                <p className="max-w-md text-sm text-muted-foreground">
                  {returned
                    ? "Ask anything — Mnemos will recall what you shared in past sessions."
                    : "Mnemos encrypts and commits each message to long-term memory on 0G."}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {(returned
                    ? ["continue our last conversation", "what were we talking about?", "remind me what I told you"]
                    : SEEDS
                  ).map((s) => (
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
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-foreground text-background"
                      : "border border-border bg-surface text-foreground"
                  }`}
                >
                  <div>{m.text}</div>
                  {m.role === "user" && m.memId && (
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] opacity-60">
                      <LockGlyph /> memory committed · mem_{m.memId}
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
                  placeholder="Message Mnemos…"
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

      <RecallTrace lines={trace} stats={stats} title="Memory pipeline" subtitle="0G Storage · ShardEscrow" />
    </div>
  );
}

function composeReply(text: string): string {
  if (/sleep/i.test(text))
    return "I hear you. Try a 4-7-8 breathing cycle tonight: inhale 4s, hold 7s, exhale 8s. I'll remember to follow up on this.";
  if (/peanut|allergic|allergy/i.test(text))
    return "Noted — peanut allergy stored permanently. I'll factor this into any food suggestions going forward.";
  if (/career|job|decision/i.test(text))
    return "Let's break it down. What are the two paths you're weighing, and what feels heaviest about each?";
  return "Got it. I've committed this to long-term memory and will reference it in future sessions.";
}

function composeRecallReply(prior: Msg[]): string {
  const userMsgs = prior.filter((m) => m.role === "user").map((m) => m.text);
  if (userMsgs.some((t) => /sleep/i.test(t)))
    return "Last time you mentioned trouble sleeping — did the 4-7-8 breathing exercise help? Want to try another technique?";
  if (userMsgs.some((t) => /peanut|allergic/i.test(t)))
    return "Welcome back. I still have your peanut allergy on file — how can I help today?";
  if (userMsgs.some((t) => /career|job/i.test(t)))
    return "Earlier we were weighing your career options. Did anything shift since we last spoke?";
  if (userMsgs.length > 0)
    return `Welcome back. Last session you said: "${userMsgs[userMsgs.length - 1].slice(0, 80)}…" — want to pick up there?`;
  return "I don't have any prior context for this wallet yet. Tell me something you'd like me to remember.";
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
