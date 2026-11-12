import { auth } from '@/auth';
import { forbiddenOriginResponse, handleUpload, unauthorizedResponse } from '@/lib/files-http';
import { isAllowedOrigin } from '@/lib/files-ui';
import { filesDeps } from '@/lib/services';

// Route handler i stedet for server action: server actions har en lav grænse for body-størrelse.
export const dynamic = 'force-dynamic';

/** Upload (multipart: `section`, `title`, `file` i den rækkefølge). Kun guildens medlemmer. */
export async function POST(request: Request): Promise<Response> {
  // CSRF-værn ud over SameSite-cookien: en Origin-header, hvis den findes, skal være sidens egen.
  if (!isAllowedOrigin(request.headers.get('origin'), process.env.AUTH_URL, request.headers.get('host'))) {
    await request.body?.cancel().catch(() => {});
    return forbiddenOriginResponse();
  }
  const session = await auth();
  const user = session?.user;
  if (!user?.isGuildMember || !user.id) {
    await request.body?.cancel().catch(() => {});
    return unauthorizedResponse();
  }
  return handleUpload(filesDeps(), user.id, request);
}
