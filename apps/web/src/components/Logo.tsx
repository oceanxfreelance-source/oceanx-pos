export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-brand-700" />
      <path d="M6 19c3 0 3-3 6-3s3 3 6 3 3-3 6-3 2 1.5 2 1.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="11" r="3.2" fill="#7dd3e0" />
    </svg>
  );
}
