import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedNewtonEmail } from '@/lib/newton-agent-auth';
import {
  containsCredentialMaterial,
  getNewtonAgentActiveStatuses,
  isAgentAIConfigured,
  launchNewtonAgentTask,
  isNewtonAgentTaskActive,
} from '@/lib/newton-agent';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const ownerEmail = await getAuthenticatedNewtonEmail(request);
    if (!ownerEmail) {
      return NextResponse.json({ error: 'Newton session is not authenticated.' }, { status: 401 });
    }

    const tasks = await prisma.agentTask.findMany({
      where: { ownerEmail },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        instruction: true,
        status: true,
        subjectId: true,
        currentUrl: true,
        currentSubject: true,
        currentAssignment: true,
        progress: true,
        total: true,
        result: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Agent task history could not be loaded:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Agent task history is unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerEmail = await getAuthenticatedNewtonEmail(request);
    if (!ownerEmail) {
      return NextResponse.json({ error: 'Newton session is not authenticated.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : '';
    if (!instruction || instruction.length > 2000) {
      return NextResponse.json(
        { error: 'Enter an instruction between 1 and 2000 characters.' },
        { status: 400 }
      );
    }
    if (containsCredentialMaterial(instruction)) {
      return NextResponse.json(
        { error: 'Do not include passwords, cookies, tokens, or API keys in agent instructions.' },
        { status: 400 }
      );
    }
    if (!isAgentAIConfigured()) {
      return NextResponse.json(
        { error: 'Configure GROQ_API_KEY or OPENAI_API_KEY in .env to enable the AI browser planner.' },
        { status: 503 }
      );
    }

    const activeStatuses = getNewtonAgentActiveStatuses();
    const existing = await prisma.agentTask.findFirst({
      where: { ownerEmail, status: { in: activeStatuses } },
      select: { id: true, status: true },
    });
    if (existing && isNewtonAgentTaskActive(existing.id)) {
      return NextResponse.json(
        { error: 'Another browser-agent task is active. Finish or cancel it before starting another.' },
        { status: 409 }
      );
    }
    if (existing) {
      await prisma.agentTask.update({
        where: { id: existing.id },
        data: {
          status: 'FAILED',
          errorMessage: 'The application restarted before this task completed. Start a new task.',
        },
      });
    }

    const task = await prisma.agentTask.create({
      data: {
        ownerEmail,
        instruction,
        status: 'QUEUED',
      },
      select: {
        id: true,
        instruction: true,
        status: true,
        createdAt: true,
      },
    });
    launchNewtonAgentTask(task.id);
    return NextResponse.json({ task }, { status: 202 });
  } catch (error) {
    console.error('Agent task could not be started:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'The browser-agent task could not be started.' }, { status: 500 });
  }
}
