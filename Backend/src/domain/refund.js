/**
 * Pure domain logic for pro-rata refund calculation under the assumed refund policy.
 * All monetary amounts are in integer paise.
 */

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

function calculateProRataRefund({
  totalCourseFeePaise,
  paidPaise = 0,
  courseStartDate,
  courseEndDate,
  exitDate,
  adminFeePaise = 500000,   // ₹5,000 assumed non-refundable admin/registration fee
  materialFeePaise = 300000 // ₹3,000 assumed non-refundable study material fee if retained
}) {
  if (typeof totalCourseFeePaise !== 'number' || typeof paidPaise !== 'number') {
    throw new TypeError('totalCourseFeePaise and paidPaise must be numbers (integer paise)');
  }

  const start = courseStartDate instanceof Date ? courseStartDate : new Date(courseStartDate);
  const end = courseEndDate instanceof Date ? courseEndDate : new Date(courseEndDate);
  const exit = exitDate instanceof Date ? exitDate : new Date(exitDate);

  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const exitUtc = Date.UTC(exit.getFullYear(), exit.getMonth(), exit.getDate());

  if (endUtc <= startUtc) {
    throw new Error('courseEndDate must be after courseStartDate');
  }

  const totalDays = Math.max(1, Math.round((endUtc - startUtc) / MILLIS_PER_DAY));

  // If student exits before batch start, enrolled days is 0.
  // If student exits after batch end, enrolled days is capped at totalDays.
  const rawEnrolledDays = Math.round((exitUtc - startUtc) / MILLIS_PER_DAY);
  const enrolledDays = Math.max(0, Math.min(totalDays, rawEnrolledDays));

  // Pro-rata instructional deduction by days enrolled divided by total days
  const instructionalDeductionPaise = Math.round((enrolledDays / totalDays) * totalCourseFeePaise);

  // Net refundable amount
  const netRefundPaise = Math.max(
    0,
    paidPaise - adminFeePaise - materialFeePaise - instructionalDeductionPaise
  );

  // 10-day settlement deadline under the assumed refund policy
  const settlementDeadline = new Date(exit.getTime() + 10 * MILLIS_PER_DAY);

  // GST reversal breakdown (18% inclusive GST reversed on refund: Base = Net / 1.18)
  const baseRefundPaise = Math.round(netRefundPaise / 1.18);
  const totalGstPaise = netRefundPaise - baseRefundPaise;
  const cgstPaise = Math.floor(totalGstPaise / 2);
  const sgstPaise = totalGstPaise - cgstPaise;

  return {
    policyLabel: 'assumed refund policy',
    totalCourseFeePaise,
    paidPaise,
    totalDays,
    enrolledDays,
    instructionalDeductionPaise,
    adminFeePaise,
    materialFeePaise,
    netRefundPaise,
    settlementDeadline,
    gstReversal: {
      baseRefundPaise,
      cgstPaise,
      sgstPaise,
      totalGstPaise
    }
  };
}

module.exports = {
  calculateProRataRefund
};
