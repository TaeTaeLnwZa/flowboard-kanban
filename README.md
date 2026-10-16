# Flowboard

A public, shared Kanban board with **To do**, **Doing**, and **Done** columns. Visitors can add, move, edit, and delete cards. The frontend is React + TypeScript + Vite, the API is Python FastAPI, and cards are stored in Supabase PostgreSQL.

## Run locally

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor.
2. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Keep `.env` private.
3. Install and start the API:

   ```sh
   python3 -m venv .venv
   .venv/bin/pip install -r backend/requirements.txt
   set -a; . ./.env; set +a
   .venv/bin/uvicorn backend.main:app --reload --port 8000
   ```

4. In another terminal, install and start the frontend:

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

Open <http://127.0.0.1:5173>. Vite proxies `/api` requests to FastAPI. The app refreshes the shared board every 12 seconds.

## Deploy for free on Render

The `render.yaml` Blueprint runs the frontend and FastAPI backend together as
one free Docker web service. Create a Render account, connect this repository as
a Blueprint, and provide `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` when
prompted. No payment method is needed for the Free web service. Render supplies
`PORT` automatically. Free services spin down after 15 minutes without traffic,
so the first visit after a pause can take about a minute to load.

## Deploy to Cloud Run

The `Dockerfile` builds the Vite app, then serves it and the API from one Cloud Run service. Set only these runtime environment variables in Cloud Run:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Deploy with `gcloud run deploy flowboard-kanban --source . --region asia-southeast1 --allow-unauthenticated` after selecting your Google Cloud project. The Docker build excludes `.env`; never commit credentials. Cloud Run supplies `PORT` automatically.

## Public access

This assignment uses a public board. Anyone with its URL can read and edit every card. Use it only for non-sensitive content. The browser never receives the Supabase key; FastAPI holds it on the server and uses the database's `anon` row level security policies.
