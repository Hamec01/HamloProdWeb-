# HamloProd — Project Guidelines

HamloProd is a Next.js 16 music producer website with a public-facing archive of beats/tracks/artists and a protected admin panel. Backend is Supabase (Postgres + Auth + RLS). Language of the page is Russian (`<html lang="ru">`).

## Build & Dev Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint check
```

No test runner is configured.

## Architecture

```
src/
  app/
    (public)/       # Public pages — Server Components, async data fetching
    admin/          # Protected panel — requires requireAdminSession()
    api/admin/      # REST API routes for beats/tracks/artists CRUD
  components/
    admin/          # Client components for CRUD forms + tables
    artists/beats/tracks/layout/player/ui/  # Feature/UI components
  lib/
    supabase/       # server.ts (SSR client), browser.ts (client-side)
    auth/session.ts # getAdminSessionState(), requireAdminSession()
    validations/    # Zod schemas per entity
  services/
    content.ts      # Data fetching — Supabase or mock fallback
  store/
    player-store.ts # Zustand (with persist) — global audio player state
  types/
    index.ts        # Barrel export — always import types from "@/types"
```

## Key Conventions

### Imports
- Always use `@/` alias for `src/` — e.g. `import { Beat } from "@/types"`
- Types always come from `@/types` barrel (`index.ts`)

### TypeScript / Types
- App types use **camelCase** (e.g. `caseNumber`, `priceUsd`, `previewUrl`)
- DB columns are **snake_case** — mapper functions in `services/content.ts` handle conversion
- `Beat.status` union: `"available" | "reserved" | "sold" | "private"`

### Supabase
- **Server components / API routes** → `createSupabaseServerClient()` from `@/lib/supabase/server`
- **Client components** → `createSupabaseBrowserClient()` from `@/lib/supabase/browser`
- Never import the other client in the wrong context
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `hasSupabaseEnv()` — always check before Supabase calls in service layer; fall back to mock data if false

### Auth
- Admin gate: call `await requireAdminSession()` at the top of every admin page
- Roles: `admin` and `editor` both grant content management (`canManageContent(role)`)
- RLS is enforced DB-side via `public.is_admin_user()` — don't bypass with service role key in UI code

### Forms (Admin CRUD)
- React Hook Form + Zod via `zodResolver`
- Zod schemas live in `src/lib/validations/`
- Submit → fetch to `/api/admin/<entity>` (POST create, PATCH update, DELETE)

### Styling
- Tailwind CSS 4 — utility classes only, no CSS modules
- Custom color palette via CSS variables: `var(--color-ash-950)`, `var(--color-paper-100)`, etc.
- Fonts: `--font-heading` (Bebas Neue), `--font-mono` (IBM Plex Mono)
- Pattern exemplified in `src/app/(public)/page.tsx`

### State Management
- Zustand with `persist` middleware for the sticky audio player (`src/store/player-store.ts`)
- No other global state — prefer props and server data

### API Routes
- Located at `src/app/api/admin/<entity>/route.ts` and `…/[id]/route.ts`
- Must validate the session via Supabase auth before any mutation

## Database Schema (Supabase)

Tables: `profiles`, `beats`, `tracks`, `artists`, `site_settings`
Migration: `supabase/migrations/20260408_init_hamloprod.sql`

- `beats.status` check: `available | reserved | sold | private` — public only sees non-private
- All tables have `created_at` / `updated_at` with auto-update trigger `set_updated_at()`
- RLS enabled on all tables — `is_admin_user()` function gates writes

## Pitfalls

- **Mock data fallback** — when `NEXT_PUBLIC_SUPABASE_URL` is not set, `services/content.ts` returns mock data. Don't mistake this for a real DB response.
- **Server vs browser client** — mixing them will break SSR auth cookies.
- **`requireAdminSession()` must be awaited** — it calls `redirect()` internally.
- **New migrations** — always add to `supabase/migrations/` with a timestamped filename; never alter existing migration files.
