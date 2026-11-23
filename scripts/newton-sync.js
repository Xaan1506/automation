/**
 * Newton School CLI & Headless Browser Automation Script
 *
 * Usage:
 *   node scripts/newton-sync.js --discover
 *   node scripts/newton-sync.js --course <courseId>
 *   node scripts/newton-sync.js --interactive-login
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();
const NEWTON_BASE_URL = process.env.NEWTON_BASE_URL || 'https://learn.newtonschool.co';

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function getActiveSession() {
  const session = await prisma.newtonSession.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (!session) return null;
  return {
    email: session.email,
    cookies: JSON.parse(session.cookieData),
  };
}

async function runInteractiveLogin() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (err) {
    console.error('Puppeteer is not installed yet. Run npm install puppeteer.');
    process.exit(1);
  }

  console.log('Launching browser for Newton School login...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized'],
  });

  const page = await browser.newPage();
  await page.goto(`${NEWTON_BASE_URL}/login`, { waitUntil: 'networkidle2' });

  console.log('Please log into your Newton School account in the opened browser window.');
  console.log('Waiting for login redirect to dashboard/courses...');

  // Wait for login by checking URL change or presence of course dashboard
  await page.waitForFunction(
    () => !window.location.href.includes('/login'),
    { timeout: 180000 }
  );

  const cookies = await page.cookies();
  const currentUrl = page.url();
  console.log(`Successfully logged in! Current URL: ${currentUrl}`);

  // Retrieve user email
  const email = process.env.NEWTON_EMAIL || 'student@newtonschool.co';

  await prisma.newtonSession.upsert({
    where: { email },
    create: {
      email,
      sessionToken: crypto.randomUUID(),
      cookieData: JSON.stringify(cookies),
      isActive: true,
    },
    update: {
      cookieData: JSON.stringify(cookies),
      isActive: true,
      updatedAt: new Date(),
    },
  });

  console.log(`Saved session for ${email} with ${cookies.length} cookies.`);
  await browser.close();
}

async function discoverCoursesWithSession() {
  const session = await getActiveSession();
  if (!session) {
    console.log('No active session found. Please run login first.');
    return;
  }

  console.log(`Using active session for ${session.email} to scan Newton School courses...`);
  const cookieHeader = session.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  const res = await fetch(`${NEWTON_BASE_URL}/api/v1/my-courses`, {
    headers: {
      Cookie: cookieHeader,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    console.log(`API returned status ${res.status}. Newton School may require scraping HTML.`);
    return;
  }

  const data = await res.json();
  console.log('Discovered courses response:', data);
}

const args = process.argv.slice(2);
if (args.includes('--interactive-login')) {
  runInteractiveLogin().catch(console.error);
} else if (args.includes('--discover')) {
  discoverCoursesWithSession().catch(console.error);
} else {
  console.log('Newton School Sync Script');
  console.log('Options: --interactive-login | --discover');
}
