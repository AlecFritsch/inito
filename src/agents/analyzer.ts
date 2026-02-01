import { askJson } from '../gemini.js';
import { SandboxRunner } from '../sandbox/runner.js';

/**
 * Issue specification extracted by the analyzer
 */
export interface IssueSpec {
  type: 'bug' | 'feature' | 'refactor' | 'docs' | 'other';
  summary: string;
  requirements: string[];
  affectedAreas: string[];
  assumptions: string[];
  outOfScope: string[];
  acceptanceCriteria: string[];
}

/**
 * Codebase context gathered by the analyzer
 */
export interface CodebaseContext {
  language: string;
  framework: string | null;
  testFramework: string | null;
  relevantFiles: string[];
  dependencies: string[];
}

/**
 * Full analysis result
 */
export interface AnalysisResult {
  spec: IssueSpec;
  context: CodebaseContext;
}

/**
 * Analyze an issue and extract a structured specification
 */
export async function analyzeIssue(
  issueTitle: string,
  issueBody: string,
  runner: SandboxRunner
): Promise<AnalysisResult> {
  // Gather codebase context
  const context = await gatherCodebaseContext(runner);
  
  // Analyze the issue with context
  const spec = await extractIssueSpec(issueTitle, issueBody, context);
  
  return { spec, context };
}

/**
 * Gather context about the codebase
 */
async function gatherCodebaseContext(runner: SandboxRunner): Promise<CodebaseContext> {
  // Read package.json if it exists
  const packageJson = await runner.readFile('package.json');
  
  let language = 'unknown';
  let framework: string | null = null;
  let testFramework: string | null = null;
  const dependencies: string[] = [];

  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson);
      language = 'javascript/typescript';
      
      // Detect framework
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps['next']) framework = 'Next.js';
      else if (allDeps['react']) framework = 'React';
      else if (allDeps['vue']) framework = 'Vue';
      else if (allDeps['express']) framework = 'Express';
      else if (allDeps['fastify']) framework = 'Fastify';
      
      // Detect test framework
      if (allDeps['jest']) testFramework = 'Jest';
      else if (allDeps['vitest']) testFramework = 'Vitest';
      else if (allDeps['mocha']) testFramework = 'Mocha';
      
      // Get key dependencies
      dependencies.push(...Object.keys(allDeps || {}).slice(0, 20));
    } catch {
      // Ignore parse errors
    }
  }

  // Check for other languages
  if (await runner.fileExists('go.mod')) {
    language = 'go';
  } else if (await runner.fileExists('Cargo.toml')) {
    language = 'rust';
  } else if (await runner.fileExists('requirements.txt') || await runner.fileExists('pyproject.toml')) {
    language = 'python';
  }

  // Find relevant source files
  const files = await runner.listFiles('.');
  const relevantFiles = files
    .filter(f => !f.includes('node_modules'))
    .filter(f => !f.includes('.git'))
    .slice(0, 50);

  return {
    language,
    framework,
    testFramework,
    relevantFiles,
    dependencies
  };
}

/**
 * Extract a structured specification from the issue
 */
async function extractIssueSpec(
  issueTitle: string,
  issueBody: string,
  context: CodebaseContext
): Promise<IssueSpec> {
  const prompt = `You are an expert software engineer analyzing a GitHub issue. Extract a structured specification from this issue.

## Issue Title
${issueTitle}

## Issue Body
${issueBody}

## Codebase Context
- Language: ${context.language}
- Framework: ${context.framework || 'None detected'}
- Test Framework: ${context.testFramework || 'None detected'}
- Key Dependencies: ${context.dependencies.slice(0, 10).join(', ')}

## Task
Analyze this issue and extract a structured specification. Determine:
1. The type of change (bug fix, feature, refactor, docs, or other)
2. A clear summary of what needs to be done
3. Specific requirements that must be met
4. Areas of the codebase that will be affected
5. Assumptions being made
6. What is explicitly out of scope
7. Acceptance criteria for completion

## Output Format
Respond with a JSON object:
{
  "type": "bug" | "feature" | "refactor" | "docs" | "other",
  "summary": "Brief summary of the change",
  "requirements": ["requirement 1", "requirement 2"],
  "affectedAreas": ["area 1", "area 2"],
  "assumptions": ["assumption 1", "assumption 2"],
  "outOfScope": ["item 1", "item 2"],
  "acceptanceCriteria": ["criteria 1", "criteria 2"]
}`;

  return askJson<IssueSpec>(prompt);
}

/**
 * Format analysis result for display
 */
export function formatAnalysis(result: AnalysisResult): string {
  const { spec, context } = result;
  
  return `## Issue Analysis

### Type
${spec.type}

### Summary
${spec.summary}

### Requirements
${spec.requirements.map(r => `- ${r}`).join('\n')}

### Affected Areas
${spec.affectedAreas.map(a => `- ${a}`).join('\n')}

### Assumptions
${spec.assumptions.map(a => `- ${a}`).join('\n')}

### Out of Scope
${spec.outOfScope.map(o => `- ${o}`).join('\n')}

### Acceptance Criteria
${spec.acceptanceCriteria.map(c => `- ${c}`).join('\n')}

---

### Codebase Context
- **Language:** ${context.language}
- **Framework:** ${context.framework || 'None'}
- **Test Framework:** ${context.testFramework || 'None'}
- **Relevant Files:** ${context.relevantFiles.length} files identified
`;
}
