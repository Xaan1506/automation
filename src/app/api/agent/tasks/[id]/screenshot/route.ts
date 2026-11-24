import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedNewtonEmail } from '@/lib/newton-agent-auth';
import { getNewtonAgentScreenshot } from '@/lib/newton-agent';

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
      select: { id: true },
    });
    if (!task) return NextResponse.json({ error: 'Agent task not found.' }, { status: 404 });

    const screenshot = getNewtonAgentScreenshot(task.id);
    if (!screenshot) return new NextResponse(null, { status: 404 });

    return new Response(new Uint8Array(screenshot), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Agent screenshot could not be served:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'The current browser screenshot is unavailable.' }, { status: 500 });
  }
}
