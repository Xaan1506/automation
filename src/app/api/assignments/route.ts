import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAssignmentStatus } from '@/lib/constants';
import { NewtonPortalError, scanNewtonSubject } from '@/lib/newton-portal';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET /api/assignments - List assignments (optionally filtered by subject)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectIds = searchParams.getAll('subjectId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const ids = searchParams.getAll('id');

    const where: Record<string, unknown> = {};
    if (subjectIds.length > 0) where.subjectId = { in: subjectIds };
    if (ids.length > 0) where.id = { in: ids };
    if (status && isAssignmentStatus(status)) where.processingStatus = status;
    if (search) {
      where.title = { contains: search };
    }

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { questions: true } },
      },
      orderBy: [{ subjectId: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ assignments, total: assignments.length });
  } catch (err) {
    console.error('GET /api/assignments error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/assignments - Scan a Newton section through the authenticated portal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subjectId } = body;

    if (typeof subjectId !== 'string' || !subjectId) {
      return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
    }

    const result = await scanNewtonSubject(subjectId);
    return NextResponse.json({
      discovered: result.assignmentsFound,
      questions: result.questionsFound,
      warnings: result.warnings,
      message: `Scanned ${result.assignmentsFound} assignment groups and ${result.questionsFound} questions`,
    });
  } catch (error) {
    const message = error instanceof NewtonPortalError
      ? error.message
      : 'Newton assignment scan failed. Retry the section scan.';
    const status = /session/i.test(message) ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
