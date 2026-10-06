import { useTranslation } from 'react-i18next';
import { Badge, type BadgeTone } from './ui/Card';

const TONES: Record<string, BadgeTone> = {
  draft: 'gray',
  sent: 'blue',
  accepted: 'green',
  rejected: 'red',
  expired: 'amber',
  converted: 'violet',
  cancelled: 'gray',
  issued: 'blue',
  partially_paid: 'amber',
  paid: 'green',
  overdue: 'red',
  void: 'gray',
  open: 'amber',
  completed: 'green',
  received: 'green',
  unpaid: 'red',
  partial: 'amber',
  new: 'red',
  preparing: 'amber',
  ready: 'green',
  booked: 'blue',
  checked_in: 'violet',
  seated: 'violet',
  no_show: 'red',
  available: 'green',
  occupied: 'amber',
  inactive: 'gray',
};

/** Translated status badge for any document / order status. */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <Badge tone={TONES[status] ?? 'gray'} dot>
      {t(`status_labels.${status}`, { defaultValue: status })}
    </Badge>
  );
}
