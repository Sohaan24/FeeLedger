/**
 * Pure domain logic for ageing buckets and days overdue.
 */

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

function calculateDaysOverdue(dueDate, referenceDate) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);

  // Normalize to UTC calendar dates to avoid daylight/timezone quirks
  const refUtc = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());

  const diffDays = Math.floor((refUtc - dueUtc) / MILLIS_PER_DAY);
  return diffDays;
}

function getAgeingBucket(daysOverdue) {
  if (daysOverdue <= 0) {
    return 'CURRENT';
  }
  if (daysOverdue <= 30) {
    return 'OVERDUE_1_30';
  }
  if (daysOverdue <= 60) {
    return 'OVERDUE_31_60';
  }
  return 'OVERDUE_60_PLUS';
}

function categorizeInstalmentAgeing(instalment, referenceDate) {
  const amountPaise = instalment.amountPaise || 0;
  const paidPaise = instalment.paidPaise || 0;
  const balancePaise = Math.max(0, amountPaise - paidPaise);

  if (balancePaise === 0) {
    return {
      daysOverdue: 0,
      bucket: 'PAID',
      balancePaise: 0
    };
  }

  const daysOverdue = calculateDaysOverdue(instalment.dueDate, referenceDate);
  const bucket = getAgeingBucket(daysOverdue);

  return {
    daysOverdue: Math.max(0, daysOverdue),
    bucket,
    balancePaise
  };
}

function aggregateAgeingSummary(instalments = [], referenceDate) {
  const summary = {
    CURRENT: { count: 0, balancePaise: 0 },
    OVERDUE_1_30: { count: 0, balancePaise: 0 },
    OVERDUE_31_60: { count: 0, balancePaise: 0 },
    OVERDUE_60_PLUS: { count: 0, balancePaise: 0 },
    PAID: { count: 0, balancePaise: 0 },
    totalOutstandingPaise: 0
  };

  for (const inst of instalments) {
    const { bucket, balancePaise } = categorizeInstalmentAgeing(inst, referenceDate);
    if (summary[bucket]) {
      summary[bucket].count += 1;
      summary[bucket].balancePaise += balancePaise;
    }
    if (bucket !== 'PAID') {
      summary.totalOutstandingPaise += balancePaise;
    }
  }

  return summary;
}

module.exports = {
  calculateDaysOverdue,
  getAgeingBucket,
  categorizeInstalmentAgeing,
  aggregateAgeingSummary
};
