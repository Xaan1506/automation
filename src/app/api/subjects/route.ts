import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  upsertSubject,
  parseSubjectsFromApiResponse,
  saveSession,
} from '@/lib/newton-scraper';
import { isSubjectStatus } from '@/lib/constants';

const NEWTON_BASE_URL = process.env.NEWTON_BASE_URL || 'https://learn.newtonschool.co';

/**
 * GET /api/subjects - List all discovered subjects
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status && isSubjectStatus(status)) where.discoveryStatus = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        stats: true,
        _count: { select: { assignments: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ subjects, total: subjects.length });
  } catch (err) {
    console.error('GET /api/subjects error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/subjects - Trigger subject discovery from Newton
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, forceRefresh } = body;

    // Try to fetch subjects from Newton's API
    // Newton uses JWT tokens after login; we'll use the saved session
    const session = await prisma.newtonSession.findFirst({
      where: { email: email || { not: '' }, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'No active Newton session. Please authenticate first.' },
        { status: 401 }
      );
    }

    const cookies = JSON.parse(session.cookieData);
    const cookieHeader = cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ');

    // Attempt multiple Newton API endpoints
    const endpoints = [
      `${NEWTON_BASE_URL}/api/v1/courses`,
      `${NEWTON_BASE_URL}/api/v1/my-courses`,
      `${NEWTON_BASE_URL}/api/courses`,
      `${NEWTON_BASE_URL}/api/student/courses`,
      `${NEWTON_BASE_URL}/api/v2/student/courses`,
    ];

    let discoveredSubjects = 0;
    let lastError = '';

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            Cookie: cookieHeader,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) continue;

        const data = await response.json();
        const subjects = parseSubjectsFromApiResponse(data);

        if (subjects.length > 0) {
          for (const subject of subjects) {
            await upsertSubject(subject);
            discoveredSubjects++;
          }
          break;
        }
      } catch (err) {
        lastError = String(err);
        continue;
      }
    }

    if (discoveredSubjects === 0) {
      return NextResponse.json(
        {
          message: 'Could not auto-discover subjects. Use manual scraping or check credentials.',
          error: lastError,
          discoveredSubjects: 0,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ discoveredSubjects, message: 'Discovery complete' });
  } catch (err) {
    console.error('POST /api/subjects error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
