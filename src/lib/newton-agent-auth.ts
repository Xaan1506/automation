import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function getAuthenticatedNewtonEmail(request: NextRequest): Promise<string | null> {
  const sessionToken = request.cookies.get('newton_session')?.value;
  if (!sessionToken) return null;

  const session = await prisma.newtonSession.findFirst({
    where: { sessionToken, isActive: true },
    select: { email: true },
  });
  return session?.email ?? null;
}
