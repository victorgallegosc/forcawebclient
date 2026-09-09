// Small in-memory cache so opening the app doesn't hammer the league site,
// and so a temporary outage still renders the last good data.

type Entry<T> = { data: T; fetchedAt: number };

const cache = new Map<string, Entry<unknown>>();
const TTL_MS = 10 * 60 * 1000;

export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<{ data: T; fetchedAt: string; stale: boolean }> {
  const hit = cache.get(key) as Entry<T> | undefined;
  const fresh = hit && Date.now() - hit.fetchedAt < TTL_MS;
  if (fresh) {
    return { data: hit!.data, fetchedAt: new Date(hit!.fetchedAt).toISOString(), stale: false };
  }

  try {
    const data = await loader();
    cache.set(key, { data, fetchedAt: Date.now() });
    return { data, fetchedAt: new Date().toISOString(), stale: false };
  } catch (error) {
    if (hit) {
      console.error(`Zione fetch failed for ${key}, serving cached copy`, error);
      return { data: hit.data, fetchedAt: new Date(hit.fetchedAt).toISOString(), stale: true };
    }
    throw error;
  }
}
