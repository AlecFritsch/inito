import { AnalysisResult } from '../agents/analyzer.js';
import { Plan } from '../agents/planner.js';
import { TaskResult } from '../agents/editor.js';
import { TestResults, LintResults } from '../agents/tester.js';
import { ReviewResult } from '../agents/reviewer.js';

/**
 * Intent Card - the complete explanation of what Havoc did and why
 */
export interface IntentCard {
  runId: string;
  issueNumber: number;
  issueTitle: string;
  issueSummary: string;
  type: string;
  scope: string[];
  assumptions: string[];
  approach: string;
  filesChanged: FileChange[];
  testsAdded: string[];
  riskAssessment: RiskItem[];
  confidenceScore: number;
  confidenceBreakdown: ConfidenceBreakdown;
  selfReviewSummary: string;
  generatedAt: string;
}

/**
 * File change entry
 */
export interface FileChange {
  file: string;
  action: string;
  rationale: string;
}

/**
 * Risk assessment item
 */
export interface RiskItem {
  severity: string;
  description: string;
}

/**
 * Confidence score breakdown
 */
export interface ConfidenceBreakdown {
  testsPassing: number;
  lintClean: number;
  changeComplexity: number;
  dependencyRisk: number;
  behaviorRisk: number;
  selfReview: number;
}

/**
 * Generate an Intent Card from all run artifacts
 */
export function generateIntentCard(
  runId: string,
  issueNumber: number,
  issueTitle: string,
  analysis: AnalysisResult,
  plan: Plan,
  taskResults: TaskResult[],
  testResults: TestResults,
  lintResults: LintResults,
  review: ReviewResult,
  confidenceScore: number,
  breakdown: ConfidenceBreakdown
): IntentCard {
  return {
    runId,
    issueNumber,
    issueTitle,
    issueSummary: analysis.spec.summary,
    type: analysis.spec.type,
    scope: analysis.spec.affectedAreas,
    assumptions: analysis.spec.assumptions,
    approach: plan.approach,
    filesChanged: taskResults
      .filter(r => r.success)
      .map(r => ({
        file: r.file,
        action: r.action,
        rationale: plan.tasks.find(t => t.file === r.file)?.description || 'N/A'
      })),
    testsAdded: taskResults
      .filter(r => r.success && r.action === 'created' && r.file.includes('test'))
      .map(r => r.file),
    riskAssessment: [
      ...plan.risks.map(r => ({ severity: 'medium', description: r })),
      ...review.risks.map(r => ({ severity: r.severity, description: r.message }))
    ],
    confidenceScore,
    confidenceBreakdown: breakdown,
    selfReviewSummary: review.summary,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Format Intent Card as Markdown
 */
export function formatIntentCard(card: IntentCard): string {
  const confidenceEmoji = card.confidenceScore >= 80 ? '🟢' : 
                          card.confidenceScore >= 60 ? '🟡' : '🔴';
  const safeUpper = (value: unknown, fallback: string) => {
    if (typeof value === 'string' && value.length > 0) {
      return value.toUpperCase();
    }
    return fallback;
  };
  const scope = Array.isArray(card.scope) ? card.scope : [];
  const assumptions = Array.isArray(card.assumptions) ? card.assumptions : [];
  const filesChanged = Array.isArray(card.filesChanged) ? card.filesChanged : [];
  const testsAdded = Array.isArray(card.testsAdded) ? card.testsAdded : [];
  const riskAssessment = Array.isArray(card.riskAssessment) ? card.riskAssessment : [];

  return `# 📋 Intent Card

> **Every AI-generated PR deserves an explanation.**

## Issue Summary
**#${card.issueNumber}:** ${card.issueTitle}

${card.issueSummary}

## Change Type
\`${safeUpper(card.type, 'UNKNOWN')}\`

## Scope and Assumptions

### Affected Areas
${scope.length > 0 ? scope.map(s => `- ${s}`).join('\n') : '_No areas listed_'}

### Assumptions
${assumptions.length > 0 ? assumptions.map(a => `- ${a}`).join('\n') : '_No assumptions listed_'}

## Planned Approach
${card.approach}

## Files Changed

| File | Action | Rationale |
|------|--------|-----------|
${filesChanged.length > 0 ? filesChanged.map(f => `| \`${f.file}\` | ${f.action} | ${f.rationale} |`).join('\n') : '| _No files_ | _n/a_ | _n/a_ |'}

## Tests Added
${testsAdded.length > 0 
  ? testsAdded.map(t => `- \`${t}\``).join('\n')
  : '_No new tests added_'}

## Risk Assessment

${riskAssessment.length > 0 
  ? riskAssessment.map(r => {
      const emoji = r.severity === 'critical' ? '🔴' : 
                    r.severity === 'high' ? '🟠' :
                    r.severity === 'medium' ? '🟡' : '🟢';
      return `${emoji} **[${safeUpper(r.severity, 'LOW')}]** ${r.description}`;
    }).join('\n')
  : '✅ No significant risks identified'}

## Confidence Score

${confidenceEmoji} **${card.confidenceScore}%**

| Signal | Score |
|--------|-------|
| Tests Passing | ${card.confidenceBreakdown.testsPassing}% |
| Lint Clean | ${card.confidenceBreakdown.lintClean}% |
| Change Complexity | ${card.confidenceBreakdown.changeComplexity}% |
| Dependency Risk | ${card.confidenceBreakdown.dependencyRisk}% |
| Behavior Risk | ${card.confidenceBreakdown.behaviorRisk}% |
| Self-Review | ${card.confidenceBreakdown.selfReview}% |

## Self-Review Summary
${card.selfReviewSummary}

---

<sub>Generated by [Havoc](https://usehavoc.dev) | Run ID: \`${card.runId}\` | ${card.generatedAt}</sub>
`;
}

/**
 * Generate a short summary for PR title
 */
export function generatePRTitle(card: IntentCard): string {
  const prefix = {
    bug: 'fix',
    feature: 'feat',
    refactor: 'refactor',
    docs: 'docs',
    other: 'chore'
  }[card.type] || 'chore';

  // Clean up the issue title for use in PR
  const cleanTitle = card.issueTitle
    .toLowerCase()
    .replace(/^\[.*?\]\s*/, '') // Remove tags like [BUG]
    .replace(/^(fix|feat|add|update|remove|refactor):\s*/i, '') // Remove existing prefixes
    .trim();

  return `${prefix}: ${cleanTitle} (#${card.issueNumber})`;
}

/**
 * Generate PR body with embedded Intent Card
 */
export function generatePRBody(card: IntentCard, diff: string): string {
  return `## Summary

This PR addresses issue #${card.issueNumber}: **${card.issueTitle}**

${card.issueSummary}

## Changes

${card.filesChanged.map(f => `- **${f.action}** \`${f.file}\`: ${f.rationale}`).join('\n')}

## Test Results

${card.testsAdded.length > 0 ? `### New Tests\n${card.testsAdded.map(t => `- \`${t}\``).join('\n')}` : '_No new tests_'}

## Confidence Score: ${card.confidenceScore}%

<details>
<summary>📋 View Full Intent Card</summary>

${formatIntentCard(card)}

</details>

---

🤖 _This PR was automatically generated by [Havoc](https://usehavoc.dev)_
`;
}
