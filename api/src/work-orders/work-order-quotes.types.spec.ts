import { WorkOrderQuoteLineApproval } from '@prisma/client';
import {
  computeApprovedTotals,
  computeLineAmounts,
  displayQuoteMoneyTotals,
} from './work-order-quotes.types';

function line(
  unitNetCents: number,
  approvalStatus: WorkOrderQuoteLineApproval,
  quantity = 1,
) {
  return { quantity, unitNetCents, vatRatePercent: 21, approvalStatus };
}

describe('quote totals exclude rejected lines', () => {
  it('sums all lines while everything is pending', () => {
    const t = computeApprovedTotals([
      line(10000, 'pending'),
      line(5000, 'pending'),
    ]);
    expect(t.totalNetCents).toBe(15000);
  });

  it('drops rejected lines after mixed decisions', () => {
    const t = computeApprovedTotals([
      line(12500, 'approved'),
      line(75000, 'rejected'),
      line(26300, 'approved'),
      line(3750, 'approved'),
    ]);
    expect(t.totalNetCents).toBe(42550);
    expect(t.totalVatCents).toBe(Math.round((42550 * 21) / 100));
  });

  it('prefers stored approved* over stale total* when displaying', () => {
    const money = displayQuoteMoneyTotals({
      totalNetCents: 117550,
      totalVatCents: 24686,
      approvedNetCents: 42550,
      approvedVatCents: 8936,
    });
    expect(money.totalGrossCents).toBe(42550 + 8936);
  });
});

describe('quote line discount', () => {
  it('applies percent before VAT', () => {
    const t = computeLineAmounts({
      quantity: 2,
      unitNetCents: 10000,
      vatRatePercent: 21,
      discountPercent: 10,
    });
    expect(t.discountAppliedCents).toBe(2000);
    expect(t.lineNetCents).toBe(18000);
    expect(t.lineVatCents).toBe(Math.round((18000 * 21) / 100));
  });

  it('applies amount when percent is 0', () => {
    const t = computeLineAmounts({
      quantity: 1,
      unitNetCents: 10000,
      vatRatePercent: 19,
      discountCents: 1500,
    });
    expect(t.discountAppliedCents).toBe(1500);
    expect(t.lineNetCents).toBe(8500);
  });

  it('percent wins over amount', () => {
    const t = computeLineAmounts({
      quantity: 1,
      unitNetCents: 10000,
      vatRatePercent: 19,
      discountPercent: 10,
      discountCents: 5000,
    });
    expect(t.lineNetCents).toBe(9000);
  });

  it('does not go negative', () => {
    const t = computeLineAmounts({
      quantity: 1,
      unitNetCents: 1000,
      vatRatePercent: 19,
      discountCents: 5000,
    });
    expect(t.lineNetCents).toBe(0);
    expect(t.discountAppliedCents).toBe(1000);
  });
});
