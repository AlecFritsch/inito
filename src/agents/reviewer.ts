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
Return ONLY valid JSON, no markdown:
{"summary": "...", "issues": [], "suggestions": [], "risks": [], "overallAssessment": "approve", "confidence": 85}

Valid assessments: approve, request_changes, needs_discussion
Confidence: 0-100 integer
Keep all text SHORT and simple. No special characters.`;

  return askJson<ReviewResult>(prompt, 'Return ONLY valid JSON. No explanations.');
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

  const safeUpper = (value: unknown, fallback: string) => {
    if (typeof value === 'string' && value.length > 0) {
      return value.toUpperCase();
    }
    return fallback;
  };

  const overall = typeof review.overallAssessment === 'string' ? review.overallAssessment : 'needs_discussion';
  const overallLabel = safeUpper(overall.replace('_', ' '), 'NEEDS DISCUSSION');
  const overallEmoji = assessmentEmoji[overall as keyof typeof assessmentEmoji] || '💬';
  const issues = Array.isArray(review.issues) ? review.issues : [];
  const suggestions = Array.isArray(review.suggestions) ? review.suggestions : [];
  const risks = Array.isArray(review.risks) ? review.risks : [];

  let output = `## Self-Review

### Summary
${review.summary || 'No summary provided.'}

### Overall Assessment
${overallEmoji} **${overallLabel}**

### Confidence Score
**${review.confidence}%**

`;

  if (issues.length > 0) {
    output += `### Issues Found\n`;
    for (const issue of issues) {
      const issueSeverity = typeof issue.severity === 'string' ? issue.severity : 'low';
      const issueEmoji = severityEmoji[issueSeverity as keyof typeof severityEmoji] || '⚪';
      output += `${issueEmoji} **[${safeUpper(issueSeverity, 'LOW')}]**`;
      if (issue.file) output += ` \`${issue.file}\``;
      if (issue.line) output += `:${issue.line}`;
      output += `\n   ${issue.message}\n\n`;
    }
  }

  if (suggestions.length > 0) {
    output += `### Suggestions\n`;
    for (const suggestion of suggestions) {
      const suggestionSeverity = typeof suggestion.severity === 'string' ? suggestion.severity : 'low';
      const suggestionEmoji = severityEmoji[suggestionSeverity as keyof typeof severityEmoji] || '⚪';
      output += `${suggestionEmoji} `;
      if (suggestion.file) output += `\`${suggestion.file}\`: `;
      output += `${suggestion.message}\n\n`;
    }
  }

  if (risks.length > 0) {
    output += `### Potential Risks\n`;
    for (const risk of risks) {
      const riskSeverity = typeof risk.severity === 'string' ? risk.severity : 'low';
      const riskEmoji = severityEmoji[riskSeverity as keyof typeof severityEmoji] || '⚪';
      output += `${riskEmoji} **[${safeUpper(riskSeverity, 'LOW')}]** ${risk.message}\n\n`;
    }
  }

  if (issues.length === 0 && suggestions.length === 0 && risks.length === 0) {
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
