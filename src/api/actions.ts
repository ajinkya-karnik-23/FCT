// §8.9 — worklist row actions (Assign / Chase / Release). Actions mutate the shared exception
// objects in place: session-local state that survives navigation but never persists.
import type { Exception } from './types';
import { exceptions } from './mock/exceptions';

export type WorklistAction = 'assign' | 'chase' | 'release';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// A real wall-clock stamp — an action is a genuine now-event, chronologically after every seeded line.
function nowStamp(): string {
  const d = new Date();
  return `${pad2(d.getDate())}-${MONTHS[d.getMonth()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; // '29-Aug 14:05'
}

const ACTION_LINE: Record<WorklistAction, (x: Exception) => string> = {
  assign: (x) => `Assigned to ${x.owner}`,
  chase: (x) => `Chased with ${x.vendor}`,
  release: () => 'Released — block cleared',
};

// Snapshot at import time so a reset restores the seeded state exactly.
const ORIGINALS = new Map(exceptions.map((x) => [x.id, { evidence: [...(x.evidence ?? [])], status: x.status }]));

export function applyWorklistAction(x: Exception, action: WorklistAction): void {
  x.evidence = [...(x.evidence ?? []), `${ACTION_LINE[action](x)} ${nowStamp()}`];
  x.status = action === 'assign' ? 'assigned' : action === 'chase' ? 'chased' : 'released';
}

export function resetWorklistActionStore(): void {
  for (const x of exceptions) {
    const original = ORIGINALS.get(x.id);
    if (!original) continue;
    x.evidence = [...original.evidence];
    x.status = original.status;
  }
}
