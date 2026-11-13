import base from '../../../public/data/inventory.json';
import { handleInventory } from '../../../lib/server/inventory.js';
import { toResponse } from '../../../lib/server/google.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  return toResponse(await handleInventory(base));
}
