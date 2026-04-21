export function SiteFooter() {
  const cols: Array<{ title: string; links: string[] }> = [
    { title: "Platform", links: ["Storage Shards", "Memory Index", "Compute", "Agent SDK"] },
    { title: "Developers", links: ["Documentation", "Quickstart", "API Reference", "GitHub"] },
    { title: "Ecosystem", links: ["Partners", "Grants", "Brand Kit", "Community"] },
    { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 md:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-foreground">
                <div className="h-3 w-3 rounded-[2px] bg-background" />
              </div>
              <span className="font-display text-lg font-semibold">Tonara</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              The permanent, private brain layer for autonomous AI agents.
            </p>
            <div className="mt-6 flex gap-3">
              {["X", "GH", "DC"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} Tonara Labs. All rights reserved.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
