import { auth } from '@/auth';
import { handleUpload, unauthorizedResponse } from '@/lib/files-http';
import { filesDeps } from '@/lib/services';

// Route handler i stedet for server action: server actions har en lav grænse for body-størrelse.
export const dynamic = 'force-dynamic';

/** Upload (multipart: `section`, `title`, `file` i den rækkefølge). Kun medlemmer. */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  const user = session?.user;
  if (!user?.isMember || !user.id) {
    await request.body?.cancel().catch(() => {});
    return unauthorizedResponse();
  }
  return handleUpload(filesDeps(), user.id, request);
}
