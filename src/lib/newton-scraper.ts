/**
 * Newton School scraper using Playwright/Puppeteer
 * Handles authentication, course discovery, assignment scraping, and question extraction
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { chmod, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { BrowserContext } from 'playwright';
import {
  SubjectStatus,
  AssignmentStatus,
  QuestionStatus,
  ValidationStatus,
} from '@/lib/constants';

const SESSION_KEY_PATH = path.join(process.cwd(), '.newton-session-key');
type NewtonStorageState = Awaited<ReturnType<BrowserContext['storageState']>>;
let sessionEncryptionKey: Buffer | undefined;

async function getSessionEncryptionKey(): Promise<Buffer> {
  if (sessionEncryptionKey) return sessionEncryptionKey;

  try {
    sessionEncryptionKey = await readFile(SESSION_KEY_PATH);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;

    const newKey = crypto.randomBytes(32);
    try {
      await writeFile(SESSION_KEY_PATH, newKey, { flag: 'wx', mode: 0o600 });
      sessionEncryptionKey = newKey;
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError;
      sessionEncryptionKey = await readFile(SESSION_KEY_PATH);
    }
  }

  if (sessionEncryptionKey.length !== 32) {
    throw new Error('Newton session encryption key has an invalid length');
  }

  await chmod(SESSION_KEY_PATH, 0o600);
  return sessionEncryptionKey;
}

async function encryptSessionState(state: NewtonStorageState): Promise<string> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', await getSessionEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state)), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`;
}

async function decryptSessionState(value: string): Promise<NewtonStorageState | null> {
  if (!value.startsWith('v1:')) return null;

  const payload = Buffer.from(value.slice(3), 'base64');
  if (payload.length < 29) throw new Error('Stored Newton session is invalid');

  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', await getSessionEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  const state = JSON.parse(plaintext) as NewtonStorageState;

  if (!Array.isArray(state.cookies)) {
    throw new Error('Stored Newton session has an invalid format');
  }
  return state;
}

export function getNewtonCookieHeader(state: NewtonStorageState): string {
  return state.cookies
    .filter((cookie) => cookie.domain.replace(/^\./, '').endsWith('newtonschool.co'))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

export interface ScrapedSubject {
  externalId: string;
  name: string;
  code?: string;
  courseUrl: string;
  portalCourseId?: string;
  description?: string;
  imageUrl?: string;
}

export interface ScrapedAssignment {
  externalId: string;
  title: string;
  assignmentUrl: string;
  sectionName?: string;
  groupType?: string;
  releaseLabel?: string;
  deadlineLabel?: string;
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
  portalStatus?: string;
  scoreLabel?: string;
  topics?: string[];
  solvedByLabel?: string;
  examples?: string;
  starterCode?: string;
  questionUrl: string;
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Save an encrypted Playwright storage state to the database
 */
export async function saveSession(email: string, state: NewtonStorageState): Promise<string> {
  const token = crypto.randomUUID();
  const cookieData = await encryptSessionState(state);
  const session = await prisma.newtonSession.upsert({
    where: { email },
    create: {
      email,
      sessionToken: token,
      cookieData,
      isActive: true,
    },
    update: {
      cookieData,
      isActive: true,
      updatedAt: new Date(),
    },
  });
  return session.sessionToken;
}

/**
 * Load saved Newton session
 */
export async function loadSession(email: string): Promise<NewtonStorageState | null> {
  const session = await prisma.newtonSession.findUnique({
    where: { email, isActive: true },
  });
  if (!session) return null;
  const state = await decryptSessionState(session.cookieData);
  if (!state && !session.cookieData.startsWith('v1:')) {
    await prisma.newtonSession.updateMany({
      where: { email, isActive: true },
      data: { isActive: false, cookieData: '' },
    });
  }
  return state;
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
      portalCourseId: subject.portalCourseId,
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
      sectionName: assignment.sectionName,
      groupType: assignment.groupType,
      releaseLabel: assignment.releaseLabel,
      deadlineLabel: assignment.deadlineLabel,
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
  const { topics, ...questionData } = question;

  return prisma.question.upsert({
    where: {
      assignmentId_externalId: {
        assignmentId,
        externalId: question.externalId,
      },
    },
    create: {
      ...questionData,
      assignmentId,
      topics: topics ? JSON.stringify(topics) : undefined,
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
      portalStatus: question.portalStatus,
      scoreLabel: question.scoreLabel,
      topics: topics ? JSON.stringify(topics) : undefined,
      solvedByLabel: question.solvedByLabel,
      examples: question.examples,
      starterCode: question.starterCode,
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

