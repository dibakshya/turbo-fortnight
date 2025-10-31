# Flipkart Incident Response Copilot

An internal tool prototype for Flipkart responders to launch incident runbooks, track real-time task execution, and capture post-incident data. The project ships as a pnpm workspace with:

- `apps/backend`: Express + Prisma API (SQLite) exposing playbooks, incidents, and SSE streams for live updates.
- `apps/frontend`: React + Vite dashboard that launches incidents, manages checklists, and visualizes status.

## Prerequisites

- Node.js 20+
- pnpm 9 or newer (project tested with pnpm 10)

## Initial Setup

```bash
pnpm install

# Generate database schema & seed sample playbooks
cd apps/backend
DATABASE_URL="file:./dev.db" pnpm prisma migrate dev --name init
DATABASE_URL="file:./dev.db" pnpm seed
```

> The backend defaults to `file:./dev.db` when `DATABASE_URL` is unset, but Prisma CLI commands still need the variable provided explicitly.

## Local Development

Run the backend and frontend in separate terminals:

```bash
# Terminal 1 - backend API on http://localhost:4000
cd apps/backend
pnpm dev

# Terminal 2 - frontend SPA on http://localhost:5173
cd apps/frontend
pnpm dev
```

The frontend reads `VITE_API_BASE_URL` (defaults to `http://localhost:4000/api`). Adjust if you deploy the API elsewhere.

## Production Builds

```bash
cd apps/backend
pnpm build        # emits dist/ with compiled JS

cd ../frontend
pnpm build        # outputs static assets in dist/
```

## Database Notes

- SQLite file `apps/backend/dev.db` is git-ignored.
- Update the Prisma schema in `apps/backend/prisma/schema.prisma` and rerun `pnpm prisma migrate dev` when the data model changes.

## Deployment Checklist (GCE VM)

1. Provision Ubuntu VM with Node.js 20 runtime.
2. Copy workspace files to the VM (e.g., `gcloud compute scp`).
3. Install dependencies with `pnpm install` (approve build scripts when prompted).
4. Run database migrations & seeds (set `DATABASE_URL` to your production database).
5. Build frontend & backend.
6. Serve the backend via a process manager (PM2/systemd) and host the frontend from the same server or a static bucket.