import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processQuestion } from '@/lib/ai-processor';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: {
        assignment: {
          include: { subject: { select: { id: true, name: true, code: true } } },
        },
        solutions: { orderBy: { version: 'desc' } },
        testCases: true,
        processingJobs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ question });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/questions/[id] - Process a single question
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Start processing in background
    processQuestion(params.id).catch(console.error);
    return NextResponse.json({ message: 'Processing started', questionId: params.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
