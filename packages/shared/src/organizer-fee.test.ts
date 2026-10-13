import { describe, expect, it } from 'vitest';
import { organizerFeeDueXof, organizerFeeXof } from './organizer-fee.js';

describe("frais d'organisation", () => {
  it.each([
    [1, 0],
    [30, 0],
    [50, 0],
    [51, 2040],
    [60, 2400],
    [100, 4000],
    [1000, 40000],
  ])('capacité %i : %i FCFA', (capacity, fee) => {
    expect(organizerFeeXof(capacity)).toBe(fee);
  });

  it('augmentation : frais du nouveau total moins ce qui est déjà payé', () => {
    expect(organizerFeeDueXof(40, organizerFeeXof(30))).toBe(0); // 30 -> 40
    expect(organizerFeeDueXof(60, organizerFeeXof(40))).toBe(2400); // 40 -> 60
    expect(organizerFeeDueXof(100, organizerFeeXof(50))).toBe(4000); // 50 -> 100
    expect(organizerFeeDueXof(85, organizerFeeXof(60))).toBe(1000); // 60 -> 85 : 25 places
  });

  it('baisser la capacité ne rembourse rien et remonter au niveau payé ne coûte rien', () => {
    const paid = organizerFeeXof(100);
    expect(organizerFeeDueXof(80, paid)).toBe(0);
    expect(organizerFeeDueXof(100, paid)).toBe(0);
    expect(organizerFeeDueXof(110, paid)).toBe(400);
  });
});
