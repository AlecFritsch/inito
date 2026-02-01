import { HavocConfig } from './config.js';
import { TestResults, LintResults } from './agents/tester.js';
import { ReviewResult } from './agents/reviewer.js';

/**
 * Policy gate check result
 */
export interface PolicyResult {
  passed: boolean;
  gates: GateResult[];
  blockers: string[];
  warnings: string[];
}

/**
 * Individual gate result
 */
export interface GateResult {
  name: string;
  passed: boolean;
  required: boolean;
  actual: string | number;
  threshold: string | number;
  message: string;
}

/**
 * Check all policy gates
 */
export function checkPolicyGates(
  config: HavocConfig,
  confidenceScore: number,
  testResults: TestResults,
  lintResults: LintResults,
  review: ReviewResult
): PolicyResult {
  const gates: GateResult[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Gate 1: Minimum confidence score
  const confidenceGate = checkConfidenceGate(config, confidenceScore);
  gates.push(confidenceGate);
  if (!confidenceGate.passed) {
    blockers.push(confidenceGate.message);
  }

  // Gate 2: Minimum test pass rate
  const testGate = checkTestGate(config, testResults);
  gates.push(testGate);
  if (!testGate.passed) {
    blockers.push(testGate.message);
  }

  // Gate 3: Tests must run
  const testsRanGate = checkTestsRanGate(testResults);
  gates.push(testsRanGate);
  if (!testsRanGate.passed) {
    warnings.push(testsRanGate.message);
  }

  // Gate 4: Lint must pass (warning only)
  const lintGate = checkLintGate(lintResults);
  gates.push(lintGate);
  if (!lintGate.passed) {
    warnings.push(lintGate.message);
  }

  // Gate 5: No critical issues in review
  const reviewGate = checkReviewGate(review);
  gates.push(reviewGate);
  if (!reviewGate.passed) {
    blockers.push(reviewGate.message);
  }

  // Gate 6: Review assessment
  const assessmentGate = checkAssessmentGate(review);
  gates.push(assessmentGate);
  if (!assessmentGate.passed) {
    warnings.push(assessmentGate.message);
  }

  return {
    passed: blockers.length === 0,
    gates,
    blockers,
    warnings
  };
}

/**
 * Check confidence score gate
 */
function checkConfidenceGate(config: HavocConfig, score: number): GateResult {
  const passed = score >= config.min_confidence;
  return {
    name: 'Minimum Confidence',
    passed,
    required: true,
    actual: score,
    threshold: config.min_confidence,
    message: passed 
      ? `Confidence score ${score}% meets threshold of ${config.min_confidence}%`
      : `Confidence score ${score}% is below threshold of ${config.min_confidence}%`
  };
}

/**
 * Check test pass rate gate
 */
function checkTestGate(config: HavocConfig, results: TestResults): GateResult {
  if (!results.ran) {
    return {
      name: 'Test Pass Rate',
      passed: true, // Skip if tests didn't run
      required: true,
      actual: 'N/A',
      threshold: config.min_test_pass_rate,
      message: 'Tests did not run (gate skipped)'
    };
  }

  const passed = results.pass_rate >= config.min_test_pass_rate;
  return {
    name: 'Test Pass Rate',
    passed,
    required: true,
    actual: results.pass_rate,
    threshold: config.min_test_pass_rate,
    message: passed
      ? `Test pass rate ${results.pass_rate.toFixed(1)}% meets threshold of ${config.min_test_pass_rate}%`
      : `Test pass rate ${results.pass_rate.toFixed(1)}% is below threshold of ${config.min_test_pass_rate}%`
  };
}

/**
 * Check if tests ran
 */
function checkTestsRanGate(results: TestResults): GateResult {
  return {
    name: 'Tests Executed',
    passed: results.ran,
    required: false,
    actual: results.ran ? 'Yes' : 'No',
    threshold: 'Yes',
    message: results.ran
      ? `Tests executed successfully (${results.total} tests)`
      : 'Tests did not execute'
  };
}

/**
 * Check lint gate
 */
function checkLintGate(results: LintResults): GateResult {
  return {
    name: 'Lint Clean',
    passed: results.passed,
    required: false,
    actual: results.errors,
    threshold: 0,
    message: results.passed
      ? 'No lint errors'
      : `${results.errors} lint errors found`
  };
}

/**
 * Check review for critical issues
 */
function checkReviewGate(review: ReviewResult): GateResult {
  const criticalIssues = review.issues.filter(i => i.severity === 'critical');
  const passed = criticalIssues.length === 0;
  
  return {
    name: 'No Critical Issues',
    passed,
    required: true,
    actual: criticalIssues.length,
    threshold: 0,
    message: passed
      ? 'No critical issues identified'
      : `${criticalIssues.length} critical issue(s) found: ${criticalIssues.map(i => i.message).join('; ')}`
  };
}

/**
 * Check review assessment
 */
function checkAssessmentGate(review: ReviewResult): GateResult {
  const passed = review.overallAssessment !== 'request_changes';
  
  return {
    name: 'Review Assessment',
    passed,
    required: false,
    actual: review.overallAssessment,
    threshold: 'approve or needs_discussion',
    message: passed
      ? `Review assessment: ${review.overallAssessment}`
      : 'Self-review requested changes'
  };
}

/**
 * Format policy result as markdown
 */
export function formatPolicyResult(result: PolicyResult): string {
  const overallIcon = result.passed ? '✅' : '❌';
  
  let output = `## Policy Gates

${overallIcon} **${result.passed ? 'ALL GATES PASSED' : 'GATES FAILED'}**

### Gate Results

| Gate | Status | Actual | Threshold |
|------|--------|--------|-----------|
${result.gates.map(g => {
  const icon = g.passed ? '✅' : (g.required ? '❌' : '⚠️');
  return `| ${g.name} | ${icon} | ${g.actual} | ${g.threshold} |`;
}).join('\n')}

`;

  if (result.blockers.length > 0) {
    output += `### Blockers
${result.blockers.map(b => `- ❌ ${b}`).join('\n')}

`;
  }

  if (result.warnings.length > 0) {
    output += `### Warnings
${result.warnings.map(w => `- ⚠️ ${w}`).join('\n')}

`;
  }

  return output;
}

/**
 * Generate a summary message for the policy result
 */
export function getPolicySummary(result: PolicyResult): string {
  if (result.passed) {
    if (result.warnings.length > 0) {
      return `All required policy gates passed with ${result.warnings.length} warning(s)`;
    }
    return 'All policy gates passed';
  }
  
  return `Policy gates failed: ${result.blockers.join('; ')}`;
}
