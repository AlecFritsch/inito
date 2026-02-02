import { GoogleGenAI } from '@google/genai';
import { env } from './config.js';

let client: GoogleGenAI | null = null;

/**
 * Get the Gemini client
 */
function getClient(): GoogleGenAI {
  if (!client) {
    if (!env.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }
  return client;
}

/**
 * Send a prompt to Gemini and get a response
 */
export async function ask(prompt: string, systemInstruction?: string): Promise<string> {
  const ai = getClient();
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      systemInstruction: systemInstruction || 'You are an expert software engineer assistant.',
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  });

  return response.text || '';
}

/**
 * Send a prompt with system context (legacy compatibility)
 */
export async function askWithContext(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return ask(userPrompt, systemPrompt);
}

/**
 * Parse JSON from LLM response (handles markdown code blocks)
 */
export function parseJsonResponse<T>(response: string): T {
  let cleaned = response.trim();
  
  // Handle various markdown formats
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\w*\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  
  cleaned = cleaned.trim();
  
  // Try to find JSON object or array in the response
  const jsonObjMatch = cleaned.match(/\{[\s\S]*\}/);
  const jsonArrMatch = cleaned.match(/\[[\s\S]*\]/);
  
  if (jsonObjMatch) {
    cleaned = jsonObjMatch[0];
  } else if (jsonArrMatch) {
    cleaned = jsonArrMatch[0];
  }
  
  // Fix common JSON issues from LLMs
  // Remove trailing commas before ] or }
  cleaned = cleaned.replace(/,(\s*[\]\}])/g, '$1');
  // Remove comments
  cleaned = cleaned.replace(/\/\/[^\n]*/g, '');
  // Fix unescaped newlines in strings (crude but helps)
  cleaned = cleaned.replace(/(?<!\\)\n(?=[^"]*"[^"]*$)/gm, '\\n');
  
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error('[Gemini] JSON parse error. Raw response:', response.substring(0, 500));
    console.error('[Gemini] Cleaned:', cleaned.substring(0, 500));
    throw e;
  }
}

/**
 * Ask Gemini and parse JSON response
 */
export async function askJson<T>(prompt: string, systemInstruction?: string): Promise<T> {
  const response = await ask(prompt, systemInstruction);
  return parseJsonResponse<T>(response);
}

/**
 * Generate code with Gemini
 */
export async function generateCode(
  instruction: string,
  context: string,
  existingCode?: string
): Promise<string> {
  const systemInstruction = `You are an expert software engineer. Your task is to generate clean, production-ready code.

Rules:
- Write clean, well-structured code
- Follow best practices for the language
- Include necessary imports
- Add brief comments for complex logic
- Output ONLY the code, no markdown code blocks
- No explanations or commentary`;

  const prompt = `## Context
${context}

${existingCode ? `## Existing Code\n${existingCode}` : ''}

## Instruction
${instruction}

Output the code now:`;

  const response = await ask(prompt, systemInstruction);
  
  // Clean up response - remove any markdown code blocks
  let code = response.trim();
  if (code.startsWith('```')) {
    code = code.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  }
  
  return code.trim();
}

/**
 * Review code with Gemini
 */
export async function reviewCode(
  diff: string,
  context: string
): Promise<{
  issues: string[];
  suggestions: string[];
  risks: string[];
  summary: string;
}> {
  const systemInstruction = `You are an expert code reviewer. Analyze code changes and provide detailed, actionable feedback.

Always respond with valid JSON in this exact format:
{
  "issues": ["array of bugs, errors, or problems found"],
  "suggestions": ["array of improvements that could be made"],
  "risks": ["array of potential risks or regressions"],
  "summary": "brief summary of the review"
}`;

  const prompt = `## Context
${context}

## Diff to Review
\`\`\`diff
${diff}
\`\`\`

Analyze this code change and provide your review as JSON:`;

  return askJson(prompt, systemInstruction);
}

/**
 * Analyze with structured output
 */
export async function analyzeWithSchema<T>(
  prompt: string,
  schema: string,
  systemInstruction?: string
): Promise<T> {
  const fullSystemInstruction = `${systemInstruction || 'You are an expert analyst.'}

You MUST respond with valid JSON matching this schema:
${schema}

Do not include any text before or after the JSON.`;

  return askJson<T>(prompt, fullSystemInstruction);
}

/**
 * Multi-turn conversation support using chat
 */
export async function chat(
  messages: Array<{ role: 'user' | 'model'; content: string }>,
  systemInstruction?: string
): Promise<string> {
  const ai = getClient();
  
  // Convert messages to the format expected by the API
  const history = messages.slice(0, -1).map(m => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  const chatSession = ai.chats.create({
    model: 'gemini-2.0-flash',
    history,
    config: {
      systemInstruction: systemInstruction || 'You are an expert software engineer assistant.',
    },
  });

  const lastMessage = messages[messages.length - 1];
  const response = await chatSession.sendMessage({ message: lastMessage.content });
  
  return response.text || '';
}

/**
 * Stream response for long outputs
 */
export async function* askStream(
  prompt: string, 
  systemInstruction?: string
): AsyncGenerator<string> {
  const ai = getClient();
  
  const response = await ai.models.generateContentStream({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      systemInstruction: systemInstruction || 'You are an expert software engineer assistant.',
    },
  });

  for await (const chunk of response) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

/**
 * Count tokens in a prompt
 */
export async function countTokens(text: string): Promise<number> {
  const ai = getClient();
  
  const result = await ai.models.countTokens({
    model: 'gemini-2.0-flash',
    contents: text,
  });
  
  return result.totalTokens || 0;
}

/**
 * List available models
 */
export async function listModels(): Promise<string[]> {
  const ai = getClient();
  const modelList: string[] = [];
  const pager = await ai.models.list();
  for await (const model of pager) {
    if (model.name) {
      modelList.push(model.name);
    }
  }
  return modelList;
}
