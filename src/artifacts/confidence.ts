import { TaskResult } from '../agents/editor.js';
import { TestResults, LintResults } from '../agents/tester.js';
import { ReviewResult } from '../agents/reviewer.js';
import { Plan } from '../agents/planner.js';
import { ConfidenceBreakdown } from './intent-card.js';

/**
 * Weights for confidence calculation
 */
const WEIGHTS = {
  testsPassing: 0.30,
  lintClean: 0.10,
  changeComplexity: 0.20,
  dependencyRisk: 0.15,
  behaviorRisk: 0.15,
  selfReview: 0.10
};

/**
 * Calculate the overall confidence score
 */
export function calculateConfidenceScore(
  taskResults: TaskResult[],
  testResults: TestResults,
  lintResults: LintResults,
  review: ReviewResult,
  plan: Plan
): { score: number; breakdown: ConfidenceBreakdown } {
  // Calculate individual scores
  const testsPassing = calculateTestScore(testResults);
  const lintClean = calculateLintScore(lintResults);
  const changeComplexity = calculateComplexityScore(taskResults, plan);
  const dependencyRisk = calculateDependencyScore(plan);
  const behaviorRisk = calculateBehaviorScore(plan, review);
  const selfReview = calculateSelfReviewScore(review);

  // Calculate weighted score
  const score = Math.round(
    testsPassing * WEIGHTS.testsPassing +
    lintClean * WEIGHTS.lintClean +
    changeComplexity * WEIGHTS.changeComplexity +
    dependencyRisk * WEIGHTS.dependencyRisk +
    behaviorRisk * WEIGHTS.behaviorRisk +
    selfReview * WEIGHTS.selfReview
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: {
      testsPassing: Math.round(testsPassing),
      lintClean: Math.round(lintClean),
      changeComplexity: Math.round(changeComplexity),
      dependencyRisk: Math.round(dependencyRisk),
      behaviorRisk: Math.round(behaviorRisk),
      selfReview: Math.round(selfReview)
    }
  };
}

/**
 * Calculate test passing score
 */
function calculateTestScore(results: TestResults): number {
  if (!results.ran) {
    return 50; // Neutral if tests didn't run
  }
  
  if (!results.passed) {
    return Math.max(0, results.pass_rate - 20);
  }
  
  return results.pass_rate;
}

/**
 * Calculate lint score
 */
function calculateLintScore(results: LintResults): number {
  if (!results.ran) {
    return 70; // Assume OK if lint didn't run
  }
  
  if (results.passed) {
    return 100;
  }
  
  // Deduct for errors and warnings
  const errorPenalty = Math.min(50, results.errors * 10);
  const warningPenalty = Math.min(20, results.warnings * 2);
  
  return Math.max(0, 100 - errorPenalty - warningPenalty);
}

/**
 * Calculate complexity score (simpler is better)
 */
