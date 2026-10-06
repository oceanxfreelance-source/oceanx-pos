import type { TFunction } from 'i18next';

/** i18next uses "." as key separator; dotted identifiers are stored with "_" instead. */
export const keyOf = (dotted: string) => dotted.replaceAll('.', '_');

export const permissionLabel = (t: TFunction, key: string) => t(`perm.${keyOf(key)}`, { defaultValue: key });
export const moduleLabel = (t: TFunction, key: string) => t(`modules.${key}`, { defaultValue: key });
export const actionLabel = (t: TFunction, action: string) => t(`activity.actions.${keyOf(action)}`, { defaultValue: action });
export const addonLabel = (t: TFunction, code: string, fallback: string) => t(`addons.names.${code}`, { defaultValue: fallback });
export const roleLabel = (t: TFunction, role: { name: string; systemKey: string | null }) =>
  role.systemKey ? t(`roles.system.${role.systemKey}`, { defaultValue: role.name }) : role.name;
