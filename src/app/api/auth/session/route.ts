import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { saveSession } from '@/lib/newton-scraper';

/**
 * POST /api/auth/session - Import session cookies from browser (manual login)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, cookies } = body;

    if (!email || !cookies) {
      return NextResponse.json({ error: 'Email and cookies are required' }, { status: 400 });
    }

    const sessionToken = await saveSession(email, cookies);

    const response = NextResponse.json({ success: true, message: 'Session imported' });
    response.cookies.set('newton_session', sessionToken, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
