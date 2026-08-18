import { workerEnv } from '../config/env.js';

export type WorkerJobName = 'metrics_refresh' | 'daily_brief' | 'weekly_summary' | 'daily_pipeline' | 'weekly_pipeline';

async function parseJsonSafe(response: Response): Promise<any> {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch (_error) { return { raw: text }; }
}

export async function getWorkerStatus(): Promise<any> {
  const response = await fetch(`${workerEnv.WORKER_API_BASE_URL}/api/v1/worker/status`, {
    headers: {
      'x-lifesaver-worker-secret': workerEnv.WORKER_SHARED_SECRET,
      'connection': 'close',
    },
  });
  const json = await parseJsonSafe(response);
  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message || `Worker status request failed with HTTP ${response.status}`);
  }
  return json.data;
}

export async function runWorkerJob(job: WorkerJobName, options: { dryRun?: boolean } = {}): Promise<any> {
  const response = await fetch(`${workerEnv.WORKER_API_BASE_URL}/api/v1/worker/run/${encodeURIComponent(job)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-lifesaver-worker-secret': workerEnv.WORKER_SHARED_SECRET,
      'connection': 'close',
    },
    body: JSON.stringify({ dryRun: Boolean(options.dryRun) }),
  });

  const json = await parseJsonSafe(response);
  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message || `Worker job ${job} failed with HTTP ${response.status}`);
  }
  return json.data;
}
