import { getDatabaseStatus } from './status.js';
import { closeDatabasePool } from './pool.js';

const status = await getDatabaseStatus();
console.log(JSON.stringify(status, null, 2));
await closeDatabasePool();

if (status.configured && !status.connected) {
  process.exitCode = 1;
}
