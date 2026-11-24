import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { discoverNewtonSections, NewtonPortalError } from '@/lib/newton-portal';
import { isSubjectStatus } from '@/lib/constants';

/**
 * GET /api/subjects - List all discovered subjects
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status && isSubjectStatus(status)) where.discoveryStatus = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        stats: true,
        _count: { select: { assignments: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ subjects, total: subjects.length });
  } catch (err) {
    console.error('GET /api/subjects error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/subjects - Discover Newton sections through the authenticated portal UI
 */
export async function POST(request: NextRequest) {
  try {
    const subjects = await discoverNewtonSections();
    return NextResponse.json({
      discoveredSubjects: subjects.length,
      subjects: subjects.map(({ name, code }) => ({ name, code })),
      message: `Discovered ${subjects.length} Newton section filters`,
    });
  } catch (error) {
    const message = error instanceof NewtonPortalError
      ? error.message
      : 'Newton section discovery failed.';
    const status = /session/i.test(message) ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
