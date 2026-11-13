import { handleLead } from '../../../lib/server/leads.js';
import { toResponse } from '../../../lib/server/google.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.text();
  return toResponse(await handleLead({
    origin: request.headers.get('origin'),
    host: request.headers.get('host'),
    body,
  }));
}
