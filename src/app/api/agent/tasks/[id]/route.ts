import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedNewtonEmail } from '@/lib/newton-agent-auth';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerEmail = await getAuthenticatedNewtonEmail(request);
    if (!ownerEmail) {
      return NextResponse.json({ error: 'Newton session is not authenticated.' }, { status: 401 });
    }

    const task = await prisma.agentTask.findFirst({
      where: { id: params.id, ownerEmail },
      include: {
        actions: {
          orderBy: { sequence: 'asc' },
          take: 200,
        },
      },
    });
    if (!task) return NextResponse.json({ error: 'Agent task not found.' }, { status: 404 });

    const { ownerEmail: _ownerEmail, ...safeTask } = task;
    return NextResponse.json({ task: safeTask });
  } catch (error) {
    console.error('Agent task could not be loaded:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Agent task details are unavailable.' }, { status: 500 });
  }
}
