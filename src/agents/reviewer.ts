import { reviewCode, askJson } from '../gemini.js';
import { TaskResult } from './editor.js';
import { TestResults, LintResults } from './tester.js';

/**
 * Self-review result
 */
export interface ReviewResult {
  summary: string;
  issues: ReviewItem[];
  suggestions: ReviewItem[];
  risks: ReviewItem[];
  overallAssessment: 'approve' | 'request_changes' | 'needs_discussion';
  confidence: number;
}

/**
 * Individual review item
 */
export interface ReviewItem {
  severity: 'low' | 'medium' | 'high' | 'critical';
  file?: string;
  line?: number;
  message: string;
}

/**
 * Perform self-review of the changes
 */
export async function selfReview(
  taskResults: TaskResult[],
  testResults: TestResults,
  lintResults: LintResults,
  issueContext: { title: string; body: string }
): Promise<ReviewResult> {
  // Combine all diffs
  const combinedDiff = taskResults
    .filter(r => r.diff)
    .map(r => r.diff)
    .join('\n\n');

  if (!combinedDiff) {
    return {
      summary: 'No changes to review',
      issues: [],
      suggestions: [],
      risks: [],
      overallAssessment: 'approve',
      confidence: 100
    };
  }

  const prompt = `You are an expert code reviewer performing a thorough review of AI-generated code changes.

## Original Issue
**Title:** ${issueContext.title}
**Description:** ${issueContext.body}

## Code Changes
\`\`\`diff
${combinedDiff}
\`\`\`

## Test Results
- Tests Ran: ${testResults.ran}
- Tests Passed: ${testResults.passed}
- Pass Rate: ${testResults.pass_rate.toFixed(1)}%
- Total Tests: ${testResults.total}
${testResults.error ? `- Error: ${testResults.error}` : ''}

## Lint Results
- Lint Passed: ${lintResults.passed}
- Errors: ${lintResults.errors}
- Warnings: ${lintResults.warnings}

## Review Instructions
Perform a comprehensive code review. Consider:
1. Does the change correctly address the issue?
2. Are there any bugs or logical errors?
3. Are edge cases handled?
4. Is the code style consistent?
5. Are there potential security issues?
6. Could this change cause regressions?
7. Is the test coverage adequate?

## Output Format
Respond with a JSON object:
{
  "summary": "Brief summary of the review findings",
  "issues": [
    {"severity": "low|medium|high|critical", "file": "path/to/file", "line": 42, "message": "Description"}
  ],
  "suggestions": [
    {"severity": "low|medium|high", "file": "path/to/file", "message": "Suggestion"}
  ],
  "risks": [
    {"severity": "low|medium|high|critical", "message": "Risk description"}
  ],
  "overallAssessment": "approve|request_changes|needs_discussion",
  "confidence": 85
}

Be critical but fair. The confidence score (0-100) reflects how confident you are that:
- The change correctly solves the issue
- The code is production-ready
- No regressions will occur`;

  return askJson<ReviewResult>(prompt);
}

/**
 * Format review result as markdown
 */
export function formatReviewResult(review: ReviewResult): string {
  const assessmentEmoji = {
    approve: '✅',
    request_changes: '⚠️',
    needs_discussion: '💬'
  };

  const severityEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴'
  };

  let output = `## Self-Review

### Summary
${review.summary}

### Overall Assessment
${assessmentEmoji[review.overallAssessment]} **${review.overallAssessment.replace('_', ' ').toUpperCase()}**

### Confidence Score
**${review.confidence}%**

`;

  if (review.issues.length > 0) {
    output += `### Issues Found\n`;
    for (const issue of review.issues) {
      output += `${severityEmoji[issue.severity]} **[${issue.severity.toUpperCase()}]**`;
      if (issue.file) output += ` \`${issue.file}\``;
      if (issue.line) output += `:${issue.line}`;
      output += `\n   ${issue.message}\n\n`;
    }
  }

  if (review.suggestions.length > 0) {
    output += `### Suggestions\n`;
    for (const suggestion of review.suggestions) {
      output += `${severityEmoji[suggestion.severity]} `;
      if (suggestion.file) output += `\`${suggestion.file}\`: `;
      output += `${suggestion.message}\n\n`;
    }
  }

  if (review.risks.length > 0) {
    output += `### Potential Risks\n`;
    for (const risk of review.risks) {
      output += `${severityEmoji[risk.severity]} **[${risk.severity.toUpperCase()}]** ${risk.message}\n\n`;
    }
  }

  if (review.issues.length === 0 && review.suggestions.length === 0 && review.risks.length === 0) {
    output += `\n✨ No issues, suggestions, or risks identified. Code looks good!\n`;
  }

  return output;
}

/**
 * Calculate overall confidence score from multiple factors
 */
export function calculateReviewConfidence(
  review: ReviewResult,
  testResults: TestResults,
  lintResults: LintResults
): number {
  let score = review.confidence;

  // Adjust based on test results
  if (!testResults.ran) {
    score -= 20;
  } else if (!testResults.passed) {
    score -= 30;
  } else if (testResults.pass_rate < 100) {
    score -= (100 - testResults.pass_rate) * 0.2;
  }

  // Adjust based on lint results
  if (!lintResults.passed) {
    score -= Math.min(20, lintResults.errors * 5);
  }

  // Adjust based on issues severity
  for (const issue of review.issues) {
    switch (issue.severity) {
      case 'critical': score -= 25; break;
      case 'high': score -= 15; break;
      case 'medium': score -= 5; break;
      case 'low': score -= 2; break;
    }
  }

  // Adjust based on risks
  for (const risk of review.risks) {
    switch (risk.severity) {
      case 'critical': score -= 20; break;
      case 'high': score -= 10; break;
      case 'medium': score -= 5; break;
      case 'low': score -= 2; break;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
