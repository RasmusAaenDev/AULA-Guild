import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { env } from '@/lib/env';
import { runSync } from '@/lib/services';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAuthorizedCron(request.headers.get('authorization'), env().CRON_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(await runSync());
}
