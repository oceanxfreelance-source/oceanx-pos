import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { checkFaruma, onFarumaStatus } from '../i18n';

/** Visible warning when Dhivehi is active but the Faruma font file is not available. */
export function FarumaWarning() {
  const { t, i18n } = useTranslation();
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const off = onFarumaStatus(setOk);
    if (i18n.language === 'dv') void checkFaruma();
    return () => {
      off();
    };
  }, [i18n.language]);
  if (ok || i18n.language !== 'dv') return null;
  return (
    <div className="no-print flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200" role="alert">
      <TriangleAlert className="size-4 shrink-0" />
      <span>
        {t('system.faruma_missing')} <span dir="ltr">(Faruma font file is required to finalize Dhivehi typography.)</span>
      </span>
    </div>
  );
}
