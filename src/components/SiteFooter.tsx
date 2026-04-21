export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-foreground">
            <div className="h-2 w-2 rounded-[2px] bg-background" />
          </div>
          <span className="font-display text-sm font-semibold text-foreground">Tonara</span>
        </div>
        <div>© {new Date().getFullYear()} Tonara Labs. All rights reserved.</div>
      </div>
    </footer>
  );
}
