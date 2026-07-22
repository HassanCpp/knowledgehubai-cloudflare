// ─── Analytics Service ────────────────────────────────────────────────────────

import { getAnalyticsSummary } from '../db/queries';
import type { Env } from '../types';

export async function getDashboardStats(env: Env) {
  return getAnalyticsSummary(env.DB);
}
