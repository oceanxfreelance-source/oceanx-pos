import { describe, expect, it } from 'vitest';
import { isGravityHost } from './product';

describe('isGravityHost', () => {
  it('serves Gravity on its own address and the POS everywhere else', () => {
    expect(isGravityHost('oceanx-gravity.vercel.app')).toBe(true);
    expect(isGravityHost('Gravity.mv')).toBe(true);
    expect(isGravityHost('app.gravityinvoice.com')).toBe(true);
    expect(isGravityHost('oceanx-pos-oceanx1.vercel.app')).toBe(false);
    expect(isGravityHost('localhost')).toBe(false);
  });
});
