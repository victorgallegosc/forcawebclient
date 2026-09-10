// Brief in-process memo of the last successful LIVE scrape so one page
// load does not re-hit Zione for every section. There is no baked seed
// and no stale offline copy: if the live scrape fails, the error
// propagates and the UI can retry.

type Entry<T> = { data: T; fetchedAt: number };

const memory = new Map<string, Entry<unknown>>();
/** Serve a just-fetched live result without scraping again immediately. */
const TTL_MS = 2 * 60 * 1000;

export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<{ data: T; fetchedAt: string; stale: boolean }> {
  const hit = memory.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
    return { data: hit.data, fetchedAt: new Date(hit.fetchedAt).toISOString(), stale: false };
  }

  const data = await loader();
  const fetchedAt = Date.now();
  memory.set(key, { data, fetchedAt });
  return { data, fetchedAt: new Date(fetchedAt).toISOString(), stale: false };
}
