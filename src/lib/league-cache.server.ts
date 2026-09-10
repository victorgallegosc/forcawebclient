// Two-layer cache so opening the app does not hammer the league site:
// a short in-process cache, backed by a durable last-good copy in the
// database when Supabase is configured. Without Cloud credentials we
// fall back to a baked seed snapshot so Inicio never hard-fails cold.

import seed from "@/lib/zione/seed-fallback.json";

type Entry<T> = { data: T; fetchedAt: number };

const memory = new Map<string, Entry<unknown>>();
const TTL_MS = 10 * 60 * 1000;
/** Keep a process-local last-good copy even after TTL so cold retries can recover. */
const STALE_MAX_MS = 24 * 60 * 60 * 1000;

const SEED_KEYS = ["standings", "schedule", "scorers", "cards"] as const;
type SeedKey = (typeof SEED_KEYS)[number];

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

function durableEnabled() {
  // Lovable / Netlify may inject either naming style.
  return Boolean(
    (env("SUPABASE_URL") || env("VITE_SUPABASE_URL")) &&
      (env("SUPABASE_SERVICE_ROLE_KEY") ||
        env("SUPABASE_SERVICE_KEY") ||
        env("SERVICE_ROLE_KEY")),
  );
}

function seedEntry<T>(key: string): Entry<T> | null {
  if (!(SEED_KEYS as readonly string[]).includes(key)) return null;
  const payload = (seed as Record<string, unknown>)[key] as T | undefined;
  if (!payload) return null;
  return { data: payload, fetchedAt: new Date(String((seed as { fetchedAt: string }).fetchedAt)).getTime() };
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function readDurable<T>(key: string): Promise<Entry<T> | null> {
  if (!durableEnabled()) return null;
  try {
    const { data, error } = await (await db())
      .from("league_cache")
      .select("payload, fetched_at")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    return { data: data.payload as T, fetchedAt: new Date(data.fetched_at).getTime() };
  } catch {
    return null;
  }
}

async function writeDurable(key: string, data: unknown, fetchedAt: number) {
  if (!durableEnabled()) return;
  try {
    const { error } = await (await db())
      .from("league_cache")
      .upsert(
        {
          key,
          payload: data as unknown as never,
          fetched_at: new Date(fetchedAt).toISOString(),
        },
        { onConflict: "key" },
      );
    // Supabase reports database errors in the result, not as a rejection.
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error(`Could not persist league cache for ${key}`, error);
  }
}

export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<{ data: T; fetchedAt: string; stale: boolean }> {
  const hit = memory.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
    return { data: hit.data, fetchedAt: new Date(hit.fetchedAt).toISOString(), stale: false };
  }

  try {
    const data = await loader();
    const fetchedAt = Date.now();
    memory.set(key, { data, fetchedAt });
    await writeDurable(key, data, fetchedAt);
    return { data, fetchedAt: new Date(fetchedAt).toISOString(), stale: false };
  } catch (error) {
    console.error(`Zione fetch failed for ${key}, falling back to last good copy`, error);
    const durable = await readDurable<T>(key);
    const baked = seedEntry<T>(key);
    const candidates = [hit, durable, baked].filter(Boolean) as Entry<T>[];
    const freshEnough = candidates.find((entry) => Date.now() - entry.fetchedAt < STALE_MAX_MS);
    const fallback = freshEnough ?? candidates[0] ?? null;
    if (fallback) {
      memory.set(key, fallback);
      return {
        data: fallback.data,
        fetchedAt: new Date(fallback.fetchedAt).toISOString(),
        stale: true,
      };
    }
    throw error;
  }
}
