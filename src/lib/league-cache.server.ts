// Two-layer cache so opening the app doesn't hammer the league site:
// a short in-process cache, backed by a durable last-good copy in the
// database so a cold start or a new instance still has a fallback when the
// league site is unreachable.

type Entry<T> = { data: T; fetchedAt: number };

const memory = new Map<string, Entry<unknown>>();
const TTL_MS = 10 * 60 * 1000;

async function db() {
  const { publicDb } = await import("@/lib/supabase-public");
  return publicDb();
}

async function readDurable<T>(key: string): Promise<Entry<T> | null> {
  try {
    const { data, error } = await (await db()).rpc("read_league_cache", { _key: key });
    const row = data?.[0];
    if (error || !row) return null;
    return { data: row.payload as T, fetchedAt: new Date(row.fetched_at).getTime() };
  } catch {
    return null;
  }
}

async function writeDurable(key: string, data: unknown, fetchedAt: number) {
  try {
    const { error } = await (await db()).rpc("write_league_cache", {
      _key: key,
      _payload: data as unknown as never,
      _fetched_at: new Date(fetchedAt).toISOString(),
    });
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
