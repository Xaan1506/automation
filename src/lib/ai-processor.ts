/**
 * AI solution generation using OpenAI-compatible APIs
 */

import { prisma } from '@/lib/prisma';
import type { Question, TestCase } from '@prisma/client';
import { QuestionStatus, ValidationStatus } from '@/lib/constants';
import { getAIClient, getAIModel } from '@/lib/ai-client';
const MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '4096');

export interface GeneratedSolution {
  code: string;
  language: string;
  explanation: string;
  timeComplexity: string;
  spaceComplexity: string;
}

export interface GeneratedTestCase {
  input: string;
  expected: string;
}

/**
 * Generate a solution for a coding question
 */
export async function generateSolution(
  question: Question & { testCases?: TestCase[] }
): Promise<GeneratedSolution> {
  const prompt = buildSolutionPrompt(question);
  const openai = getAIClient();

  const completion = await openai.chat.completions.create({
    model: getAIModel(),
    max_tokens: MAX_TOKENS,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `You are an expert competitive programmer and software engineer. 
Your task is to write clean, efficient, well-commented code solutions for programming problems.
Always respond with valid JSON matching the requested schema exactly.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  const parsed = JSON.parse(content);
  return {
    code: parsed.code || '',
    language: parsed.language || question.language || 'python',
    explanation: parsed.explanation || '',
    timeComplexity: parsed.time_complexity || parsed.timeComplexity || 'O(n)',
    spaceComplexity: parsed.space_complexity || parsed.spaceComplexity || 'O(1)',
  };
}

function buildSolutionPrompt(question: Question & { testCases?: TestCase[] }): string {
  let prompt = `Solve this programming problem and respond with JSON:

**Problem Title:** ${question.title}

**Problem Description:**
${question.description}`;

  if (question.inputFormat) {
    prompt += `\n\n**Input Format:**\n${question.inputFormat}`;
  }

  if (question.outputFormat) {
    prompt += `\n\n**Output Format:**\n${question.outputFormat}`;
  }

  if (question.constraints) {
    prompt += `\n\n**Constraints:**\n${question.constraints}`;
  }

  if (question.sampleInput) {
    prompt += `\n\n**Sample Input:**\n${question.sampleInput}`;
  }

  if (question.sampleOutput) {
    prompt += `\n\n**Sample Output:**\n${question.sampleOutput}`;
  }

  const preferredLanguage = question.language || 'python';

  prompt += `

**Required Response Format (JSON):**
{
  "code": "complete working solution in ${preferredLanguage}",
  "language": "${preferredLanguage}",
  "explanation": "step-by-step explanation of the approach",
  "time_complexity": "Big-O time complexity",
  "space_complexity": "Big-O space complexity"
}

Write the most optimal, clean solution. Include helpful comments in the code.`;

  return prompt;
}

/**
 * Generate additional test cases for a question
 */
export async function generateTestCases(
  question: Question,
  count: number = 5
): Promise<GeneratedTestCase[]> {
  const prompt = `Generate ${count} additional test cases for this programming problem.

**Problem:** ${question.title}

**Description:**
${question.description}

${question.inputFormat ? `**Input Format:**\n${question.inputFormat}\n` : ''}
${question.outputFormat ? `**Output Format:**\n${question.outputFormat}\n` : ''}
${question.constraints ? `**Constraints:**\n${question.constraints}\n` : ''}

Generate test cases that cover:
1. Edge cases (empty input, single element, minimum/maximum values)
2. Normal cases (typical inputs)
3. Stress cases (large inputs within constraints)

Respond with JSON:
{
  "test_cases": [
    {"input": "...", "expected": "..."},
    ...
  ]
}`;

  const openai = getAIClient();
  const completion = await openai.chat.completions.create({
    model: getAIModel(),
    max_tokens: 2048,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: 'You are a software testing expert. Generate diverse, meaningful test cases.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content);
  return (parsed.test_cases || []).slice(0, count);
}

/**
 * Validate a solution by executing it in a sandboxed environment
 * Note: For production, use a proper code execution API
 */
export async function validateSolution(
  solution: { code: string; language: string },
  testCases: TestCase[]
): Promise<{
  status: 'PASSED' | 'PARTIAL' | 'FAILED' | 'ERROR';
  output: string;
  passedCount: number;
  totalCount: number;
  details: Array<{ input: string; expected: string; actual: string; passed: boolean }>;
}> {
  if (testCases.length === 0) {
    return {
      status: 'PASSED',
      output: 'No test cases to validate against',
      passedCount: 0,
      totalCount: 0,
      details: [],
    };
  }

  // For now, use AI to simulate validation
  // In production, integrate with Judge0 or similar
  const validationPrompt = `You are a code validator. Given this ${solution.language} code and test cases, 
determine if the code would produce the correct output for each test case.

**Code:**
\`\`\`${solution.language}
${solution.code}
\`\`\`

**Test Cases:**
${testCases.map((tc, i) => `Test ${i + 1}:\nInput: ${tc.input}\nExpected: ${tc.expected}`).join('\n\n')}

For each test case, trace through the code mentally and determine if it would produce the expected output.
Respond with JSON:
{
  "results": [
    {"test_number": 1, "would_pass": true/false, "simulated_output": "...", "reasoning": "..."},
    ...
  ],
  "overall_assessment": "PASSED/PARTIAL/FAILED",
  "issues_found": "description of any bugs found"
}`;

  try {
    const openai = getAIClient();
    const completion = await openai.chat.completions.create({
      model: getAIModel(),
      max_tokens: 2048,
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are a precise code analyzer.' },
        { role: 'user', content: validationPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No validation response');

    const parsed = JSON.parse(content);
    const results = parsed.results || [];
    const passedCount = results.filter((r: { would_pass: boolean }) => r.would_pass).length;

    const details = testCases.map((tc, i) => {
      const result = results[i];
      return {
        input: tc.input,
        expected: tc.expected,
        actual: result?.simulated_output || '',
        passed: result?.would_pass || false,
      };
    });

    let status: 'PASSED' | 'PARTIAL' | 'FAILED' | 'ERROR' = 'FAILED';
    if (passedCount === testCases.length) status = 'PASSED';
    else if (passedCount > 0) status = 'PARTIAL';

    return {
      status,
      output: parsed.issues_found || '',
      passedCount,
      totalCount: testCases.length,
      details,
    };
  } catch (err) {
    return {
      status: 'ERROR',
      output: String(err),
      passedCount: 0,
      totalCount: testCases.length,
      details: [],
    };
  }
}

/**
 * Process a single question: generate solution + test cases + validate
 */
export async function processQuestion(questionId: string): Promise<void> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { testCases: true },
  });

  if (!question) throw new Error(`Question ${questionId} not found`);

  // Update status to processing
  await prisma.question.update({
    where: { id: questionId },
    data: { processingStatus: QuestionStatus.AI_PROCESSING, lastProcessedAt: new Date() },
  });

  try {
    // Step 1: Generate solution
    const solution = await generateSolution(question);

    // Step 2: Save solution draft
    const savedSolution = await prisma.solution.create({
      data: {
        questionId,
        code: solution.code,
        language: solution.language,
        explanation: solution.explanation,
        timeComplexity: solution.timeComplexity,
        spaceComplexity: solution.spaceComplexity,
        aiModel: getAIModel(),
        validationStatus: ValidationStatus.PENDING,
        isPreferred: true,
      },
    });

    await prisma.question.update({
      where: { id: questionId },
      data: { processingStatus: QuestionStatus.SOLUTION_GENERATED },
    });

    // Step 3: Generate test cases if none exist
    let testCases = question.testCases;
    if (testCases.length === 0) {
      const generatedCases = await generateTestCases(question, 5);
      const created = await prisma.$transaction(
        generatedCases.map((tc) =>
          prisma.testCase.create({
            data: {
              questionId,
              input: tc.input,
              expected: tc.expected,
              source: 'ai',
              isPublic: false,
            },
          })
        )
      );
      testCases = created;
    }

    // Step 4: Validate solution
    await prisma.question.update({
      where: { id: questionId },
      data: { processingStatus: QuestionStatus.VALIDATION_IN_PROGRESS },
    });

    const validation = await validateSolution(
      { code: solution.code, language: solution.language },
      testCases
    );

    // Step 5: Save validation results
    await prisma.solution.update({
      where: { id: savedSolution.id },
      data: {
        validationStatus: validation.status,
        validationOutput: JSON.stringify(validation.details),
        passedTestCases: validation.passedCount,
        totalTestCases: validation.totalCount,
      },
    });

    const finalStatus =
      validation.status === ValidationStatus.PASSED
        ? QuestionStatus.VALIDATED
        : validation.status === ValidationStatus.FAILED
        ? QuestionStatus.REQUIRES_REVIEW
        : QuestionStatus.REQUIRES_REVIEW;

    await prisma.question.update({
      where: { id: questionId },
      data: { processingStatus: finalStatus, lastProcessedAt: new Date() },
    });
  } catch (err) {
    await prisma.question.update({
      where: { id: questionId },
      data: { processingStatus: QuestionStatus.FAILED, lastProcessedAt: new Date() },
    });
    throw err;
  }
}
