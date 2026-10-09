import type { TFunction } from 'i18next';

/** i18next uses "." as key separator; dotted identifiers are stored with "_" instead. */
export const keyOf = (dotted: string) => dotted.replaceAll('.', '_');

export const permissionLabel = (t: TFunction, key: string) => t(`perm.${keyOf(key)}`, { defaultValue: key });
export const moduleLabel = (t: TFunction, key: string) => t(`modules.${key}`, { defaultValue: key });
export const actionLabel = (t: TFunction, action: string) => t(`activity.actions.${keyOf(action)}`, { defaultValue: action });
export const addonLabel = (t: TFunction, code: string, fallback: string) => t(`addons.names.${code}`, { defaultValue: fallback });
/** Shops name their built-in roles differently (Owner, Cashier / Salesperson); set once from the session. */
let retailRoleNames = false;
export const setRetailRoleNames = (on: boolean) => {
  retailRoleNames = on;
};
export const roleLabel = (t: TFunction, role: { name: string; systemKey: string | null }) =>
  role.systemKey
    ? retailRoleNames
      ? t(`roles.system_retail.${role.systemKey}`, { defaultValue: t(`roles.system.${role.systemKey}`, { defaultValue: role.name }) })
      : t(`roles.system.${role.systemKey}`, { defaultValue: role.name })
    : role.name;
export const roleDescription = (t: TFunction, systemKey: string) =>
  retailRoleNames
    ? t(`roles.system_desc_retail.${systemKey}`, { defaultValue: t(`roles.system_desc.${systemKey}`, { defaultValue: '' }) })
    : t(`roles.system_desc.${systemKey}`, { defaultValue: '' });
