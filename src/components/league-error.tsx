import { useRouter } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";

import { PageShell, Panel } from "@/components/app-shell";

export function LeagueRetryError({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const router = useRouter();

  return (
    <PageShell title={title} description={description}>
      <Panel interactive className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          La liga no contestó a tiempo. Casi siempre se arregla al volver a intentar.
        </p>
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
