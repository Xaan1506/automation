import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { upsertQuestion, parseQuestionsFromApiResponse } from '@/lib/newton-scraper';
import { isQuestionStatus, AssignmentStatus } from '@/lib/constants';

const NEWTON_BASE_URL = process.env.NEWTON_BASE_URL || 'https://learn.newtonschool.co';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const questions = await prisma.question.findMany({
      where: {
        assignmentId: params.id,
        ...(status && isQuestionStatus(status) ? { processingStatus: status } : {}),
      },
      include: {
        solutions: { where: { isPreferred: true }, take: 1 },
        _count: { select: { testCases: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ questions, total: questions.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/assignments/[id]/questions - Scrape questions from Newton
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      include: { subject: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const session = await prisma.newtonSession.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    const cookies = JSON.parse(session.cookieData);
    const cookieHeader = cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ');

    // Try multiple question API patterns
    const endpoints = [
      `${NEWTON_BASE_URL}/api/v1/assignments/${assignment.externalId}/questions`,
      `${NEWTON_BASE_URL}/api/v1/questions?assignment_id=${assignment.externalId}`,
      `${NEWTON_BASE_URL}/api/assignments/${assignment.externalId}`,
      `${assignment.assignmentUrl}/api`,
    ];

    let discovered = 0;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            Cookie: cookieHeader,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) continue;

        const data = await response.json();
        const questions = parseQuestionsFromApiResponse(data);

        for (const q of questions) {
          await upsertQuestion(params.id, q);
          discovered++;
        }

        if (discovered > 0) break;
      } catch {
        continue;
      }
    }

    // Update assignment status
    if (discovered > 0) {
      await prisma.assignment.update({
        where: { id: params.id },
        data: { processingStatus: AssignmentStatus.QUESTIONS_EXTRACTED },
      });
    }

    return NextResponse.json({ discovered, message: `Extracted ${discovered} questions` });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
