import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isQuestionStatus } from '@/lib/constants';
import { NewtonPortalError, scanNewtonSubject } from '@/lib/newton-portal';

export const runtime = 'nodejs';
export const maxDuration = 300;

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
 * POST /api/assignments/[id]/questions - Refresh question data from the actual Newton portal
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

    const result = await scanNewtonSubject(assignment.subjectId);
    const discovered = await prisma.question.count({ where: { assignmentId: params.id } });
    return NextResponse.json({
      discovered,
      scannedAssignments: result.assignmentsFound,
      warnings: result.warnings,
      message: `Newton scan refreshed ${discovered} questions for this assignment group`,
    });
  } catch (error) {
    const message = error instanceof NewtonPortalError
      ? error.message
      : 'Newton question scan failed. Retry the section scan.';
    const status = /session/i.test(message) ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
