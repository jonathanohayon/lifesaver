import { getEnvironmentSeparationStatus } from './config/environment-separation.js';
import { env } from './config/env.js';

const status = getEnvironmentSeparationStatus();
console.log(JSON.stringify(status, null, 2));

process.exitCode = env.NODE_ENV === 'production' && status.criticalFailures > 0 ? 1 : 0;
