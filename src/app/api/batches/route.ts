import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createBatch, startBatch, pauseBatch, resumeBatch, cancelBatch, retryFailedJobs, getBatchProgress } from '@/lib/batch-processor';

/**
 * GET /api/batches - List all batches
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const batch = await getBatchProgress(id);
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
      return NextResponse.json({ batch });
    }

    const batches = await prisma.batch.findMany({
      include: {
        _count: { select: { assignments: true, jobs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ batches });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/batches - Create and optionally start a batch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, assignmentIds, config, action } = body;

    if (action === 'create') {
      if (!assignmentIds?.length) {
        return NextResponse.json({ error: 'assignmentIds required' }, { status: 400 });
      }
      const batchId = await createBatch(
        name || `Batch ${new Date().toLocaleString('en-IN')}`,
        assignmentIds,
        config
      );
      return NextResponse.json({ batchId, message: 'Batch created' });
    }

    if (action === 'start') {
      const { batchId } = body;
      if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 });
      // Start in background
      startBatch(batchId).catch(console.error);
      return NextResponse.json({ message: 'Batch started' });
    }

    if (action === 'pause') {
      await pauseBatch(body.batchId);
      return NextResponse.json({ message: 'Batch paused' });
    }

    if (action === 'resume') {
      resumeBatch(body.batchId).catch(console.error);
      return NextResponse.json({ message: 'Batch resumed' });
    }

    if (action === 'cancel') {
      await cancelBatch(body.batchId);
      return NextResponse.json({ message: 'Batch cancelled' });
    }

    if (action === 'retry') {
      retryFailedJobs(body.batchId).catch(console.error);
      return NextResponse.json({ message: 'Retrying failed jobs' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
