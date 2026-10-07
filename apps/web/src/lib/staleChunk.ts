/**
 * After a new version is deployed, a tab opened earlier still points at the old page files, which no
 * longer exist. Reload once to pick up the new version instead of showing an error. The timestamp guard
 * stops a reload loop if the files are genuinely unreachable (e.g. offline).
 */
const KEY = "ox_chunk_reload";

export const isStaleChunkError = (err: unknown) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    err instanceof Error ? err.message : String(err ?? ""),
  );

/** Returns true when a reload was started. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage unavailable: still reload once per page load.
  }
  window.location.reload();
  return true;
}

export function installStaleChunkReload() {
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForNewVersion()) event.preventDefault();
  });
}
