import clsx from 'clsx';

/** Calm, accessible tints for items without a photo; chosen deterministically from a key (category or name). */
const TINTS = [
  { bg: 'bg-sky-100 dark:bg-sky-950', fg: 'text-sky-800 dark:text-sky-200', bar: 'bg-sky-400' },
  { bg: 'bg-amber-100 dark:bg-amber-950', fg: 'text-amber-800 dark:text-amber-200', bar: 'bg-amber-400' },
  { bg: 'bg-emerald-100 dark:bg-emerald-950', fg: 'text-emerald-800 dark:text-emerald-200', bar: 'bg-emerald-400' },
  { bg: 'bg-rose-100 dark:bg-rose-950', fg: 'text-rose-800 dark:text-rose-200', bar: 'bg-rose-400' },
  { bg: 'bg-violet-100 dark:bg-violet-950', fg: 'text-violet-800 dark:text-violet-200', bar: 'bg-violet-400' },
  { bg: 'bg-orange-100 dark:bg-orange-950', fg: 'text-orange-800 dark:text-orange-200', bar: 'bg-orange-400' },
  { bg: 'bg-teal-100 dark:bg-teal-950', fg: 'text-teal-800 dark:text-teal-200', bar: 'bg-teal-400' },
  { bg: 'bg-fuchsia-100 dark:bg-fuchsia-950', fg: 'text-fuchsia-800 dark:text-fuchsia-200', bar: 'bg-fuchsia-400' },
] as const;

/** Distinct tint by position (e.g. category order), so neighbouring categories never share a colour. */
export function tintAt(index: number) {
  return TINTS[((index % TINTS.length) + TINTS.length) % TINTS.length]!;
}

export function tintFor(key: string | null | undefined) {
  let h = 0;
  for (const ch of key ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[1]?.[0] ?? '') : (parts[0]?.[1] ?? ''))).toUpperCase();
}

/** Photo if available, otherwise coloured initials. */
export function ItemAvatar({ name, tintKey, tint: given, src, className }: { name: string; tintKey?: string | null; tint?: ReturnType<typeof tintAt>; src?: string | null; className?: string }) {
  const tint = given ?? tintFor(tintKey ?? name);
  if (src) return <img src={src} alt="" loading="lazy" className={clsx('shrink-0 rounded-xl object-cover', className)} />;
  return (
    <span aria-hidden className={clsx('flex shrink-0 items-center justify-center rounded-xl font-semibold', tint.bg, tint.fg, className)} dir="auto">
      {initials(name)}
    </span>
  );
}
