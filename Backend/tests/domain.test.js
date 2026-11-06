const {
  calculateInstalmentBalance,
  deriveInstalmentStatus,
  calculateStudentTotals,
  getNextPayableInstalment
} = require('../src/domain/balance');

const {
  calculateDaysOverdue,
  getAgeingBucket,
  categorizeInstalmentAgeing,
  aggregateAgeingSummary
} = require('../src/domain/ageing');

const { calculateProRataRefund } = require('../src/domain/refund');
const { calculateRuleBasedRiskScore } = require('../src/domain/risk');

describe('Pure Domain Logic Unit Tests', () => {
  const REF_DATE = new Date('2026-11-02T00:00:00.000Z');

  describe('balance.js', () => {
    test('calculateInstalmentBalance computes remaining balance in integer paise', () => {
      // 30,000 INR = 3,000,000 paise
      expect(calculateInstalmentBalance(3000000, 1500000)).toBe(1500000);
      expect(calculateInstalmentBalance(3000000, 3000000)).toBe(0);
      expect(calculateInstalmentBalance(3000000, 0)).toBe(3000000);
      expect(calculateInstalmentBalance(3000000, 3500000)).toBe(0); // Never negative
    });

    test('calculateInstalmentBalance applies discount properly', () => {
      // 30,000 INR with 5,000 INR discount, 10,000 paid -> 15,000 remaining
      expect(calculateInstalmentBalance(3000000, 1000000, 500000)).toBe(1500000);
    });

    test('calculateInstalmentBalance throws TypeError on invalid types', () => {
      expect(() => calculateInstalmentBalance('30000', 0)).toThrow(TypeError);
      expect(() => calculateInstalmentBalance(30000, '0')).toThrow(TypeError);
    });

    test('deriveInstalmentStatus correctly derives status without mutating DB', () => {
      const pastDue = new Date('2026-10-10T00:00:00.000Z');
      const futureDue = new Date('2026-11-15T00:00:00.000Z');

      // Fully paid
      expect(deriveInstalmentStatus(3000000, 3000000, pastDue, REF_DATE)).toBe('PAID');

      // Unpaid past due (OVERDUE)
      expect(deriveInstalmentStatus(3000000, 0, pastDue, REF_DATE)).toBe('OVERDUE');

      // Unpaid future due (PENDING)
      expect(deriveInstalmentStatus(4000000, 0, futureDue, REF_DATE)).toBe('PENDING');

      // Partially paid past due
      expect(deriveInstalmentStatus(3000000, 1500000, pastDue, REF_DATE)).toBe('PARTIALLY_PAID_OVERDUE');

      // Partially paid future due
      expect(deriveInstalmentStatus(3000000, 1500000, futureDue, REF_DATE)).toBe('PARTIALLY_PAID');
    });

    test('calculateStudentTotals calculates ledger summary correctly', () => {
      const instalments = [
        { amountPaise: 3000000, paidPaise: 3000000 },
        { amountPaise: 3000000, paidPaise: 1500000 },
        { amountPaise: 4000000, paidPaise: 0 }
      ];

      const totals = calculateStudentTotals(instalments, 500000);
      expect(totals.totalBilledPaise).toBe(10000000); // 1,00,000 INR
      expect(totals.discountPaise).toBe(500000);
      expect(totals.effectiveBilledPaise).toBe(9500000);
      expect(totals.totalPaidPaise).toBe(4500000);
      expect(totals.totalBalancePaise).toBe(5000000);
      expect(totals.isFullyPaid).toBe(false);
    });

    test('getNextPayableInstalment selects earliest unpaid instalment', () => {
      const instalments = [
        { id: 1, dueDate: '2026-10-10', amountPaise: 3000000, paidPaise: 3000000 },
        { id: 2, dueDate: '2026-11-10', amountPaise: 3000000, paidPaise: 1000000 },
        { id: 3, dueDate: '2026-12-10', amountPaise: 3000000, paidPaise: 0 }
      ];

      const next = getNextPayableInstalment(instalments, REF_DATE);
      expect(next).not.toBeNull();
      expect(next.instalment.id).toBe(2);
      expect(next.remainingBalancePaise).toBe(2000000);

      // When all are paid
      const allPaid = instalments.map(i => ({ ...i, paidPaise: i.amountPaise }));
      expect(getNextPayableInstalment(allPaid, REF_DATE)).toBeNull();
    });
  });

  describe('ageing.js', () => {
    test('calculateDaysOverdue accurately measures calendar days difference', () => {
      // Due 2026-10-10 vs Ref 2026-11-02 -> 23 days overdue
      const due23DaysAgo = new Date('2026-10-10T00:00:00.000Z');
      expect(calculateDaysOverdue(due23DaysAgo, REF_DATE)).toBe(23);

      // Due on reference date -> 0 days overdue
      expect(calculateDaysOverdue(REF_DATE, REF_DATE)).toBe(0);

      // Due in 13 days (2026-11-15) -> -13 days overdue
      const due13DaysLater = new Date('2026-11-15T00:00:00.000Z');
      expect(calculateDaysOverdue(due13DaysLater, REF_DATE)).toBe(-13);
    });

    test('getAgeingBucket maps to the 4 standard financial buckets', () => {
      expect(getAgeingBucket(0)).toBe('CURRENT');
      expect(getAgeingBucket(-5)).toBe('CURRENT');
      expect(getAgeingBucket(1)).toBe('OVERDUE_1_30');
      expect(getAgeingBucket(23)).toBe('OVERDUE_1_30');
      expect(getAgeingBucket(30)).toBe('OVERDUE_1_30');
      expect(getAgeingBucket(31)).toBe('OVERDUE_31_60');
      expect(getAgeingBucket(60)).toBe('OVERDUE_31_60');
      expect(getAgeingBucket(61)).toBe('OVERDUE_60_PLUS');
      expect(getAgeingBucket(90)).toBe('OVERDUE_60_PLUS');
    });

    test('categorizeInstalmentAgeing handles paid and unpaid instalments', () => {
      const paid = { amountPaise: 3000000, paidPaise: 3000000, dueDate: '2026-10-10' };
      expect(categorizeInstalmentAgeing(paid, REF_DATE)).toEqual({
        daysOverdue: 0,
        bucket: 'PAID',
        balancePaise: 0
      });

      const overdue23 = { amountPaise: 3000000, paidPaise: 1500000, dueDate: '2026-10-10' };
      expect(categorizeInstalmentAgeing(overdue23, REF_DATE)).toEqual({
        daysOverdue: 23,
        bucket: 'OVERDUE_1_30',
        balancePaise: 1500000
      });
    });

    test('aggregateAgeingSummary aggregates bucket counts and balances', () => {
      const sampleInstalments = [
        { amountPaise: 3000000, paidPaise: 3000000, dueDate: '2026-10-10' }, // PAID
        { amountPaise: 3000000, paidPaise: 1500000, dueDate: '2026-10-10' }, // OVERDUE_1_30 (23 days)
        { amountPaise: 4000000, paidPaise: 0, dueDate: '2026-11-15' },       // CURRENT (-13 days)
        { amountPaise: 3000000, paidPaise: 0, dueDate: '2026-09-01' },       // OVERDUE_60_PLUS (62 days)
        { amountPaise: 3000000, paidPaise: 0, dueDate: '2026-09-20' }        // OVERDUE_31_60 (43 days)
      ];

      const summary = aggregateAgeingSummary(sampleInstalments, REF_DATE);
      expect(summary.CURRENT.count).toBe(1);
      expect(summary.CURRENT.balancePaise).toBe(4000000);
      expect(summary.OVERDUE_1_30.count).toBe(1);
      expect(summary.OVERDUE_1_30.balancePaise).toBe(1500000);
      expect(summary.OVERDUE_31_60.count).toBe(1);
      expect(summary.OVERDUE_31_60.balancePaise).toBe(3000000);
      expect(summary.OVERDUE_60_PLUS.count).toBe(1);
      expect(summary.OVERDUE_60_PLUS.balancePaise).toBe(3000000);
      expect(summary.PAID.count).toBe(1);
      expect(summary.totalOutstandingPaise).toBe(11500000); // 1,15,000 INR
    });
  });

  describe('refund.js (assumed refund policy)', () => {
    test('calculateProRataRefund divides enrolled days by total days accurately', () => {
      // Course from 2026-07-01 to 2027-04-30 (303 days approx)
      // Total course fee: 120,000 INR = 12,000,000 paise
      // Paid so far: 60,000 INR = 6,000,000 paise
      // Exit date: 2026-10-01
      const refund = calculateProRataRefund({
        totalCourseFeePaise: 12000000,
        paidPaise: 6000000,
        courseStartDate: new Date('2026-07-01'),
        courseEndDate: new Date('2027-04-30'),
        exitDate: new Date('2026-10-01'),
        adminFeePaise: 500000,   // ₹5,000
        materialFeePaise: 300000 // ₹3,000
      });

      expect(refund.policyLabel).toBe('assumed refund policy');
      expect(refund.totalDays).toBe(303);
      expect(refund.enrolledDays).toBe(92);

      // (92 / 303) * 12,000,000 = 3,643,564 paise
      expect(refund.instructionalDeductionPaise).toBe(3643564);

      // net = 6,000,000 - 500,000 - 300,000 - 3,643,564 = 1,556,436 paise
      expect(refund.netRefundPaise).toBe(1556436);

      // 10-day settlement deadline: 2026-10-01 + 10 days = 2026-10-11
      const expectedDeadline = new Date(new Date('2026-10-01').getTime() + 10 * 24 * 60 * 60 * 1000);
      expect(refund.settlementDeadline.toISOString()).toBe(expectedDeadline.toISOString());

      // GST reversal breakdown
      expect(refund.gstReversal.baseRefundPaise).toBe(Math.round(1556436 / 1.18));
      expect(refund.gstReversal.totalGstPaise).toBe(1556436 - refund.gstReversal.baseRefundPaise);
    });

    test('handles exit before batch start gracefully (enrolledDays = 0)', () => {
      const refund = calculateProRataRefund({
        totalCourseFeePaise: 12000000,
        paidPaise: 3000000,
        courseStartDate: new Date('2026-08-01'),
        courseEndDate: new Date('2027-04-30'),
        exitDate: new Date('2026-07-20'),
        adminFeePaise: 500000,
        materialFeePaise: 0 // No material distributed yet
      });

      expect(refund.enrolledDays).toBe(0);
      expect(refund.instructionalDeductionPaise).toBe(0);
      // Net = 3,000,000 - 500,000 = 2,500,000 paise
      expect(refund.netRefundPaise).toBe(2500000);
    });

    test('throws Error when courseEndDate <= courseStartDate', () => {
      expect(() => {
        calculateProRataRefund({
          totalCourseFeePaise: 12000000,
          paidPaise: 3000000,
          courseStartDate: new Date('2026-08-01'),
          courseEndDate: new Date('2026-08-01'),
          exitDate: new Date('2026-08-01')
        });
      }).toThrow('courseEndDate must be after courseStartDate');
    });

    test('throws TypeError on invalid types', () => {
      expect(() => {
        calculateProRataRefund({
          totalCourseFeePaise: 'invalid',
          paidPaise: 3000000,
          courseStartDate: new Date('2026-08-01'),
          courseEndDate: new Date('2026-10-01'),
          exitDate: new Date('2026-09-01')
        });
      }).toThrow(TypeError);
    });
  });

  describe('risk.js (rule-based risk score)', () => {
    test('calculateRuleBasedRiskScore returns LOW risk when metrics are healthy', () => {
      const result = calculateRuleBasedRiskScore({
        daysOverdue: 0,
        attendancePercentage: 92,
        scoreDropPercentage: 5
      });

      expect(result.score).toBe(0);
      expect(result.level).toBe('LOW');
      expect(result.requiresCounsellorAction).toBe(false);
      expect(result.factors).toHaveLength(0);
    });

    test('calculates MEDIUM risk for moderate delinquency & attendance dip', () => {
      const result = calculateRuleBasedRiskScore({
        daysOverdue: 18,            // +30 pts (overdue > 15)
        attendancePercentage: 70,   // +25 pts (attendance < 75%)
        scoreDropPercentage: 10     // +0 pts
      });

      expect(result.score).toBe(55);
      expect(result.level).toBe('MEDIUM');
      expect(result.requiresCounsellorAction).toBe(false);
      expect(result.factors).toHaveLength(2);
    });

    test('calculates HIGH risk and triggers counsellor action when score >= 60', () => {
      const result = calculateRuleBasedRiskScore({
        daysOverdue: 35,            // +50 pts (overdue > 30)
        attendancePercentage: 55,   // +35 pts (attendance < 60%)
        scoreDropPercentage: 25     // +15 pts (drop > 20%)
      });

      // 50 + 35 + 15 = 100
      expect(result.score).toBe(100);
      expect(result.level).toBe('HIGH');
      expect(result.requiresCounsellorAction).toBe(true);
      expect(result.factors).toHaveLength(3);
    });

    test('caps score at exactly 100 points', () => {
      const result = calculateRuleBasedRiskScore({
        daysOverdue: 60,
        attendancePercentage: 40,
        scoreDropPercentage: 35
      });

      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBe(100);
    });
  });
});
