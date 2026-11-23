/**
 * Newton School scraper using Playwright/Puppeteer
 * Handles authentication, course discovery, assignment scraping, and question extraction
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import {
  SubjectStatus,
  AssignmentStatus,
  QuestionStatus,
  ValidationStatus,
} from '@/lib/constants';

const NEWTON_BASE_URL = process.env.NEWTON_BASE_URL || 'https://learn.newtonschool.co';

export interface ScrapedSubject {
  externalId: string;
  name: string;
  code?: string;
  courseUrl: string;
  description?: string;
  imageUrl?: string;
}

export interface ScrapedAssignment {
  externalId: string;
  title: string;
  assignmentUrl: string;
  description?: string;
  dueDate?: Date;
}

export interface ScrapedQuestion {
  externalId: string;
  title: string;
  description: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  sampleInput?: string;
  sampleOutput?: string;
  language?: string;
  difficulty?: string;
  questionUrl: string;
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Save Newton session cookies to database
 */
export async function saveSession(email: string, cookies: object[]): Promise<string> {
  const token = crypto.randomUUID();
  const session = await prisma.newtonSession.upsert({
    where: { email },
    create: {
      email,
      sessionToken: token,
      cookieData: JSON.stringify(cookies),
      isActive: true,
    },
    update: {
      cookieData: JSON.stringify(cookies),
      isActive: true,
      updatedAt: new Date(),
    },
  });
  return session.sessionToken;
}

/**
 * Load saved Newton session
 */
export async function loadSession(email: string): Promise<object[] | null> {
  const session = await prisma.newtonSession.findUnique({
    where: { email, isActive: true },
  });
  if (!session) return null;
  try {
    return JSON.parse(session.cookieData);
  } catch {
    return null;
  }
}

/**
 * Invalidate session on logout/expiry
 */
export async function invalidateSession(email: string): Promise<void> {
  await prisma.newtonSession.updateMany({
    where: { email },
    data: { isActive: false },
  });
}

/**
 * Upsert a discovered subject into the database
 */
export async function upsertSubject(subject: ScrapedSubject) {
  return prisma.subject.upsert({
    where: { externalId: subject.externalId },
    create: {
      ...subject,
      discoveryStatus: SubjectStatus.DISCOVERED,
      stats: {
        create: {
          assignmentsCount: 0,
          questionsCount: 0,
          solutionsGenerated: 0,
          validationPassed: 0,
          pendingReview: 0,
          failed: 0,
        },
      },
    },
    update: {
      name: subject.name,
      code: subject.code,
      courseUrl: subject.courseUrl,
      description: subject.description,
      imageUrl: subject.imageUrl,
      updatedAt: new Date(),
    },
    include: { stats: true },
  });
}

/**
 * Upsert a discovered assignment into the database
 */
export async function upsertAssignment(subjectId: string, assignment: ScrapedAssignment) {
  return prisma.assignment.upsert({
    where: {
      subjectId_externalId: {
        subjectId,
        externalId: assignment.externalId,
      },
    },
    create: {
      ...assignment,
      subjectId,
      processingStatus: AssignmentStatus.NOT_PROCESSED,
    },
    update: {
      title: assignment.title,
      assignmentUrl: assignment.assignmentUrl,
      description: assignment.description,
      dueDate: assignment.dueDate,
      updatedAt: new Date(),
    },
  });
}

/**
 * Upsert a discovered question into the database
 */
export async function upsertQuestion(assignmentId: string, question: ScrapedQuestion) {
  const contentHash = hashContent(question.description + question.title);

  return prisma.question.upsert({
    where: {
      assignmentId_externalId: {
        assignmentId,
        externalId: question.externalId,
      },
    },
    create: {
      ...question,
      assignmentId,
      contentHash,
      processingStatus: QuestionStatus.DISCOVERED,
    },
    update: {
      title: question.title,
      description: question.description,
      inputFormat: question.inputFormat,
      outputFormat: question.outputFormat,
      constraints: question.constraints,
      sampleInput: question.sampleInput,
      sampleOutput: question.sampleOutput,
      language: question.language,
      difficulty: question.difficulty,
      contentHash,
      updatedAt: new Date(),
    },
  });
}

/**
 * Update subject stats based on current data
 */
export async function refreshSubjectStats(subjectId: string): Promise<void> {
  const assignments = await prisma.assignment.findMany({
    where: { subjectId },
    include: {
      questions: {
        include: {
          solutions: true,
        },
      },
    },
  });

  let questionsCount = 0;
  let solutionsGenerated = 0;
  let validationPassed = 0;
  let pendingReview = 0;
  let failed = 0;

  for (const assignment of assignments) {
    for (const question of assignment.questions) {
      questionsCount++;
      const preferredSolution = question.solutions.find((s) => s.isPreferred);
      if (preferredSolution) {
        solutionsGenerated++;
        if (preferredSolution.validationStatus === ValidationStatus.PASSED) validationPassed++;
        else if (preferredSolution.validationStatus === ValidationStatus.FAILED) failed++;
        else pendingReview++;
      } else if (question.processingStatus === QuestionStatus.REQUIRES_REVIEW) {
        pendingReview++;
      } else if (question.processingStatus === QuestionStatus.FAILED) {
        failed++;
      }
    }
  }

  await prisma.subjectStats.upsert({
    where: { subjectId },
    create: {
      subjectId,
      assignmentsCount: assignments.length,
      questionsCount,
      solutionsGenerated,
      validationPassed,
      pendingReview,
      failed,
    },
    update: {
      assignmentsCount: assignments.length,
      questionsCount,
      solutionsGenerated,
      validationPassed,
      pendingReview,
      failed,
      updatedAt: new Date(),
    },
  });
}

