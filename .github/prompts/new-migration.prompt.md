---
description: "Create a new Supabase migration file for HamloProd. Use when: adding tables, altering schema, new RLS policies, new triggers."
---

# Create Supabase Migration

Create a new migration for: $migrationDescription

## Instructions

1. Determine the next filename using today's date in format `YYYYMMDD` followed by a short description:
   `supabase/migrations/<YYYYMMDD>_<short_description>.sql`
   **Never alter existing migration files.**

2. Follow these conventions from `supabase/migrations/20260408_init_hamloprod.sql`:

### Schema conventions
- All tables in `public` schema
- Primary key: `id uuid primary key default gen_random_uuid()`
- Timestamps: `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()`
- Always add the `set_updated_at` trigger on `updated_at` column
- Text enums enforced via `check` constraints (not SQL ENUM type)

### Trigger template
```sql
drop trigger if exists <table>_set_updated_at on public.<table>;
create trigger <table>_set_updated_at
before update on public.<table>
for each row
execute function public.set_updated_at();
```

### RLS — always enable and add policies
```sql
alter table public.<table> enable row level security;

-- Public read
drop policy if exists "public can read <table>" on public.<table>;
create policy "public can read <table>"
on public.<table>
for select
to public
using (true);

-- Admin write
drop policy if exists "admins manage <table>" on public.<table>;
create policy "admins manage <table>"
on public.<table>
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
```

### Column naming
- DB columns: **snake_case** (e.g. `cover_palette`, `artist_name`, `release_date`)
- App types will use camelCase — mapper added separately in `services/content.ts`

3. After creating the migration file, remind me to:
   - Run the migration in Supabase dashboard or via `supabase db push`
   - Add a mapper function in `src/services/content.ts`
   - Add the TypeScript type in `src/types/` and export from `src/types/index.ts`
