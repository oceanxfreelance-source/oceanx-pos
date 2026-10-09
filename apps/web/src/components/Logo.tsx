/** The OceanX icon (white OCEANX wordmark on a black tile); a faint ring keeps the tile edge visible in dark mode. */
export function Logo({ className = 'size-8' }: { className?: string }) {
  return <img src="/brand/icon-192.png" alt="" aria-hidden width={192} height={192} draggable={false} className={`${className} shrink-0 rounded-[22%] ring-1 ring-black/5 dark:ring-white/15`} />;
}
