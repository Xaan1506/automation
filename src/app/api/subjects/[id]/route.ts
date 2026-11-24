import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NewtonPortalError, scanNewtonSubject } from '@/lib/newton-portal';
import { SubjectStatus } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 300;

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
 * POST /api/subjects/[id] - Scan a Newton section using its visible portal UI
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const subject = await prisma.subject.findUnique({ where: { id: params.id } });
  if (!subject) {
    return NextResponse.json({ error: 'Newton section not found' }, { status: 404 });
  }

  await prisma.subject.update({
    where: { id: params.id },
    data: { discoveryStatus: SubjectStatus.SCANNING },
  });

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      const emit = (event: Record<string, unknown>) => {
        if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      void (async () => {
        try {
          const result = await scanNewtonSubject(params.id, (progress) => {
            emit({ type: 'progress', ...progress });
          });
          emit({ type: 'complete', result });
        } catch (error) {
          await prisma.subject.update({
            where: { id: params.id },
            data: { discoveryStatus: SubjectStatus.ERROR },
          }).catch(() => undefined);
          const message = error instanceof NewtonPortalError
            ? error.message
            : 'Newton assignment scan failed. Retry the section scan.';
          emit({ type: 'error', error: message });
        } finally {
          if (!cancelled) controller.close();
        }
      })();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
