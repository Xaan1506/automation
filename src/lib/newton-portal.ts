import crypto from 'crypto';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { prisma } from '@/lib/prisma';
import { getNewtonCourseUrl, resolveNewtonUrl } from '@/lib/newton-config';
import {
  loadSession,
  refreshSubjectStats,
  upsertAssignment,
  upsertQuestion,
  upsertSubject,
  type ScrapedAssignment,
  type ScrapedQuestion,
  type ScrapedSubject,
} from '@/lib/newton-scraper';

const GROUP_CARD_SELECTOR = 'div[class*="sc-f9d11e77-18"]';

export interface NewtonScanProgress {
  phase: string;
  message: string;
  completed: number;
  total: number;
  currentUrl?: string;
  currentSubject?: string;
  currentAssignment?: string;
  currentQuestion?: string;
}

export interface NewtonVisibleQuestionTarget {
  id: string;
  assignmentTitle: string;
  questionTitle: string;
}

export interface NewtonPortalActivity {
  action: 'navigate' | 'select_section' | 'read_groups' | 'scroll' |
    'open_question' | 'extract_problem' | 'back';
  summary: string;
  verified: boolean;
  error?: string;
  currentUrl: string;
  currentSubject: string;
  currentAssignment?: string;
  currentQuestion?: string;
  completed: number;
  total: number;
  screenshot: Buffer;
}

export interface NewtonScanOptions {
  sessionEmail?: string;
  waitForContinue?: () => Promise<boolean>;
  onActivity?: (activity: NewtonPortalActivity) => Promise<void> | void;
  planQuestionOrder?: (
    sectionName: string,
    targets: NewtonVisibleQuestionTarget[]
  ) => Promise<string[]>;
}

export class NewtonScanCancelledError extends Error {}

class NewtonScanControlError extends Error {}

class NewtonPortalActivityError extends Error {}

interface PortalQuestionRow {
  title: string;
  difficulty?: string;
  portalStatus?: string;
  scoreLabel?: string;
  topics: string[];
  solvedByLabel?: string;
  listIndex: number;
  rowIndex: number;
}

interface PortalAssignmentGroup {
  title: string;
  groupType?: string;
  releaseLabel?: string;
  deadlineLabel?: string;
  questions: PortalQuestionRow[];
  cardIndex: number;
  listIndex: number;
}

export class NewtonPortalError extends Error {}

function getConfiguredCourseUrl(): URL {
  try {
    return getNewtonCourseUrl();
  } catch (error) {
    throw new NewtonPortalError(
      error instanceof Error ? error.message : 'Configure NEWTON_COURSE_URL before scanning.'
    );
  }
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function getActiveStorageState(email?: string) {
  const session = await prisma.newtonSession.findFirst({
    where: { isActive: true, ...(email ? { email } : {}) },
    orderBy: { updatedAt: 'desc' },
    select: { email: true },
  });
  if (!session) throw new NewtonPortalError('No verified Newton session is saved. Sign in again.');

  const state = await loadSession(session.email);
  if (!state) throw new NewtonPortalError('The saved Newton session is unavailable. Sign in again.');
  return state;
}

async function createPortalContext(email?: string) {
  const state = await getActiveStorageState(email);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState: state });
    return { browser, context };
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error;
  }
}

export async function observeNewtonCourse(sessionEmail?: string): Promise<{
  currentUrl: string;
  sectionNames: string[];
  screenshot: Buffer;
}> {
  const courseUrl = getConfiguredCourseUrl();
  const { browser, context } = await createPortalContext(sessionEmail);

  try {
    const page = await context.newPage();
    const response = await page.goto(courseUrl.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    if (!response?.ok() || new URL(page.url()).origin !== courseUrl.origin) {
      throw new NewtonPortalError('Newton did not open the authenticated course dashboard.');
    }

    const sectionNames = await getSectionFilters(page);
    if (sectionNames.length === 0) {
      throw new NewtonPortalError('No visible section filters were found in the Newton course.');
    }

    return {
      currentUrl: page.url(),
      sectionNames,
      screenshot: await page.screenshot({ type: 'jpeg', quality: 45, animations: 'disabled' }),
    };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function getSectionFilters(page: Page): Promise<string[]> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('span')].some((element) => {
      const label = (element.textContent || '').trim().replace(/\s+/g, ' ');
      const bounds = element.getBoundingClientRect();
      return label.length > 3 &&
        label.length < 100 &&
        /\s*-\s+/.test(label) &&
        bounds.width > 0 &&
        bounds.height > 0;
    }), undefined, { timeout: 15000 }
  ).catch(() => undefined);

  return page.locator('span').evaluateAll((elements) => {
    const labels = elements.flatMap((element) => {
      const label = (element.textContent || '').trim().replace(/\s+/g, ' ');
      const bounds = element.getBoundingClientRect();
      return label.length > 3 &&
        label.length < 100 &&
        /\s*-\s+/.test(label) &&
        bounds.width > 0 &&
        bounds.height > 0
        ? [label]
        : [];
    });
    return [...new Set(labels)];
  });
}

