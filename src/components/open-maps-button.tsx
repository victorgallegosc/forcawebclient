import { ExternalLink } from "lucide-react";

import { googleMapsDirectionsUrl } from "@/lib/rides/maps";
import type { Driver } from "@/lib/rides/rotation";
import { cn } from "@/lib/utils";

export function OpenMapsButton({
  driver,
  className,
}: {
  driver: Driver;
  className?: string;
}) {
  return (
    <a
      href={googleMapsDirectionsUrl(driver)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90",
        className,
      )}
    >
      Abrir en Google Maps <ExternalLink className="size-4" />
    </a>
  );
}
