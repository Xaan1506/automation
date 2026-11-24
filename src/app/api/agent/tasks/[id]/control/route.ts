import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedNewtonEmail } from '@/lib/newton-agent-auth';
import { isNewtonAgentTaskActive } from '@/lib/newton-agent';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerEmail = await getAuthenticatedNewtonEmail(request);
    if (!ownerEmail) {
      return NextResponse.json({ error: 'Newton session is not authenticated.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const command = body?.command;
    const task = await prisma.agentTask.findFirst({
      where: { id: params.id, ownerEmail },
      select: { id: true, status: true },
    });
    if (!task) return NextResponse.json({ error: 'Agent task not found.' }, { status: 404 });

    if (command === 'pause' && task.status === 'RUNNING') {
      await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'PAUSED' } });
    } else if (command === 'resume' && task.status === 'PAUSED') {
      await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'RUNNING' } });
    } else if (
      command === 'cancel' &&
      ['QUEUED', 'RUNNING', 'PAUSED', 'CANCELLING'].includes(task.status)
    ) {
      await prisma.agentTask.update({
        where: { id: task.id },
        data: {
          status: isNewtonAgentTaskActive(task.id) ? 'CANCELLING' : 'CANCELLED',
        },
      });
    } else {
      return NextResponse.json(
        { error: `Cannot ${String(command)} an agent task in ${task.status} state.` },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Agent task control failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Agent task control could not be applied.' }, { status: 500 });
  }
}
