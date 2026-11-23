import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        questions: {
          include: {
            solutions: { orderBy: { createdAt: 'desc' } },
            _count: { select: { testCases: true } },
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json({ assignment });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
