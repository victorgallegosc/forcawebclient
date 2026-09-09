import { Link } from "@tanstack/react-router";
import { CalendarDays, Car, Home, Table2, Target } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/tabla", label: "Tabla", icon: Table2 },
  { to: "/calendario", label: "Calendario", icon: CalendarDays },
  { to: "/goleo", label: "Goleo", icon: Target },
  { to: "/aventones", label: "Aventones", icon: Car },
] as const;

export function SiteNav() {
  return (
    <>
      <header className="sticky top-0 z-40 hidden border-b border-border/60 bg-background/80 backdrop-blur-xl md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground display-title text-xl">
              S
            </span>
            <span className="display-title text-2xl">Sunderland</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1.5">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

export function PageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-8 md:px-6 md:pb-16">
      <div className="mb-7">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="display-title mt-2 text-4xl md:text-5xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </main>
  );
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <section className={cn("surface-card p-5 md:p-6", className)}>{children}</section>;
}

export function DataNote({ fetchedAt, stale }: { fetchedAt: string; stale: boolean }) {
  const time = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Monterrey",
  }).format(new Date(fetchedAt));

  return (
    <p className="mt-6 text-center text-xs text-muted-foreground">
      Datos oficiales de la liga · actualizado {time}
      {stale ? " · mostrando la última copia disponible" : ""}
    </p>
  );
}