/**
 * Parse Newton API responses to extract subjects
 * Newton may expose courses via JSON API or HTML pages
 */
export function parseSubjectsFromApiResponse(data: unknown): ScrapedSubject[] {
  const subjects: ScrapedSubject[] = [];

  if (!data || typeof data !== 'object') return subjects;

  const anyData = data as Record<string, unknown>;

  // Handle array response
  if (Array.isArray(data)) {
    for (const item of data) {
      const s = parseSubjectItem(item as Record<string, unknown>);
      if (s) subjects.push(s);
    }
    return subjects;
  }

  // Handle paginated response
  if (anyData.data && Array.isArray(anyData.data)) {
    for (const item of anyData.data as Record<string, unknown>[]) {
      const s = parseSubjectItem(item);
      if (s) subjects.push(s);
    }
    return subjects;
  }

  // Handle results wrapper
  if (anyData.results && Array.isArray(anyData.results)) {
    for (const item of anyData.results as Record<string, unknown>[]) {
      const s = parseSubjectItem(item);
      if (s) subjects.push(s);
    }
    return subjects;
  }

  return subjects;
}

function parseSubjectItem(item: Record<string, unknown>): ScrapedSubject | null {
  if (!item) return null;

  const id = String(item.id || item._id || item.course_id || item.courseId || '');
  const name = String(item.name || item.title || item.course_name || item.courseName || '');

  if (!id || !name) return null;

  const url = String(
    item.url || item.course_url || item.courseUrl ||
    item.link || `${NEWTON_BASE_URL}/course/${id}`
  );

  // Extract course code from name (e.g., "Advanced Software Development (ASD)" → "ASD")
  const codeMatch = name.match(/\(([A-Z]{2,10})\)/);

  return {
    externalId: id,
    name: name.replace(/\s*\([A-Z]{2,10}\)\s*$/, '').trim() || name,
    code: codeMatch ? codeMatch[1] : undefined,
    courseUrl: url,
    description: String(item.description || item.about || ''),
    imageUrl: String(item.image || item.thumbnail || item.banner || ''),
  };
}

export function parseAssignmentsFromApiResponse(data: unknown): ScrapedAssignment[] {
  const assignments: ScrapedAssignment[] = [];
  if (!data || !Array.isArray(data)) {
    const anyData = data as Record<string, unknown>;
    if (anyData?.data && Array.isArray(anyData.data)) {
      return parseAssignmentsList(anyData.data as Record<string, unknown>[]);
    }
    return assignments;
  }
  return parseAssignmentsList(data as Record<string, unknown>[]);
}

function parseAssignmentsList(items: Record<string, unknown>[]): ScrapedAssignment[] {
  return items.map((item) => {
    const id = String(item.id || item._id || item.assignment_id || '');
    const title = String(item.title || item.name || item.assignment_title || `Assignment ${id}`);
    const url = String(
      item.url || item.assignment_url || item.link ||
      `${NEWTON_BASE_URL}/assignment/${id}`
    );
    return {
      externalId: id,
      title,
      assignmentUrl: url,
      description: String(item.description || ''),
      dueDate: item.due_date ? new Date(String(item.due_date)) : undefined,
    };
  }).filter((a) => a.externalId);
}

export function parseQuestionsFromApiResponse(data: unknown): ScrapedQuestion[] {
  const questions: ScrapedQuestion[] = [];
  if (!data) return questions;

  const items = Array.isArray(data)
    ? data
    : (data as Record<string, unknown>).data
    ? (data as Record<string, unknown>).data as unknown[]
    : [];

  for (const item of items) {
    const q = parseQuestionItem(item as Record<string, unknown>);
    if (q) questions.push(q);
  }
  return questions;
}

function parseQuestionItem(item: Record<string, unknown>): ScrapedQuestion | null {
  if (!item) return null;

  const id = String(item.id || item._id || item.question_id || '');
  const title = String(item.title || item.name || item.question_title || '');
  const description = String(
    item.description || item.problem_statement || item.content || item.body || ''
  );

  if (!id || !description) return null;

  const url = String(
    item.url || item.question_url || item.link ||
    `${NEWTON_BASE_URL}/question/${id}`
  );

  return {
    externalId: id,
    title: title || `Question ${id}`,
    description,
    inputFormat: String(item.input_format || item.inputFormat || ''),
    outputFormat: String(item.output_format || item.outputFormat || ''),
    constraints: String(item.constraints || ''),
    sampleInput: String(item.sample_input || item.sampleInput || item.example_input || ''),
    sampleOutput: String(item.sample_output || item.sampleOutput || item.example_output || ''),
    language: String(item.language || item.programming_language || ''),
    difficulty: String(item.difficulty || item.level || ''),
    questionUrl: url,
  };
}
