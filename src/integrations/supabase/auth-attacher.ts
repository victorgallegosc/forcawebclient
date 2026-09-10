// Attaches the Supabase session bearer token to server function RPCs when auth
// is configured. If Supabase env vars are missing (local/dev without Cloud),
// this is a no-op so league reads can still run.
import { createMiddleware } from "@tanstack/react-start";

function supabaseConfigured() {
  const url = import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const key =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"];
  return Boolean(url && key);
}

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (!supabaseConfigured()) {
      return next({ headers: {} });
    }

    const { supabase } = await import("./client");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
