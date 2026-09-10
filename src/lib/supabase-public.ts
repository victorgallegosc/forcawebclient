// A publishable-key Supabase client for server-side use.
//
// The app has no accounts on purpose, and it must be deployable to any host
// (Netlify included) without a private service key. Everything it can reach is
// deliberately narrow: read-only league/ride tables plus the security-definer
// functions that own every write.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

function build() {
  const url =
    import.meta.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const key =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !key) throw new Error("Faltan las credenciales públicas de Supabase.");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // New-format sb_ keys are opaque strings, not bearer JWTs.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

let client: ReturnType<typeof build> | undefined;

export function publicDb() {
  if (!client) client = build();
  return client;
}
