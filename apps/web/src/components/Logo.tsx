/** The OceanX icon (white tile with the OCEANX wordmark); a soft ring keeps the tile visible on white and in dark mode. */
export function Logo({ className = 'size-8' }: { className?: string }) {
  return <img src="/brand/icon-192.png" alt="" aria-hidden width={192} height={192} draggable={false} className={`${className} shrink-0 rounded-[22%] ring-1 ring-slate-200 dark:ring-slate-700`} />;
}