function getCourseId(courseUrl: string | URL): string {
  const match = new URL(courseUrl).pathname.match(/^\/course\/([^/]+)\/details\/?$/);
  if (!match) throw new NewtonPortalError('Newton opened an unrecognized course page.');
  return match[1];
}

export async function discoverNewtonSections(
  onProgress?: (progress: NewtonScanProgress) => void
): Promise<ScrapedSubject[]> {
  const courseUrl = getConfiguredCourseUrl();
  const courseId = getCourseId(courseUrl);
  const { browser, context } = await createPortalContext();
  const discovered = new Map<string, ScrapedSubject>();

  try {
    const page = await context.newPage();
    const response = await page.goto(courseUrl.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    if (!response?.ok()) {
      throw new NewtonPortalError('Newton did not return the configured course dashboard. Sign in again and retry.');
    }

    onProgress?.({
      phase: 'sections',
      message: 'Reading visible section filters from the configured Newton course',
      completed: 0,
      total: 1,
    });
    const sectionNames = await getSectionFilters(page);
    if (sectionNames.length === 0) {
      throw new NewtonPortalError('No section filters were visible in the configured Newton course.');
    }

    for (const name of sectionNames) {
      const sectionKey = `${courseId}:${name.toLowerCase()}`;
      if (discovered.has(sectionKey)) continue;
      const code = name.split(/\s*-\s*/, 1)[0].trim();
      const subject: ScrapedSubject = {
        externalId: `portal-section:${hash(sectionKey).slice(0, 24)}`,
        name,
        code,
        courseUrl: courseUrl.toString(),
        portalCourseId: courseId,
      };
      await upsertSubject(subject);
      discovered.set(sectionKey, subject);
    }

    if (discovered.size === 0) {
      throw new NewtonPortalError('No Newton section filters were discovered in the configured course.');
    }

    onProgress?.({
      phase: 'sections',
      message: `Discovered ${discovered.size} Newton section filters`,
      completed: 1,
      total: 1,
    });
    return [...discovered.values()];
  } catch (error) {
    if (error instanceof NewtonPortalError) throw error;
    throw new NewtonPortalError('Newton section discovery failed. Check the saved session and retry.');
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function selectSection(page: Page, sectionName: string): Promise<void> {
  const sectionFilter = page.getByText(sectionName, { exact: true });
  if (await sectionFilter.count() === 0) {
    throw new NewtonPortalError(
      `Section "${sectionName}" is no longer available. Discover Newton sections again.`
    );
  }

  await sectionFilter.first().click({ timeout: 15000 });
  const assignmentsTab = page.getByText('Assignments', { exact: true });
  if (await assignmentsTab.count() === 0) {
    throw new NewtonPortalError('The Newton course has no visible Assignments tab.');
  }
  await assignmentsTab.evaluate((element) => (element as HTMLElement).click());

  try {
    await page.waitForFunction(
      (name) => [...document.querySelectorAll('div[class*="sc-f9d11e77-23"]')].some((header) => {
        const lines = (header as HTMLElement).innerText.split('\n').map((line) => line.trim());
        const list = header.nextElementSibling;
        return lines[0] === name &&
          !!list?.className.includes('sc-f9d11e77-20') &&
          [...list.children].some((row) => row.className.includes('sc-f9d11e77-19'));
      }),
      sectionName,
      { timeout: 30000 }
    );
  } catch {
    throw new NewtonPortalError(`Newton did not load assignment groups for "${sectionName}".`);
  }
}

async function readAssignmentGroups(page: Page, sectionName: string): Promise<PortalAssignmentGroup[]> {
  const groups = await page.locator(GROUP_CARD_SELECTOR).evaluateAll((cards, selectedSection) =>
    cards.flatMap((card, cardIndex) => {
      const children = [...card.children];
      return children.flatMap((header) => {
        if (!header.className.includes('sc-f9d11e77-23')) return [];
        const list = header.nextElementSibling;
        if (!list?.className.includes('sc-f9d11e77-20')) return [];

        const lines = (header as HTMLElement).innerText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const visibleSection = lines[0];
        const title = lines[1];
        if (visibleSection !== selectedSection || !title) return [];

        const groupType = title.match(/\s-\s(Post Class|In Class)$/i)?.[1];
        const releaseLabel = lines.find((line) => /^Release\s*-/i.test(line))
          ?.replace(/^Release\s*-\s*/i, '');
        const deadlineLabel = lines.find((line) => /^Deadline\s*-/i.test(line))
          ?.replace(/^Deadline\s*-\s*/i, '');
        const listIndex = children.filter((child, index) =>
          index < children.indexOf(header) && child.className.includes('sc-f9d11e77-20')
        ).length;
        const questions = [...list.children]
          .filter((row) => row.className.includes('sc-f9d11e77-19'))
          .map((row, rowIndex) => {
            const cells = [...row.children] as HTMLElement[];
            const cellText = (index: number) => (cells[index]?.innerText || '').trim();
            const topicCell = cells[4];
            const topics = topicCell
              ? [...topicCell.querySelectorAll('span')]
                  .map((topic) => (topic.innerText || '').trim())
                  .filter(Boolean)
              : [];
            return {
              title: cellText(1),
              difficulty: cellText(2) || undefined,
              portalStatus: cellText(0) || undefined,
              scoreLabel: cellText(3) || undefined,
              topics: [...new Set(topics)],
              solvedByLabel: cellText(5) || undefined,
              listIndex,
              rowIndex,
            };
          })
          .filter((question) => question.title);

        return [{
          title,
          groupType,
          releaseLabel,
          deadlineLabel,
          questions,
          cardIndex,
          listIndex,
        }];
      });
    }),
    sectionName
  );
  return groups;
}

function extractVisiblePrompt(bodyText: string, title: string): string {
  const lines = bodyText.replace(/\u00a0/g, ' ').split('\n').map((line) => line.trim());
  const questionHeading = lines.findIndex((line) => line.toUpperCase() === 'QUESTION');
  if (questionHeading < 0) return '';

  let start = questionHeading + 1;
  if (lines[start]?.toLowerCase() === title.toLowerCase()) start++;
  if (/^(easy|medium|hard)$/i.test(lines[start] || '')) start++;
  if (/^\d+\s*\/\s*\d+$/.test(lines[start] || '')) start++;
  while (start < lines.length && !lines[start]) start++;

  let end = lines.findIndex((line, index) =>
    index >= start && /^(HTTP REQUEST|TEST CASES)$/i.test(line)
  );
  if (end < 0) end = lines.length;
  return lines.slice(start, end).join('\n').trim();
}

function extractPromptSections(prompt: string) {
  const labels = [
    'Input Format',
    'Output Format',
    'Sample Input',
    'Sample Output',
    'Input',
    'Output',
    'Constraints',
    'Examples?',
    'Starter Code',
    'Code Template',
    'Language',
  ];
  const labelPattern = new RegExp(`^(${labels.join('|')})\\s*:?\\s*(.*)$`, 'i');
  const values = new Map<string, string[]>();
  const lines = prompt.split('\n');
  let currentLabel: string | null = null;

  for (const line of lines) {
    const match = line.trim().match(labelPattern);
    if (match) {
      currentLabel = match[1].toLowerCase().replace(/\?$/, '');
      values.set(currentLabel, match[2] ? [match[2]] : []);
    } else if (currentLabel) {
      values.get(currentLabel)?.push(line);
    }
  }

  const section = (...names: string[]) => {
    const found = names.map((name) => values.get(name)).find((value) => value?.some((line) => line.trim()));
    return found?.join('\n').trim() || undefined;
  };
  const exampleValues = [...values.entries()]
    .filter(([name]) => name.startsWith('example'))
    .flatMap(([, value]) => value)
    .join('\n')
    .trim();

  return {
    inputFormat: section('input format', 'input'),
    outputFormat: section('output format', 'output'),
    constraints: section('constraints'),
    sampleInput: section('sample input'),
    sampleOutput: section('sample output'),
    examples: exampleValues || undefined,
    starterCode: section('starter code', 'code template'),
    language: section('language'),
  };
}

async function readQuestionPage(page: Page, title: string): Promise<{
  questionUrl: string;
  description: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  sampleInput?: string;
  sampleOutput?: string;
  language?: string;
  examples?: string;
  starterCode?: string;
}> {
  const url = new URL(page.url());
  if (url.origin !== getConfiguredCourseUrl().origin) {
    throw new NewtonPortalError('The question opened outside the Newton assignment portal.');
  }
  try {
    await page.waitForFunction((questionTitle) => {
      const lines = document.body.innerText.split('\n').map((line) => line.trim().toLowerCase());
      const questionIndex = lines.findIndex((line) => line === 'question');
      return questionIndex >= 0 &&
        lines.slice(questionIndex + 1).some((line) => line === questionTitle.toLowerCase());
    }, title, { timeout: 30000 });
  } catch {
    throw new NewtonPortalError(`Newton did not load a visible problem statement for "${title}".`);
  }

  const bodyText = await page.locator('body').innerText({ timeout: 15000 });
  const description = extractVisiblePrompt(bodyText, title);
  if (!description) {
    throw new NewtonPortalError(`Newton did not expose a visible problem statement for "${title}".`);
  }

  return {
    questionUrl: resolveNewtonUrl(url.pathname),
    description,
    ...extractPromptSections(description),
  };
}

export async function scanNewtonSubject(
  subjectId: string,
  onProgress?: (progress: NewtonScanProgress) => void | Promise<void>,
  options: NewtonScanOptions = {}
): Promise<{ assignmentsFound: number; questionsFound: number; warnings: string[] }> {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw new NewtonPortalError('Newton section was not found in the local database.');
  if (!subject.portalCourseId) {
    throw new NewtonPortalError('Rediscover Newton sections before scanning this section.');
  }

  const courseUrl = getConfiguredCourseUrl();
  if (getCourseId(courseUrl) !== subject.portalCourseId) {
    throw new NewtonPortalError('The saved Newton course link is invalid. Discover sections again.');
  }

  const { browser, context } = await createPortalContext(options.sessionEmail);
  const warnings: string[] = [];
  const checkpoint = async () => {
    if (!options.waitForContinue) return;
    try {
      if (!await options.waitForContinue()) throw new NewtonScanCancelledError();
    } catch (error) {
      if (error instanceof NewtonScanCancelledError) throw error;
      throw new NewtonScanControlError('The agent could not read its current control state.');
    }
  };
  const reportActivity = async (
    action: NewtonPortalActivity['action'],
    summary: string,
    actionPage: Page,
    fields: Partial<Omit<NewtonPortalActivity, 'action' | 'summary' | 'currentUrl' | 'screenshot'>> = {}
  ) => {
    if (!options.onActivity) return;
    try {
      await options.onActivity({
        action,
        summary,
        currentUrl: actionPage.url(),
        currentSubject: subject.name,
        completed: 0,
        total: 0,
        screenshot: await actionPage.screenshot({
          type: 'jpeg',
          quality: 45,
          animations: 'disabled',
        }),
        ...fields,
        verified: fields.verified ?? true,
      });
    } catch {
      throw new NewtonPortalActivityError('Agent activity could not be saved.');
    }
  };

  try {
    await checkpoint();
    await onProgress?.({
      phase: 'navigation',
      message: 'Opening the authenticated Newton course',
      completed: 0,
      total: 0,
      currentSubject: subject.name,
    });
    const page = await context.newPage();
    const courseResponse = await page.goto(courseUrl.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    if (!courseResponse?.ok()) {
      throw new NewtonPortalError('Newton could not open the saved course page. Discover sections again.');
    }
    await reportActivity('navigate', 'Opened the configured Newton course page', page, {
      verified: new URL(page.url()).origin === courseUrl.origin,
    });

    await onProgress?.({
      phase: 'sections',
      message: 'Checking visible Newton section filters',
      completed: 0,
      total: 0,
      currentUrl: page.url(),
      currentSubject: subject.name,
    });
    const availableSections = await getSectionFilters(page);
    if (!availableSections.includes(subject.name)) {
      throw new NewtonPortalError(`Section "${subject.name}" is no longer visible in Newton.`);
    }

    await checkpoint();
    await onProgress?.({
      phase: 'selection',
      message: `Opening assignments for ${subject.name}`,
      completed: 0,
      total: 0,
      currentUrl: page.url(),
      currentSubject: subject.name,
    });
    await selectSection(page, subject.name);
    await reportActivity('select_section', `Opened assignments for ${subject.name}`, page, {
      verified: true,
    });

    await onProgress?.({
      phase: 'groups',
      message: 'Reading visible assignment groups and questions',
      completed: 0,
      total: 0,
      currentUrl: page.url(),
      currentSubject: subject.name,
    });
    const groups = await readAssignmentGroups(page, subject.name);
    if (groups.length === 0) {
      throw new NewtonPortalError(`No assignment groups were visible for "${subject.name}".`);
    }
    const totalQuestions = groups.reduce((count, group) => count + group.questions.length, 0);
    if (totalQuestions === 0) {
      throw new NewtonPortalError(`Newton showed assignment groups but no visible questions for "${subject.name}".`);
    }

    const targets = groups.flatMap((group, groupIndex) =>
      group.questions.map((question, questionIndex) => ({
        id: `group-${groupIndex}-question-${questionIndex}`,
        assignmentTitle: group.title,
        questionTitle: question.title,
      }))
    );
    const plannedIds = options.planQuestionOrder
      ? await options.planQuestionOrder(subject.name, targets)
      : targets.map((target) => target.id);
    const knownTargets = new Map(targets.map((target) => [target.id, target]));
    if (
      plannedIds.length !== targets.length ||
      new Set(plannedIds).size !== targets.length ||
      plannedIds.some((id) => !knownTargets.has(id))
    ) {
      throw new NewtonPortalError('The AI plan did not cover each visible question exactly once.');
    }

    await reportActivity('read_groups', `Found ${groups.length} visible assignment groups`, page, {
      verified: true,
      total: totalQuestions,
    });
    await onProgress?.({
      phase: 'groups',
      message: `Found ${groups.length} assignment groups and ${totalQuestions} questions`,
      completed: 0,
      total: totalQuestions,
      currentUrl: page.url(),
      currentSubject: subject.name,
    });

    let questionsFound = 0;
    let completedQuestions = 0;
    const assignmentUrl = resolveNewtonUrl(new URL(page.url()).pathname);
    const assignments = [];
    for (const group of groups) {
      const assignmentExternalId = `portal-group:${hash([
        subject.externalId,
        group.title,
        group.releaseLabel || '',
        group.deadlineLabel || '',
      ].join('\n')).slice(0, 24)}`;
      assignments.push(await upsertAssignment(subjectId, {
        externalId: assignmentExternalId,
        title: group.title,
        assignmentUrl,
        sectionName: subject.name,
        groupType: group.groupType,
        releaseLabel: group.releaseLabel,
        deadlineLabel: group.deadlineLabel,
        description: group.title,
      }));
    }
    const targetIndexes = new Map(targets.map((target, index) => [target.id, index]));

    for (const targetId of plannedIds) {
      await checkpoint();
      const targetIndex = targetIndexes.get(targetId);
      if (targetIndex === undefined) {
        throw new NewtonPortalError('The AI plan referenced an unknown visible question.');
      }

      let offset = 0;
      let groupIndex = 0;
      while (groupIndex < groups.length && targetIndex >= offset + groups[groupIndex].questions.length) {
        offset += groups[groupIndex].questions.length;
        groupIndex++;
      }
      const group = groups[groupIndex];
      const questionIndex = targetIndex - offset;
      const question = group.questions[questionIndex];
      const assignment = assignments[groupIndex];

      const card = page.locator(GROUP_CARD_SELECTOR).nth(group.cardIndex);
      const questionList = card
        .locator(':scope > div[class*="sc-f9d11e77-20"]')
        .nth(group.listIndex);
      const row = questionList
        .locator(':scope > div[class*="sc-f9d11e77-19"]')
        .nth(question.rowIndex);

      let questionPage: Page | undefined;
      try {
        await row.scrollIntoViewIfNeeded({ timeout: 15000 });
        if (!await row.isVisible()) {
          throw new NewtonPortalError(`Question "${question.title}" was not visible after scrolling.`);
        }
        await reportActivity('scroll', `Scrolled to "${question.title}"`, page, {
          verified: true,
          currentAssignment: group.title,
          currentQuestion: question.title,
          completed: completedQuestions,
          total: totalQuestions,
        });

        const newPage = context.waitForEvent('page', { timeout: 15000 }).catch(() => undefined);
        await row.evaluate((element) => (element as HTMLElement).click());
        questionPage = await newPage;
        if (!questionPage) {
          throw new NewtonPortalError(`Newton did not open a question page for "${question.title}".`);
        }
        await questionPage.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => undefined);
        const visibleDetails = await readQuestionPage(questionPage, question.title);
        await reportActivity('open_question', `Opened "${question.title}"`, questionPage, {
          verified: true,
          currentAssignment: group.title,
          currentQuestion: question.title,
          completed: completedQuestions,
          total: totalQuestions,
        });

        const questionPath = new URL(visibleDetails.questionUrl).pathname;
        const questionExternalId = questionPath.split('/').filter(Boolean).pop();
        if (!questionExternalId) {
          throw new NewtonPortalError(`Newton did not provide a question URL for "${question.title}".`);
        }

        const questionInput: ScrapedQuestion = {
          externalId: questionExternalId,
          title: question.title,
          ...visibleDetails,
          difficulty: question.difficulty,
          portalStatus: question.portalStatus,
          scoreLabel: question.scoreLabel,
          topics: question.topics,
          solvedByLabel: question.solvedByLabel,
        };
        const savedQuestion = await upsertQuestion(assignment.id, questionInput);
        if (
          savedQuestion.externalId !== questionExternalId ||
          savedQuestion.description !== visibleDetails.description
        ) {
          throw new NewtonPortalError(`The visible statement for "${question.title}" was not verified after saving.`);
        }
        questionsFound++;
        await reportActivity('extract_problem', `Saved the visible problem statement for "${question.title}"`, questionPage, {
          verified: true,
          currentAssignment: group.title,
          currentQuestion: question.title,
          completed: completedQuestions + 1,
          total: totalQuestions,
        });
      } catch (error) {
        if (
          error instanceof NewtonScanCancelledError ||
          error instanceof NewtonScanControlError ||
          error instanceof NewtonPortalActivityError
        ) {
          throw error;
        }
        const message = error instanceof NewtonPortalError
          ? error.message
          : `Could not read the visible question page for "${question.title}".`;
        warnings.push(message);
        await reportActivity('open_question', message, questionPage || page, {
          verified: false,
          error: message,
          currentAssignment: group.title,
          currentQuestion: question.title,
          completed: completedQuestions,
          total: totalQuestions,
        });
      } finally {
        if (questionPage && !questionPage.isClosed()) {
          await questionPage.close().catch(() => undefined);
        }
        const returnedToAssignmentList = !page.isClosed() &&
          new URL(page.url()).origin === courseUrl.origin &&
          new URL(page.url()).pathname === new URL(assignmentUrl).pathname &&
          await page.locator(GROUP_CARD_SELECTOR).count() > 0;
        await reportActivity('back', `Returned to the assignment list after "${question.title}"`, page, {
          verified: returnedToAssignmentList,
          error: returnedToAssignmentList ? undefined : 'The assignment list was not restored.',
          currentAssignment: group.title,
          currentQuestion: question.title,
          completed: completedQuestions + 1,
          total: totalQuestions,
        });
        completedQuestions++;
        await onProgress?.({
          phase: 'questions',
          message: `Read ${completedQuestions} of ${totalQuestions} questions`,
          completed: completedQuestions,
          total: totalQuestions,
          currentUrl: page.url(),
          currentSubject: subject.name,
          currentAssignment: group.title,
          currentQuestion: question.title,
        });
      }
    }

    await refreshSubjectStats(subjectId);
    await prisma.subject.update({
      where: { id: subjectId },
      data: {
        discoveryStatus: warnings.length ? 'ERROR' : 'SCANNED',
        lastScannedAt: new Date(),
      },
    });

    return {
      assignmentsFound: groups.length,
      questionsFound,
      warnings,
    };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
