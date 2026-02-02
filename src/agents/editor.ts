import { ask, generateCode } from '../gemini.js';
import { SandboxRunner } from '../sandbox/runner.js';
import { Task } from './planner.js';
import { isFileProtected, HavocConfig } from '../config.js';
import type { RunEventType } from '../run-events.js';
import { dirname } from 'path';

/**
 * Result of executing a task
 */
export interface TaskResult {
  taskId: number;
  success: boolean;
  file: string;
  action: 'created' | 'modified' | 'deleted' | 'skipped';
  error?: string;
  diff?: string;
}

/**
 * Execute all tasks in the plan
 */
export async function executeTasks(
  tasks: Task[],
  runner: SandboxRunner,
  config: HavocConfig,
  context: { language: string; framework: string | null },
  onEvent?: (event: { type: RunEventType; message: string; data?: Record<string, unknown> }) => void
): Promise<TaskResult[]> {
  const results: TaskResult[] = [];

  for (const task of tasks) {
    console.log(`[Editor] Executing task ${task.id}: ${task.description}`);
    onEvent?.({
      type: 'task',
      message: `Task ${task.id}: ${task.description}`,
      data: { file: task.file, action: task.type }
    });
    
    try {
      const result = await executeTask(task, runner, config, context);
      results.push(result);
      
      if (!result.success) {
        console.error(`[Editor] Task ${task.id} failed: ${result.error}`);
        onEvent?.({
          type: 'error',
          message: `Task ${task.id} failed: ${result.error}`,
          data: { file: task.file, action: task.type }
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        taskId: task.id,
        success: false,
        file: task.file,
        action: 'skipped',
        error: message
      });
      onEvent?.({
        type: 'error',
        message: `Task ${task.id} failed: ${message}`,
        data: { file: task.file, action: task.type }
      });
    }
  }

  return results;
}

/**
 * Execute a single task
 */
async function executeTask(
  task: Task,
  runner: SandboxRunner,
  config: HavocConfig,
  context: { language: string; framework: string | null }
): Promise<TaskResult> {
  // Check if file is protected
  if (isFileProtected(task.file, config)) {
    return {
      taskId: task.id,
      success: false,
      file: task.file,
      action: 'skipped',
      error: `File is protected: ${task.file}`
    };
  }

  switch (task.type) {
    case 'create':
      return createFile(task, runner, context);
    case 'modify':
      return modifyFile(task, runner, context);
    case 'delete':
      return deleteFile(task, runner);
    case 'test':
      return createTestFile(task, runner, context);
    default:
      return {
        taskId: task.id,
        success: false,
        file: task.file,
        action: 'skipped',
        error: `Unknown task type: ${task.type}`
      };
  }
}

/**
 * Create a new file
 */
async function createFile(
  task: Task,
  runner: SandboxRunner,
  context: { language: string; framework: string | null }
): Promise<TaskResult> {
  // Ensure directory exists
  const dir = dirname(task.file);
  if (dir && dir !== '.') {
    await runner.mkdir(dir);
  }

  // Generate code for the new file
  const code = await generateCode(
    task.details,
    `Language: ${context.language}, Framework: ${context.framework || 'None'}, File: ${task.file}`,
    undefined
  );

  // Write the file
  const result = await runner.writeFile(task.file, code);

  if (result.exitCode !== 0) {
    return {
      taskId: task.id,
      success: false,
      file: task.file,
      action: 'skipped',
      error: result.stderr
    };
  }

  return {
    taskId: task.id,
    success: true,
    file: task.file,
    action: 'created',
    diff: `+++ ${task.file} (new file)\n${code.split('\n').map(l => `+ ${l}`).join('\n')}`
  };
}

/**
 * Modify an existing file
 */
async function modifyFile(
  task: Task,
  runner: SandboxRunner,
  context: { language: string; framework: string | null }
): Promise<TaskResult> {
  // Read existing content
  const existingContent = await runner.readFile(task.file);

  if (existingContent === null) {
    // File doesn't exist, create it
    return createFile(task, runner, context);
  }

  // Generate modified code
  const prompt = `You are modifying an existing file. Apply the following changes.

## File: ${task.file}

## Current Content
\`\`\`
${existingContent}
\`\`\`

## Requested Changes
${task.details}

## Instructions
- Apply the requested changes to the file
- Maintain the existing code style
- Keep all existing functionality unless explicitly asked to change it
- Output ONLY the complete modified file content, no explanations

## Output
Return the complete modified file:`;

  const modifiedCode = await ask(prompt);

  // Clean up the response (remove markdown code blocks if present)
  let cleanedCode = modifiedCode.trim();
  if (cleanedCode.startsWith('```')) {
    const lines = cleanedCode.split('\n');
    lines.shift(); // Remove opening ```
    if (lines[lines.length - 1] === '```') {
      lines.pop(); // Remove closing ```
    }
    cleanedCode = lines.join('\n');
  }

  // Write the modified file
  const result = await runner.writeFile(task.file, cleanedCode);

  if (result.exitCode !== 0) {
    return {
      taskId: task.id,
      success: false,
      file: task.file,
      action: 'skipped',
      error: result.stderr
    };
  }

  // Generate diff
  const diff = generateSimpleDiff(existingContent, cleanedCode, task.file);

  return {
    taskId: task.id,
    success: true,
    file: task.file,
    action: 'modified',
    diff
  };
}

/**
 * Delete a file
 */
async function deleteFile(
  task: Task,
  runner: SandboxRunner
): Promise<TaskResult> {
  const result = await runner.run(`rm -f ${task.file}`);

  if (result.exitCode !== 0) {
    return {
      taskId: task.id,
      success: false,
      file: task.file,
      action: 'skipped',
      error: result.stderr
    };
  }

  return {
    taskId: task.id,
    success: true,
    file: task.file,
    action: 'deleted',
    diff: `--- ${task.file} (deleted)`
  };
}

/**
 * Create a test file
 */
async function createTestFile(
  task: Task,
  runner: SandboxRunner,
  context: { language: string; framework: string | null }
): Promise<TaskResult> {
  // Generate test code
  const code = await generateCode(
    `Write tests for: ${task.details}`,
    `Language: ${context.language}, Framework: ${context.framework || 'None'}, Test file: ${task.file}`,
    undefined
  );

  // Ensure directory exists
  const dir = dirname(task.file);
  if (dir && dir !== '.') {
    await runner.mkdir(dir);
  }

  // Write the file
  const result = await runner.writeFile(task.file, code);

  if (result.exitCode !== 0) {
    return {
      taskId: task.id,
      success: false,
      file: task.file,
      action: 'skipped',
      error: result.stderr
    };
  }

  return {
    taskId: task.id,
    success: true,
    file: task.file,
    action: 'created',
    diff: `+++ ${task.file} (new test file)\n${code.split('\n').map(l => `+ ${l}`).join('\n')}`
  };
}

/**
 * Generate a simple diff between two strings
 */
function generateSimpleDiff(oldContent: string, newContent: string, filename: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  const diff: string[] = [
    `--- a/${filename}`,
    `+++ b/${filename}`
  ];

  // Simple line-by-line diff
  const maxLen = Math.max(oldLines.length, newLines.length);
  let inHunk = false;
  let hunkStart = 0;

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine !== newLine) {
      if (!inHunk) {
        hunkStart = Math.max(0, i - 2);
        diff.push(`@@ -${hunkStart + 1} +${hunkStart + 1} @@`);
        inHunk = true;
      }

      if (oldLine !== undefined) {
        diff.push(`-${oldLine}`);
      }
      if (newLine !== undefined) {
        diff.push(`+${newLine}`);
      }
    } else if (inHunk && oldLine === newLine) {
      diff.push(` ${oldLine || ''}`);
    }
  }

  return diff.join('\n');
}

/**
 * Combine all task diffs into a single diff
 */
export function combineDiffs(results: TaskResult[]): string {
  return results
    .filter(r => r.diff)
    .map(r => r.diff)
    .join('\n\n');
}
