/**
 * Pure domain logic for fee balances and instalment calculations.
 * All monetary values are integer paise.
 */

function calculateInstalmentBalance(amountPaise, paidPaise = 0, discountPaise = 0) {
  if (typeof amountPaise !== 'number' || typeof paidPaise !== 'number') {
    throw new TypeError('Monetary values must be numbers (integer paise)');
  }
  const effectiveAmount = Math.max(0, amountPaise - discountPaise);
  return Math.max(0, effectiveAmount - paidPaise);
}

function deriveInstalmentStatus(amountPaise, paidPaise, dueDate, referenceDate) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);

  if (paidPaise >= amountPaise) {
    return 'PAID';
  }

  const isPastDue = ref.getTime() > due.getTime();

  if (paidPaise > 0) {
    return isPastDue ? 'PARTIALLY_PAID_OVERDUE' : 'PARTIALLY_PAID';
  }

  return isPastDue ? 'OVERDUE' : 'PENDING';
}

function calculateStudentTotals(instalments = [], discountPaise = 0) {
  let totalBilledPaise = 0;
  let totalPaidPaise = 0;

  for (const inst of instalments) {
    totalBilledPaise += inst.amountPaise || 0;
    totalPaidPaise += inst.paidPaise || 0;
  }

  const effectiveBilledPaise = Math.max(0, totalBilledPaise - discountPaise);
  const totalBalancePaise = Math.max(0, effectiveBilledPaise - totalPaidPaise);

  return {
    totalBilledPaise,
    discountPaise,
    effectiveBilledPaise,
    totalPaidPaise,
    totalBalancePaise,
    isFullyPaid: totalBalancePaise === 0 && instalments.length > 0
  };
}

function getNextPayableInstalment(instalments = [], referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  const unpaid = instalments
    .filter(inst => (inst.paidPaise || 0) < inst.amountPaise)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (unpaid.length === 0) {
    return null;
  }

  const target = unpaid[0];
  const balancePaise = target.amountPaise - (target.paidPaise || 0);

  return {
    instalment: target,
    remainingBalancePaise: balancePaise,
    derivedStatus: deriveInstalmentStatus(target.amountPaise, target.paidPaise || 0, target.dueDate, ref)
  };
}

module.exports = {
  calculateInstalmentBalance,
  deriveInstalmentStatus,
  calculateStudentTotals,
  getNextPayableInstalment
};
