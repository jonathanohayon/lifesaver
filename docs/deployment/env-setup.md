# LIFE.SAVER Environment Setup

Copy `.env.example` to `.env` in the project root.

During early mock mode, `DATABASE_URL` can stay empty and the API will still run.

For database testing:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_SSL=true
```

For local non-SSL PostgreSQL, use:

```env
DATABASE_SSL=false
```

Never commit `.env` to GitHub.
