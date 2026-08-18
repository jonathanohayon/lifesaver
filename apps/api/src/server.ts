import { app } from './app.js';
import { env } from './config/env.js';
import { assertProductionSafeStartup } from './config/production-guard.js';

assertProductionSafeStartup();

app.listen(env.PORT, () => {
  console.log(`LIFE.SAVER API running on http://localhost:${env.PORT}`);
  if (env.NODE_ENV === 'production') {
    console.log('LIFE.SAVER production hardening checks passed.');
  }
});
