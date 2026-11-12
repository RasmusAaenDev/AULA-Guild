import { auth } from '@/auth';
import { handleDownload, unauthorizedResponse } from '@/lib/files-http';
import { filesDeps } from '@/lib/services';

export const dynamic = 'force-dynamic';

/** Levering af en fil som strøm fra disken. Kun guildens medlemmer; Content-Type kommer fra databasen. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await auth();
  const user = session?.user;
  if (!user?.isGuildMember || !user.id) return unauthorizedResponse();
  const { id } = await params;
  const { db, uploadDir } = filesDeps();
  return handleDownload({ db, uploadDir }, id);
}
