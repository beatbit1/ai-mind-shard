import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const AppShellClient = lazy(() => import("@/components/AppShellClient"));

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tonara Console — Agent Workspaces" },
      {
        name: "description",
        content:
          "Operate Mnemos and Atlas — agent workspaces powered by encrypted long-term memory on 0G.",
      },
    ],
  }),
  component: AppRoute,
});

function AppRoute() {
  return (
    <ClientOnly
      fallback={<div className="min-h-screen bg-background text-foreground" aria-busy="true" />}
    >
      <Suspense fallback={<div className="min-h-screen bg-background text-foreground" aria-busy="true" />}>
        <AppShellClient />
      </Suspense>
    </ClientOnly>
  );
}
