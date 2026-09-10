import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteNav } from "../components/app-shell";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center field-glow px-4">
      <div className="max-w-md text-center animate-rise">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">404</p>
        <h1 className="display-title mt-3 text-4xl text-foreground">Página no encontrada</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta página no existe o se movió. Regresa al inicio para continuar.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center field-glow px-4">
      <div className="max-w-md text-center animate-rise">
        <h1 className="display-title text-3xl text-foreground">Algo salió mal</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Hubo un problema de nuestro lado. Puedes intentar de nuevo o regresar al inicio.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cancha · Fin de Semana 2026" },
      {
        name: "description",
        content:
          "Tabla, calendario, goleo y rides del F7 Sabatino Vespertino — 3er Torneo Fin de Semana 2026.",
      },
      { name: "author", content: "Cancha" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cancha-theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen field-glow">
        <SiteNav />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </div>
    </QueryClientProvider>
  );
}
