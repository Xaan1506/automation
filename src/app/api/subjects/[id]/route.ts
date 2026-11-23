import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { refreshSubjectStats } from '@/lib/newton-scraper';
import { SubjectStatus } from '@/lib/constants';

/**
 * GET /api/subjects/[id] - Get subject details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: params.id },
      include: {
        stats: true,
        assignments: {
          include: {
            _count: { select: { questions: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    return NextResponse.json({ subject });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/subjects/[id] - Rescan subject for assignments
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const subject = await prisma.subject.findUnique({ where: { id: params.id } });
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    await prisma.subject.update({
      where: { id: params.id },
      data: { discoveryStatus: SubjectStatus.SCANNING },
    });

    // Refresh stats
    await refreshSubjectStats(params.id);

    await prisma.subject.update({
      where: { id: params.id },
      data: { discoveryStatus: SubjectStatus.SCANNED, lastScannedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Subject rescanned' });
  } catch (err) {
    await prisma.subject.update({
      where: { id: params.id },
      data: { discoveryStatus: SubjectStatus.ERROR },
    }).catch(() => {});
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
