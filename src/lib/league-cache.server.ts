// Two-layer cache so opening the app doesn't hammer the league site:
// a short in-process cache, backed by a durable last-good copy in the
// database when Supabase is configured. Without Cloud credentials the
// durable layer is skipped and the live scrape still works.

type Entry<T> = { data: T; fetchedAt: number };

const memory = new Map<string, Entry<unknown>>();
const TTL_MS = 10 * 60 * 1000;

function durableEnabled() {
  return Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]);
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
    const fallback = hit ?? (await readDurable<T>(key));
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
