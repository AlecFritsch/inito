import { askJson } from '../gemini.js';
import { AnalysisResult } from './analyzer.js';
import { SandboxRunner } from '../sandbox/runner.js';

/**
 * A single task in the plan
 */
export interface Task {
  id: number;
  type: 'create' | 'modify' | 'delete' | 'test';
  file: string;
  description: string;
  details: string;
  dependencies: number[];
}

/**
 * The full plan for implementing the issue
 */
export interface Plan {
  summary: string;
  approach: string;
  tasks: Task[];
  testStrategy: string;
  risks: string[];
}

/**
 * Create a plan based on the analysis
 */
export async function createPlan(
  analysis: AnalysisResult,
  runner: SandboxRunner
): Promise<Plan> {
  const { spec, context } = analysis;

  // Read some relevant files to understand the codebase structure
  const fileContents: Record<string, string> = {};
  for (const file of context.relevantFiles.slice(0, 5)) {
    const content = await runner.readFile(file);
    if (content && content.length < 5000) {
      fileContents[file] = content;
    }
  }

  const prompt = `You are an expert software engineer creating a detailed implementation plan.

## Issue Specification
- Type: ${spec.type}
- Summary: ${spec.summary}
- Requirements: ${spec.requirements.join(', ')}
- Affected Areas: ${spec.affectedAreas.join(', ')}
- Acceptance Criteria: ${spec.acceptanceCriteria.join(', ')}

## Codebase Context
- Language: ${context.language}
- Framework: ${context.framework || 'None'}
- Test Framework: ${context.testFramework || 'None'}
- Files: ${context.relevantFiles.slice(0, 20).join(', ')}

## Sample File Contents
${Object.entries(fileContents).map(([file, content]) => 
  `### ${file}\n\`\`\`\n${content.slice(0, 1000)}\n\`\`\``
).join('\n\n')}

## Task
Create a detailed implementation plan with specific tasks. Each task should:
1. Target a specific file
2. Have a clear action (create, modify, delete, or test)
3. Include detailed instructions
4. List dependencies on other tasks

## Output Format
Return ONLY valid JSON, no markdown, no explanations:
{"summary": "...", "approach": "...", "tasks": [{"id": 1, "type": "modify", "file": "src/example.ts", "description": "...", "details": "...", "dependencies": []}], "testStrategy": "...", "risks": ["..."]}

Valid task types: create, modify, delete, test
Keep descriptions SHORT (under 100 chars). No special characters in strings.`;

  return askJson<Plan>(prompt, 'Return ONLY valid JSON. No markdown code blocks. No explanations.');
}

/**
 * Validate plan dependencies
 */
export function validatePlan(plan: Plan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const taskIds = new Set(plan.tasks.map(t => t.id));

  for (const task of plan.tasks) {
    for (const dep of task.dependencies) {
      if (!taskIds.has(dep)) {
        errors.push(`Task ${task.id} depends on non-existent task ${dep}`);
      }
      if (dep >= task.id) {
        errors.push(`Task ${task.id} has forward dependency on task ${dep}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sort tasks by dependencies (topological sort)
 */
export function sortTasks(tasks: Task[]): Task[] {
  const sorted: Task[] = [];
  const visited = new Set<number>();
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  function visit(taskId: number) {
    if (visited.has(taskId)) return;
    visited.add(taskId);

    const task = taskMap.get(taskId);
    if (!task) return;

    for (const dep of task.dependencies) {
      visit(dep);
    }

    sorted.push(task);
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return sorted;
}

/**
 * Format plan for display
 */
export function formatPlan(plan: Plan): string {
  return `## Implementation Plan

### Summary
${plan.summary}

### Approach
${plan.approach}

### Tasks
${plan.tasks.map(t => 
  `${t.id}. **[${t.type.toUpperCase()}]** ${t.file}
   ${t.description}
   ${t.dependencies.length > 0 ? `   _Depends on: ${t.dependencies.join(', ')}_` : ''}`
).join('\n\n')}

### Test Strategy
${plan.testStrategy}

### Risks
${plan.risks.map(r => `- ${r}`).join('\n')}
`;
}
