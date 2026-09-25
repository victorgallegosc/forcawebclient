// Public identifiers for the league console pages we read.
// Verified against consola.zione.com.mx.

export const ZIONE_BASE = "https://consola.zione.com.mx";
export const DTS = "DTS094";

/** 4TO TORNEO FIN DE SEMANA 2026 */
export const TOURNAMENT_ID = "36183";
export const TOURNAMENT_NAME = "4to Torneo Fin de Semana 2026";

/** F7 Sabatino Vespertino */
export const CATEGORY_ID = "8555";
export const CATEGORY_NAME = "F7 Sabatino Vespertino";

export const GROUPS = [
  { id: "78101", name: "Recreativo", short: "Recreativo" },
] as const;

export type GroupId = (typeof GROUPS)[number]["id"];

export const OUR_TEAM = "A3860 SUNDERLAND";
export const OUR_TEAM_SHORT = "Sunderland";
export const OUR_GROUP_ID = "78101";
export const OUR_GROUP_NAME = "Recreativo";

/** Only these groups are ever surfaced in the app. */
export const ALLOWED_GROUP_NAMES = ["Recreativo"];
