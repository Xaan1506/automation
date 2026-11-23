import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAssignmentStatus, AssignmentStatus } from '@/lib/constants';

/**
 * GET /api/assignments - List assignments (optionally filtered by subject)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectIds = searchParams.getAll('subjectId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const ids = searchParams.getAll('id');

    const where: Record<string, unknown> = {};
    if (subjectIds.length > 0) where.subjectId = { in: subjectIds };
    if (ids.length > 0) where.id = { in: ids };
    if (status && isAssignmentStatus(status)) where.processingStatus = status;
    if (search) {
      where.title = { contains: search };
    }

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { questions: true } },
      },
      orderBy: [{ subjectId: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ assignments, total: assignments.length });
  } catch (err) {
    console.error('GET /api/assignments error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/assignments - Trigger assignment discovery for a subject
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subjectId } = body;

    if (!subjectId) {
      return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
    }

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const session = await prisma.newtonSession.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    const cookies = JSON.parse(session.cookieData);
    const cookieHeader = cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ');

    const NEWTON_BASE_URL = process.env.NEWTON_BASE_URL || 'https://learn.newtonschool.co';
    
    const endpoints = [
      `${NEWTON_BASE_URL}/api/v1/courses/${subject.externalId}/assignments`,
      `${NEWTON_BASE_URL}/api/v1/assignments?course_id=${subject.externalId}`,
      `${NEWTON_BASE_URL}/api/assignments?course=${subject.externalId}`,
    ];

    let discovered = 0;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            Cookie: cookieHeader,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) continue;

        const data = await response.json();
        const items = Array.isArray(data)
          ? data
          : (data.data || data.results || data.assignments || []);

        for (const item of items) {
          const id = String(item.id || item._id || '');
          const title = String(item.title || item.name || `Assignment ${id}`);
          if (!id) continue;

          await prisma.assignment.upsert({
            where: { subjectId_externalId: { subjectId, externalId: id } },
            create: {
              externalId: id,
              subjectId,
              title,
              assignmentUrl: String(item.url || `${NEWTON_BASE_URL}/assignment/${id}`),
              description: String(item.description || ''),
              processingStatus: AssignmentStatus.NOT_PROCESSED,
            },
            update: { title, updatedAt: new Date() },
          });
          discovered++;
        }
        if (discovered > 0) break;
      } catch {
        continue;
      }
    }

    return NextResponse.json({ discovered, message: `Found ${discovered} assignments` });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
