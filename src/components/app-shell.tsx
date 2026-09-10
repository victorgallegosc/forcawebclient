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
      <header className="sticky top-0 z-40 hidden border-b border-border/70 bg-background/75 backdrop-blur-xl md:block animate-fade-in">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="group flex items-baseline gap-2">
            <span className="display-title text-2xl tracking-tight transition-colors group-hover:text-primary">
              Cancha
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              F7
            </span>
          </Link>
          <nav className="flex items-center gap-0.5" aria-label="Principal">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="relative px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{
                  className:
                    "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:content-['']",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 backdrop-blur-xl md:hidden"
        aria-label="Principal"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-1 py-1.5">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <item.icon className="size-5" strokeWidth={1.75} />
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
  hero = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  /** Full-bleed first section (home). */
  hero?: boolean;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-5xl px-4 pb-28 md:px-6 md:pb-16",
        hero ? "pt-0" : "pt-10 md:pt-12",
      )}
    >
      {!hero ? (
        <header className="mb-8 animate-rise">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="display-title mt-2 text-[2.5rem] md:text-5xl">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </header>
      ) : null}
      {children}
    </main>
  );
}

/** Quiet content block — not a marketing card. Use for lists and tables. */
export function Panel({
  className,
  children,
  interactive = false,
}: {
  className?: string;
  children: ReactNode;
  /** Stronger surface only when the block hosts actions. */
  interactive?: boolean;
}) {
  return (
    <section
      className={cn(
        interactive
          ? "surface-panel p-5 md:p-6"
          : "rounded-xl border border-border/60 bg-surface/60 p-5 md:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
  tone = "primary",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "primary" | "accent";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? tone === "accent"
            ? "bg-accent text-accent-foreground"
            : "bg-foreground text-background"
          : "bg-secondary/80 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function DataNote({ fetchedAt, stale }: { fetchedAt: string; stale: boolean }) {
  const time = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Monterrey",
  }).format(new Date(fetchedAt));

  return (
    <p className="mt-10 text-center text-xs text-muted-foreground animate-fade-in">
      Datos de la liga · actualizado {time}
      {stale ? " · última copia disponible" : ""}
    </p>
  );
}
