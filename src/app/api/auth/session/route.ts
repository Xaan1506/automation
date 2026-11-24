import { NextResponse } from 'next/server';

/**
 * POST /api/auth/session - Manual cookie import is intentionally disabled
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Manual cookie import is disabled. Use visible browser login instead.' },
    { status: 410 }
  );
}
