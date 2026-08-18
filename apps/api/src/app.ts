import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { apiV1Router } from './routes/api-v1.js';
import { errorHandler } from './common/errors/error-handler.js';
import { requestId } from './common/middleware/request-id.js';
import { noStore } from './common/middleware/no-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);

app.use(requestId);
app.use(noStore);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  contentSecurityPolicy: env.NODE_ENV === 'production' ? {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "frame-ancestors": ["'none'"],
      "object-src": ["'none'"],
    },
  } : false,
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (env.ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.API_RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment.' } },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.CHAT_RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'CHAT_RATE_LIMITED', message: 'Too many chat requests. Please wait a moment.' } },
});

app.use('/api/v1', globalLimiter);
app.use('/api/v1/chat', chatLimiter);
app.use('/api/v1', apiV1Router);


function resolveWebDistPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '../dist'),
    path.resolve(process.cwd(), 'apps/dist'),
    path.resolve(__dirname, '../../dist'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  return null;
}

if (env.SERVE_WEB_APP) {
  const webDistPath = resolveWebDistPath();

  if (webDistPath) {
    app.use(express.static(webDistPath, { index: false }));

    const sendIndex = (_req: Request, res: Response) => {
      res.sendFile(path.join(webDistPath, 'index.html'));
    };

    app.get('/', sendIndex);
    app.get(['/index.html', '/login.html', '/settings.html', '/admin.html', '/onboarding.html', '/landing.html', '/surface-access.html', '/launch-readiness.html', '/actions.html', '/rules.html', '/notifications.html', '/support.html', '/memory.html'], (req, res) => {
      const requestedFile = path.basename(req.path);
      const filePath = path.join(webDistPath, requestedFile);
      if (fs.existsSync(filePath)) return res.sendFile(filePath);
      return sendIndex(req, res);
    });
  } else {
    console.warn('[LIFE.SAVER] SERVE_WEB_APP=true but web build output was not found. Run npm run build before starting the API.');
  }
}


app.use(errorHandler);
