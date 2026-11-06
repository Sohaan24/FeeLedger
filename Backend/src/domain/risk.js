/**
 * Pure domain logic for rule-based dropout-risk scoring.
 * Deterministic, transparent, and capped at 100.
 */

function calculateRuleBasedRiskScore({
  daysOverdue = 0,
  attendancePercentage = 100,
  scoreDropPercentage = 0
}) {
  let score = 0;
  const factors = [];

  // Fee delinquency factor
  if (daysOverdue > 30) {
    score += 50;
    factors.push({
      factor: 'FEE_OVERDUE_30_PLUS',
      points: 50,
      description: `Fees overdue by ${daysOverdue} days (> 30 days)`
    });
  } else if (daysOverdue > 15) {
    score += 30;
    factors.push({
      factor: 'FEE_OVERDUE_15_PLUS',
      points: 30,
      description: `Fees overdue by ${daysOverdue} days (> 15 days)`
    });
  }

  // Attendance trend factor
  if (attendancePercentage < 60) {
    score += 35;
    factors.push({
      factor: 'ATTENDANCE_CRITICAL',
      points: 35,
      description: `Attendance at ${attendancePercentage}% (< 60%)`
    });
  } else if (attendancePercentage < 75) {
    score += 25;
    factors.push({
      factor: 'ATTENDANCE_WARNING',
      points: 25,
      description: `Attendance at ${attendancePercentage}% (< 75%)`
    });
  }

  // Academic trend factor (test score decline)
  if (scoreDropPercentage > 20) {
    score += 15;
    factors.push({
      factor: 'TEST_SCORE_DROP',
      points: 15,
      description: `Recent test score dropped by ${scoreDropPercentage}% (> 20%)`
    });
  }

  // Cap score at 100
  const finalScore = Math.min(100, score);

  let level = 'LOW';
  if (finalScore >= 60) {
    level = 'HIGH';
  } else if (finalScore >= 40) {
    level = 'MEDIUM';
  }

  return {
    score: finalScore,
    level,
    factors,
    requiresCounsellorAction: level === 'HIGH'
  };
}

module.exports = {
  calculateRuleBasedRiskScore
};
