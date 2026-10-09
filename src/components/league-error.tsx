import { useRouter } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";

import { PageShell, Panel } from "@/components/app-shell";

export function LeagueRetryError({
  title,
  description,
  detail = "No contestó a tiempo. Casi siempre se arregla al volver a intentar.",
}: {
  title: string;
  description: string;
  /** Optional body copy — defaults to a generic retry hint (not league-specific). */
  detail?: string;
}) {
  const router = useRouter();

  return (
    <PageShell title={title} description={description}>
      <Panel interactive className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{detail}</p>
        <button
          type="button"
          onClick={() => {
            void router.invalidate();
          }}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          <RefreshCw className="size-4" />
          Reintentar
        </button>
      </Panel>
    </PageShell>
  );
}
