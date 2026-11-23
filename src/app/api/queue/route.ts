import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isJobStatus } from '@/lib/constants';

/**
 * GET /api/queue - Processing job queue
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (batchId) where.batchId = batchId;
    if (status && isJobStatus(status)) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.processingJob.findMany({
        where,
        include: {
          question: {
            include: {
              assignment: {
                include: {
                  subject: { select: { name: true, code: true } },
                },
              },
            },
          },
          batch: { select: { id: true, name: true, status: true } },
        },
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.processingJob.count({ where }),
    ]);

    // Queue summary
    const summary = await prisma.processingJob.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: batchId ? { batchId } : undefined,
    });

    return NextResponse.json({ jobs, total, summary, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
