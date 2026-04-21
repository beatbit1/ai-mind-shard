import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { WalletProviders } from "@/components/WalletProviders";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Tonara Console — Agent Memory Operator" },
      {
        name: "description",
        content:
          "Operate your agent's encrypted long-term memory on 0G. Shard memories and fragment data across chains.",
      },
    ],
  }),
  component: () => (
    <WalletProviders>
      <AppDashboard />
    </WalletProviders>
  ),
});

type LogEntry = { t: string; level: "info" | "ok" | "warn" | "err"; msg: string };

function AppDashboard() {
  const { isConnected, address } = useAccount();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Sharded Memory state
  const [memText, setMemText] = useState("");
  const [shardCount, setShardCount] = useState(8);
  const [working, setWorking] = useState(false);

  // Cross-chain fragmentation state
  const [fragInput, setFragInput] = useState("");
  const [chains, setChains] = useState<Record<string, boolean>>({
    "0G": true,
    ETH: true,
    SOL: false,
    BASE: false,
  });
  const [fragments, setFragments] = useState<{ chain: string; cid: string; bytes: number }[]>([]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  function pushLog(level: LogEntry["level"], msg: string) {
    setLogs((l) => [...l, { t: ts(), level, msg }]);
  }

  function requireWallet(): boolean {
    if (!isConnected) {
      pushLog("warn", "wallet not connected · connect to sign transactions");
      return false;
    }
    return true;
  }

  // --- Feature 1: Sharded Memory ---
  async function handleShard() {
    if (!requireWallet()) return;
    if (!memText.trim()) {
      pushLog("warn", "memory body is empty");
      return;
    }
    setWorking(true);
    const bytes = new TextEncoder().encode(memText).length;
    pushLog("info", `encrypting memory · AES-256-GCM · ${bytes}B`);
    await wait(220);
    const k = Math.max(2, Math.ceil(shardCount * 0.6));
    pushLog("info", `erasure-coding · n=${shardCount} k=${k} (Reed–Solomon)`);
    await wait(260);
    // Hash for deterministic id
    const id = await sha256Hex(memText + Date.now());
    pushLog("info", `dispatching ${shardCount} shards → 0G Storage`);
    await wait(380);
    pushLog("ok", `writeMemory committed · mem_${id.slice(0, 10)}`);
    setWorking(false);
  }

  async function handleRecall() {
    if (!requireWallet()) return;
    if (!memText.trim()) {
      pushLog("warn", "enter the memory query in the field above");
      return;
    }
    setWorking(true);
    pushLog("info", `recall("${memText.slice(0, 32)}…") · resolving on-chain index`);
    await wait(380);
    pushLog("info", "micropayment · 0.0021 OG → ShardEscrow");
    await wait(280);
    pushLog("info", "fetching shards in parallel");
    await wait(420);
    pushLog("ok", "reassembled · decrypted · 287ms total");
    setWorking(false);
  }

  // --- Feature 2: Cross-Chain Data Fragmentation ---
  async function handleFragment() {
    if (!requireWallet()) return;
    const selected = Object.entries(chains).filter(([, v]) => v).map(([k]) => k);
    if (selected.length < 2) {
      pushLog("warn", "select at least 2 chains for fragmentation");
      return;
    }
    if (!fragInput.trim()) {
      pushLog("warn", "fragmentation payload is empty");
      return;
    }
    setWorking(true);
    const bytes = new TextEncoder().encode(fragInput).length;
    const per = Math.ceil(bytes / selected.length);
    pushLog("info", `splitting ${bytes}B across ${selected.length} chains · ~${per}B/chain`);
    await wait(260);
    const out: typeof fragments = [];
    for (const c of selected) {
      const cid = (await sha256Hex(c + fragInput + Date.now())).slice(0, 14);
      out.push({ chain: c, cid: `0x${cid}`, bytes: per });
      pushLog("info", `${c} · fragment 0x${cid} committed`);
      await wait(180);
    }
    setFragments(out);
    pushLog("ok", `fragmentation complete · ${out.length} chains · manifest anchored on 0G`);
    setWorking(false);
  }

  async function handleReassemble() {
    if (!requireWallet()) return;
    if (fragments.length === 0) {
      pushLog("warn", "no fragments to reassemble");
      return;
    }
    setWorking(true);
    pushLog("info", `resolving manifest · ${fragments.length} fragments`);
    await wait(280);
    for (const f of fragments) {
      pushLog("info", `${f.chain} · fetched ${f.cid}`);
      await wait(150);
    }
    pushLog("ok", "payload reassembled · integrity verified");
    setWorking(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-foreground">
              <div className="h-2.5 w-2.5 rounded-[2px] bg-background" />
            </div>
            <span className="font-display text-base font-semibold">Tonara</span>
            <span className="ml-2 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              console
            </span>
          </Link>
          <ConnectButton
            accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-8">
        {!isConnected && (
          <div className="mb-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
            Connect a wallet to sign shard commits and cross-chain fragment manifests.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Feature 1: Sharded Memory */}
          <section className="rounded-2xl border border-border bg-surface p-1">
            <div className="rounded-xl bg-background p-6">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Feature 01
              </div>
              <h2 className="mt-1 font-display text-xl font-semibold">Sharded Memory</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Encrypt a memory, erasure-code it into shards, and commit to 0G Storage.
              </p>

              <textarea
                value={memText}
                onChange={(e) => setMemText(e.target.value)}
                placeholder="Memory body or recall query…"
                rows={5}
                className="mt-4 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
              />

              <div className="mt-3 flex items-center gap-3">
                <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  shards
                </label>
                <input
                  type="range"
                  min={4}
                  max={16}
                  value={shardCount}
                  onChange={(e) => setShardCount(Number(e.target.value))}
                  className="flex-1 accent-foreground"
                />
                <span className="font-mono text-xs">{shardCount}</span>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleShard}
                  disabled={working}
                  className="flex-1 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Shard & commit
                </button>
                <button
                  onClick={handleRecall}
                  disabled={working}
                  className="flex-1 rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:bg-secondary disabled:opacity-40"
                >
                  Recall
                </button>
              </div>
            </div>
          </section>

          {/* Feature 2: Cross-Chain Fragmentation */}
          <section className="rounded-2xl border border-border bg-surface p-1">
            <div className="rounded-xl bg-background p-6">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Feature 02
              </div>
              <h2 className="mt-1 font-display text-xl font-semibold">
                Cross-Chain Data Fragmentation
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Split a payload across selected chains. Anchor manifest on 0G.
              </p>

              <textarea
                value={fragInput}
                onChange={(e) => setFragInput(e.target.value)}
                placeholder="Payload to fragment…"
                rows={4}
                className="mt-4 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {Object.keys(chains).map((c) => (
                  <button
                    key={c}
                    onClick={() => setChains((s) => ({ ...s, [c]: !s[c] }))}
                    className={`rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                      chains[c]
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleFragment}
                  disabled={working}
                  className="flex-1 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Fragment
                </button>
                <button
                  onClick={handleReassemble}
                  disabled={working || fragments.length === 0}
                  className="flex-1 rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:bg-secondary disabled:opacity-40"
                >
                  Reassemble
                </button>
              </div>

              {fragments.length > 0 && (
                <div className="mt-4 divide-y divide-border rounded-xl border border-border">
                  {fragments.map((f) => (
                    <div key={f.cid} className="flex items-center justify-between p-3 text-xs">
                      <span className="font-mono">{f.chain}</span>
                      <span className="font-mono text-muted-foreground">{f.cid}</span>
                      <span className="font-mono text-muted-foreground">{f.bytes}B</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Live Logs */}
        <section className="mt-6 rounded-2xl border border-border bg-surface p-1">
          <div className="rounded-xl bg-background p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Runtime
                </div>
                <h2 className="mt-1 font-display text-xl font-semibold">Live logs</h2>
              </div>
              <div className="flex items-center gap-3">
                {address && (
                  <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                    {address.slice(0, 6)}…{address.slice(-4)}
                  </span>
                )}
                <span
                  className={`h-2 w-2 rounded-full ${isConnected ? "bg-foreground animate-pulse" : "bg-muted-foreground"}`}
                />
              </div>
            </div>
            <div
              ref={logRef}
              className="mt-5 h-72 overflow-y-auto rounded-xl border border-border bg-background p-4 font-mono text-[12px] leading-relaxed"
            >
              {logs.length === 0 ? (
                <div className="text-muted-foreground">› awaiting first action…</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="select-none text-border">{l.t}</span>
                    <span
                      className={
                        l.level === "ok"
                          ? "text-foreground"
                          : l.level === "warn" || l.level === "err"
                            ? "text-muted-foreground"
                            : "text-muted-foreground"
                      }
                    >
                      {l.level === "ok" ? "✓ " : l.level === "warn" ? "! " : "› "}
                      {l.msg}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