function calculateComplexityScore(taskResults: TaskResult[], plan: Plan): number {
  const successfulTasks = taskResults.filter(t => t.success).length;
  const totalTasks = plan.tasks.length;
  
  // Start with task success rate
  let score = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 50;
  
  // Penalize for too many tasks (complex changes)
  if (totalTasks > 10) {
    score -= (totalTasks - 10) * 2;
  }
  
  // Penalize for many file changes
  const fileChanges = taskResults.filter(t => t.success && t.action !== 'skipped').length;
  if (fileChanges > 5) {
    score -= (fileChanges - 5) * 3;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate dependency risk score
 */
function calculateDependencyScore(plan: Plan): number {
  let score = 100;
  
  // Check for new dependencies in tasks
  for (const task of plan.tasks) {
    const details = task.details.toLowerCase();
    
    if (details.includes('npm install') || details.includes('add dependency')) {
      score -= 15;
    }
    
    if (details.includes('external api') || details.includes('third-party')) {
      score -= 10;
    }
  }
  
  // Check risks mentioned in plan
  for (const risk of plan.risks) {
    if (risk.toLowerCase().includes('dependency') || risk.toLowerCase().includes('package')) {
      score -= 10;
    }
  }
  
  return Math.max(0, score);
}

/**
 * Calculate behavior risk score
 */
function calculateBehaviorScore(plan: Plan, review: ReviewResult): number {
  let score = 100;
  
  // Deduct for high-risk areas in plan
  for (const task of plan.tasks) {
    const file = task.file.toLowerCase();
    const details = task.details.toLowerCase();
    
    // Database changes
    if (file.includes('migration') || details.includes('database') || details.includes('schema')) {
      score -= 15;
    }
    
    // Auth/security changes
    if (file.includes('auth') || details.includes('security') || details.includes('password')) {
      score -= 10;
    }
    
    // Config changes
    if (file.includes('config') || file.includes('.env')) {
      score -= 5;
    }
  }
  
  // Deduct for risks identified in review
  for (const risk of review.risks) {
    switch (risk.severity) {
      case 'critical': score -= 25; break;
      case 'high': score -= 15; break;
      case 'medium': score -= 8; break;
      case 'low': score -= 3; break;
    }
  }
  
  return Math.max(0, score);
}

/**
 * Calculate self-review score
 */
function calculateSelfReviewScore(review: ReviewResult): number {
  // Start with the review's own confidence
  let score = review.confidence;
  
  // Adjust based on assessment
  if (review.overallAssessment === 'approve') {
    score = Math.max(score, 70);
  } else if (review.overallAssessment === 'request_changes') {
    score = Math.min(score, 50);
  } else if (review.overallAssessment === 'needs_discussion') {
    score = Math.min(score, 60);
  }
  
  // Deduct for issues
  for (const issue of review.issues) {
    switch (issue.severity) {
      case 'critical': score -= 30; break;
      case 'high': score -= 20; break;
      case 'medium': score -= 10; break;
      case 'low': score -= 3; break;
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Get confidence level label
 */
export function getConfidenceLevel(score: number): {
  level: 'high' | 'medium' | 'low';
  emoji: string;
  message: string;
} {
  if (score >= 80) {
    return {
      level: 'high',
      emoji: '🟢',
      message: 'High confidence - changes look good and well-tested'
    };
  } else if (score >= 60) {
    return {
      level: 'medium',
      emoji: '🟡',
      message: 'Medium confidence - review recommended before merge'
    };
  } else {
    return {
      level: 'low',
      emoji: '🔴',
      message: 'Low confidence - careful review required'
    };
  }
}

/**
 * Format confidence score as markdown
 */
export function formatConfidenceScore(
  score: number,
  breakdown: ConfidenceBreakdown
): string {
  const { level, emoji, message } = getConfidenceLevel(score);
  
  return `## Confidence Score

${emoji} **${score}%** - ${level.toUpperCase()}

${message}

### Breakdown

| Signal | Score | Weight | Contribution |
|--------|-------|--------|--------------|
| Tests Passing | ${breakdown.testsPassing}% | ${(WEIGHTS.testsPassing * 100).toFixed(0)}% | ${Math.round(breakdown.testsPassing * WEIGHTS.testsPassing)} |
| Lint Clean | ${breakdown.lintClean}% | ${(WEIGHTS.lintClean * 100).toFixed(0)}% | ${Math.round(breakdown.lintClean * WEIGHTS.lintClean)} |
| Change Complexity | ${breakdown.changeComplexity}% | ${(WEIGHTS.changeComplexity * 100).toFixed(0)}% | ${Math.round(breakdown.changeComplexity * WEIGHTS.changeComplexity)} |
| Dependency Risk | ${breakdown.dependencyRisk}% | ${(WEIGHTS.dependencyRisk * 100).toFixed(0)}% | ${Math.round(breakdown.dependencyRisk * WEIGHTS.dependencyRisk)} |
| Behavior Risk | ${breakdown.behaviorRisk}% | ${(WEIGHTS.behaviorRisk * 100).toFixed(0)}% | ${Math.round(breakdown.behaviorRisk * WEIGHTS.behaviorRisk)} |
| Self-Review | ${breakdown.selfReview}% | ${(WEIGHTS.selfReview * 100).toFixed(0)}% | ${Math.round(breakdown.selfReview * WEIGHTS.selfReview)} |
`;
}
