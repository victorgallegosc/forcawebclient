// Public identifiers for the league console pages we read.
// Verified against consola.zione.com.mx.

export const ZIONE_BASE = "https://consola.zione.com.mx";
export const DTS = "DTS094";

/** 3er TORNEO FIN DE SEMANA 2026 */
export const TOURNAMENT_ID = "35258";
export const TOURNAMENT_NAME = "3er Torneo Fin de Semana 2026";

/** F7 Sabatino Vespertino */
export const CATEGORY_ID = "8555";
export const CATEGORY_NAME = "F7 Sabatino Vespertino";

export const GROUPS = [
  { id: "18470", name: "Grupo 4 A", short: "4 A" },
  { id: "16960", name: "Grupo 4 B", short: "4 B" },
] as const;

export type GroupId = (typeof GROUPS)[number]["id"];

export const OUR_TEAM = "A3860 SUNDERLAND";
export const OUR_TEAM_SHORT = "Sunderland";
export const OUR_GROUP_ID = "16960";
export const OUR_GROUP_NAME = "Grupo 4 B";

/** Only these two groups are ever surfaced in the app. */
export const ALLOWED_GROUP_NAMES = ["Grupo 4 A", "Grupo 4 B"];
