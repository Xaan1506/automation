import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { prisma } from '@/lib/prisma';
import { getNewtonCourseUrl, NEWTON_LOGIN_URL } from '@/lib/newton-config';
import { loadSession, saveSession } from '@/lib/newton-scraper';

const LOGIN_TIMEOUT_MS = 15 * 60 * 1000;

interface BrowserLoginFlow {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  email: string;
  timeout: NodeJS.Timeout;
}

const loginFlows = new Map<string, BrowserLoginFlow>();

class LoginVerificationError extends Error {}

function isNewtonUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      (url.hostname === 'newtonschool.co' || url.hostname.endsWith('.newtonschool.co'));
  } catch {
    return false;
  }
}

async function closeLoginFlow(flowId: string): Promise<void> {
  const flow = loginFlows.get(flowId);
  if (!flow) return;
  clearTimeout(flow.timeout);
  loginFlows.delete(flowId);
  await flow.browser.close();
}

async function verifyAuthenticatedPage(flow: BrowserLoginFlow) {
  if (flow.page.isClosed()) {
    throw new LoginVerificationError('The Newton browser was closed. Start browser login again.');
  }

  if (!isNewtonUrl(flow.page.url())) {
    throw new LoginVerificationError('Finish sign-in and return to an authenticated Newton page.');
  }

  const courseUrl = getNewtonCourseUrl();
  const response = await flow.page.goto(courseUrl.toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  const contentType = response?.headers()['content-type'] || '';
  if (!response?.ok() || !contentType.toLowerCase().includes('text/html')) {
    throw new LoginVerificationError(
      'Newton did not return an authenticated HTML page. Complete sign-in and try again.'
    );
  }

  const currentUrl = flow.page.url();
  if (!isNewtonUrl(currentUrl)) {
    throw new LoginVerificationError('Finish sign-in and return to an authenticated Newton page.');
  }

  const pathname = new URL(currentUrl).pathname;
  if (/(^|\/)(login|signin|sign-in|oauth|auth)(\/|$)/i.test(pathname)) {
    throw new LoginVerificationError('Finish sign-in and open your Newton courses or dashboard first.');
  }

  try {
    await flow.page.waitForFunction(() =>
      [...document.querySelectorAll('span')].some((element) => {
        const label = (element.textContent || '').trim().replace(/\s+/g, ' ');
        const bounds = element.getBoundingClientRect();
        return /\s*-\s+/.test(label) &&
          label.length < 100 &&
          bounds.width > 0 &&
          bounds.height > 0;
      }), undefined, { timeout: 30000 }
    );
  } catch {
    throw new LoginVerificationError(
      'Newton did not load the configured course dashboard. Check NEWTON_COURSE_URL and try again.'
    );
  }

  const state = await flow.context.storageState();
  const hasNewtonAuthCookie = state.cookies.some((cookie) =>
    cookie.domain.replace(/^\./, '').endsWith('newtonschool.co') &&
    /(auth|session|token|jwt|sid)/i.test(cookie.name)
  );
  const hasPasswordField = await flow.page.locator('input[type="password"]').count() > 0;
  const pageText = await flow.page.locator('body').innerText({ timeout: 5000 });
  const hasAuthenticatedPageMarker =
    /\b(dashboard|courses|assignments|my learning|my courses|my assignments|your courses|your assignments|continue learning|sign out|log out|logout)\b/i.test(pageText);

  if (!hasNewtonAuthCookie || hasPasswordField || !hasAuthenticatedPageMarker) {
    throw new LoginVerificationError(
      'Authentication is not verified yet. Complete Newton sign-in and open your courses or dashboard.'
    );
  }

  return state;
}

/**
 * POST /api/auth/login - Start or verify a visible Newton browser login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'start';

    if (action === 'cancel') {
      if (typeof body.flowId === 'string') await closeLoginFlow(body.flowId);
      return NextResponse.json({ success: true });
    }

    if (action === 'verify') {
      if (typeof body.flowId !== 'string') {
        return NextResponse.json({ error: 'Browser login has expired. Start again.' }, { status: 410 });
      }

      const flow = loginFlows.get(body.flowId);
      if (!flow) {
        return NextResponse.json({ error: 'Browser login has expired. Start again.' }, { status: 410 });
      }

      try {
        const state = await verifyAuthenticatedPage(flow);
        const sessionToken = await saveSession(flow.email, state);
        await closeLoginFlow(body.flowId);

        const response = NextResponse.json({ success: true, message: 'Newton session verified.' });
        response.cookies.set('newton_session', sessionToken, {
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 7,
        });
        return response;
      } catch (error) {
        if (error instanceof LoginVerificationError) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        throw error;
      }
    }

    if (action !== 'start' || typeof body.email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return NextResponse.json({ error: 'Enter a valid Newton account email.' }, { status: 400 });
    }
    if (loginFlows.size >= 3) {
      return NextResponse.json({ error: 'Too many browser login attempts are open.' }, { status: 429 });
    }

    const loginUrl = NEWTON_LOGIN_URL;
    if (!isNewtonUrl(loginUrl)) {
      return NextResponse.json({ error: 'Newton login URL must be an HTTPS Newton School address.' }, { status: 500 });
    }
    try {
      getNewtonCourseUrl();
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Configure NEWTON_COURSE_URL before signing in.' },
        { status: 500 }
      );
    }

    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();
      const response = await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (response && response.status() >= 400) {
        await browser.close();
        return NextResponse.json(
          { error: 'Newton login page could not be opened. Check NEWTON_LOGIN_URL.' },
          { status: 502 }
        );
      }

      const flowId = randomUUID();
      const timeout = setTimeout(() => {
        void closeLoginFlow(flowId).catch((error) => {
          console.error('Newton browser cleanup failed:', error instanceof Error ? error.name : 'UnknownError');
        });
      }, LOGIN_TIMEOUT_MS);
      timeout.unref();
      loginFlows.set(flowId, {
        browser,
        context,
        page,
        email: body.email.trim(),
        timeout,
      });

      return NextResponse.json({
        flowId,
        message: 'Complete Newton sign-in in the visible browser, then verify the authenticated page here.',
      });
    } catch (error) {
      if (browser) await browser.close().catch(() => undefined);
      console.error('Newton browser login could not start:', error instanceof Error ? error.name : 'UnknownError');
      return NextResponse.json(
        { error: 'Could not open visible Chromium. Install Playwright Chromium and run this app on the desktop.' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Newton browser login failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Newton browser login could not be completed.' }, { status: 500 });
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
  } catch (error) {
    console.error('Newton logout failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Logout could not be completed.' }, { status: 500 });
  }
}

/**
 * GET /api/auth/login - Check the current browser session
 */
export async function GET(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('newton_session')?.value;
    const session = cookieToken
      ? await prisma.newtonSession.findFirst({
          where: { sessionToken: cookieToken, isActive: true },
          select: { email: true, updatedAt: true },
        })
      : null;
    const storageState = session ? await loadSession(session.email) : null;

    return NextResponse.json({
      authenticated: !!session && !!storageState,
      session: session && storageState
        ? { email: session.email, updatedAt: session.updatedAt }
        : null,
    });
  } catch (error) {
    console.error('Newton session check failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Newton session status is unavailable.' }, { status: 500 });
  }
}
