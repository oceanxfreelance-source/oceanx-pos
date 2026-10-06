import { describe, expect, it } from 'vitest';
import { keyOf } from './labels';

describe('translation key helpers', () => {
  it('maps dotted identifiers to i18next-safe keys', () => {
    expect(keyOf('quotations.convert_to_invoice')).toBe('quotations_convert_to_invoice');
    expect(keyOf('superadmin.business_suspended')).toBe('superadmin_business_suspended');
  });
});
