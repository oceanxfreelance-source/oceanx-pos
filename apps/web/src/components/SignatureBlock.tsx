import type { TFunction } from 'i18next';

export interface DocBranding {
  stamp: boolean;
  signer: { id: string; name: string; hasSignature: boolean } | null;
}

/**
 * "Authorized signature" area for printed documents: the preparer's signature over a line, their name,
 * and the company stamp beside it. Renders nothing when there is neither a stamp nor a signature.
 */
export function SignatureBlock({ branding, t, label }: { branding?: DocBranding | null; t: TFunction; label?: string }) {
  if (!branding || (!branding.stamp && !branding.signer?.hasSignature)) return null;
  const s = branding.signer;
  return (
    <div className="flex justify-end pt-4" data-pdf-block>
      <div className="relative flex w-48 flex-col items-center text-center">
        {branding.stamp && <img src="/api/settings/stamp" alt="" className="pointer-events-none absolute -top-4 -start-16 h-20 w-20 rotate-[-8deg] object-contain opacity-85" />}
        <div className="flex h-12 w-full items-end justify-center">
          {s?.hasSignature && <img src={`/api/users/${s.id}/signature`} alt="" className="relative max-h-12 max-w-36 object-contain" />}
        </div>
        <div className="w-full border-t border-slate-500 pt-1 text-[11px]">
          <p className="font-semibold text-slate-800" dir="auto">
            {s?.hasSignature ? s.name : ''}
          </p>
          <p className="text-slate-500">{label ?? t('print.authorized_signature')}</p>
        </div>
      </div>
    </div>
  );
}
