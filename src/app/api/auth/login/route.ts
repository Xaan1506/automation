import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { saveSession } from '@/lib/newton-scraper';

const NEWTON_BASE_URL = process.env.NEWTON_BASE_URL || 'https://learn.newtonschool.co';

/**
 * POST /api/auth/login - Login to Newton School and persist session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Try Newton's login API endpoints
    const loginEndpoints = [
      `${NEWTON_BASE_URL}/api/v1/auth/login`,
      `${NEWTON_BASE_URL}/api/auth/login`,
      `${NEWTON_BASE_URL}/api/v2/auth/login`,
      `${NEWTON_BASE_URL}/api/login`,
    ];

    let loginSuccess = false;
    let sessionCookies: Array<{ name: string; value: string; domain?: string }> = [];
    let userInfo: Record<string, unknown> = {};
    let lastError = '';

    for (const endpoint of loginEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Origin: NEWTON_BASE_URL,
            Referer: `${NEWTON_BASE_URL}/login`,
          },
          body: JSON.stringify({ email, password }),
          signal: AbortSignal.timeout(15000),
        });

        const responseText = await response.text();
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { raw: responseText };
        }

        if (response.ok || response.status === 200) {
          // Extract cookies from response
          const setCookie = response.headers.getSetCookie?.() || [];
          sessionCookies = setCookie.map((cookie) => {
            const parts = cookie.split(';');
            const [nameValue] = parts[0].split('=');
            return {
              name: nameValue.trim(),
              value: parts[0].split('=').slice(1).join('=').trim(),
            };
          });

          // Also look for token in response body
          const token =
            (data.token as string) ||
            (data.access_token as string) ||
            (data.jwt as string) ||
            (data.data as Record<string, unknown>)?.token as string;

          if (token) {
            sessionCookies.push({ name: 'auth_token', value: token });
          }

          userInfo = {
            email,
            name: (data.name as string) || (data.user as Record<string, unknown>)?.name as string || email,
            token,
          };

          loginSuccess = true;
          break;
        }

        lastError = `${response.status}: ${responseText.slice(0, 200)}`;
      } catch (err) {
        lastError = String(err);
        continue;
      }
    }

    if (!loginSuccess || sessionCookies.length === 0) {
      // Store partial state so user knows to try browser login
      return NextResponse.json(
        {
          error: 'Login failed. Please check credentials or try browser-based login.',
          details: lastError,
          requiresBrowserLogin: true,
        },
        { status: 401 }
      );
    }

    // Save session to database
    const sessionToken = await saveSession(email, sessionCookies);

    const response = NextResponse.json({
      success: true,
      user: userInfo,
      cookieCount: sessionCookies.length,
      message: 'Logged in successfully',
    });

    response.cookies.set('newton_session', sessionToken, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/login - Logout
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (email) {
      await prisma.newtonSession.updateMany({
        where: { email },
        data: { isActive: false },
      });
    } else {
      await prisma.newtonSession.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const response = NextResponse.json({ success: true, message: 'Logged out' });
    response.cookies.delete('newton_session');
    return response;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * GET /api/auth/login - Check session status
 */
export async function GET(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('newton_session')?.value;
    const session = await prisma.newtonSession.findFirst({
      where: cookieToken ? { sessionToken: cookieToken, isActive: true } : { isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { email: true, sessionToken: true, updatedAt: true, isActive: true },
    });

    const response = NextResponse.json({
      authenticated: !!session,
      session: session ? { email: session.email, updatedAt: session.updatedAt, isActive: session.isActive } : null,
    });

    // If database has an active session but cookie was missing, sync cookie to prevent auth drop
    if (session && !cookieToken) {
      response.cookies.set('newton_session', session.sessionToken, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return response;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
