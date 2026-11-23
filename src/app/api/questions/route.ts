import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isQuestionStatus } from '@/lib/constants';

/**
 * GET /api/questions - List all questions with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const assignmentId = searchParams.get('assignmentId');
    const status = searchParams.get('status');
    const language = searchParams.get('language');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};

    if (assignmentId) {
      where.assignmentId = assignmentId;
    } else if (subjectId) {
      where.assignment = { subjectId };
    }

    if (status && isQuestionStatus(status)) where.processingStatus = status;
    if (language) where.language = language;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          assignment: {
            include: {
              subject: { select: { id: true, name: true, code: true } },
            },
          },
          solutions: { where: { isPreferred: true }, take: 1 },
          _count: { select: { testCases: true, solutions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.question.count({ where }),
    ]);

    return NextResponse.json({
      questions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
