---
description: "Generate a full admin CRUD component (form + table) for a new entity in HamloProd. Use when: adding a new admin page with create/edit/delete functionality."
---

# Admin CRUD Component Skill

## Overview

This skill generates the full admin CRUD stack for a new entity, following the exact pattern from `src/components/admin/admin-beat-crud-manager.tsx`.

## What to generate

Given an entity name (e.g. "remix"), generate these files:

### 1. `src/lib/validations/<entity>.ts`

```ts
import { z } from "zod";

export const <entity>FormSchema = z.object({
  // add fields matching the DB table
});

export type <Entity>FormValues = z.infer<typeof <entity>FormSchema>;
```

### 2. `src/app/api/admin/<entity>/route.ts` — POST (create)
### 3. `src/app/api/admin/<entity>/[id]/route.ts` — PUT (update) + DELETE

Follow the pattern in `.github/instructions/api-routes.instructions.md` exactly.

### 4. `src/components/admin/admin-<entity>-crud-manager.tsx`

**"use client"** directive at the top.

Structure:
```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { Button } from "@/components/ui/button";
import { <entity>FormSchema, type <Entity>FormValues } from "@/lib/validations/<entity>";
import type { <Entity> } from "@/types";

const defaultValues: <Entity>FormValues = { /* sensible defaults */ };

export function Admin<Entity>CrudManager({
  <entity>s,
  hasSupabase,
}: {
  <entity>s: <Entity>[];
  hasSupabase: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<<Entity>FormValues>({ resolver: zodResolver(<entity>FormSchema), defaultValues });

  // rows: useMemo — Edit + Delete buttons per row
  // form: inline grid with register() for each field
  // submit: fetch POST /api/admin/<entity> or PUT /api/admin/<entity>/{id}
  // delete: confirm → fetch DELETE /api/admin/<entity>/{id} → router.refresh()
}
```

Key rules:
- Check `hasSupabase` before every mutation and show status message if false
- After successful create/update/delete call `router.refresh()`
- `setStatusMessage` for all success and error states
- Edit mode: populate form via `setValue()` calls, store id in `editingId`
- Cancel edit: `reset(defaultValues)` + `setEditingId(null)`

### 5. `src/app/admin/<entity>/page.tsx`

```tsx
import { requireAdminSession } from "@/lib/auth/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { get<Entity>s } from "@/services/content";
import { Admin<Entity>CrudManager } from "@/components/admin/admin-<entity>-crud-manager";

export default async function Admin<Entity>Page() {
  await requireAdminSession();
  const [<entity>s] = await Promise.all([get<Entity>s()]);
  return <Admin<Entity>CrudManager <entity>s={<entity>s} hasSupabase={hasSupabaseEnv()} />;
}
```

### 6. Update `src/services/content.ts`

Add `get<Entity>s()` function with:
- `hasSupabaseEnv()` check → mock data fallback
- Supabase query: `.from("<entity>s").select("*").order("created_at", { ascending: false })`
- `map<Entity>()` mapper for snake_case → camelCase

### 7. Update `src/types/<entity>.ts` and `src/types/index.ts`

Add TypeScript type with camelCase fields. Export from barrel `index.ts`.

## Checklist

- [ ] Zod schema in `src/lib/validations/`
- [ ] TypeScript type in `src/types/` + export in `index.ts`
- [ ] API routes: POST `/api/admin/<entity>`, PUT+DELETE `/api/admin/<entity>/[id]`
- [ ] CRUD manager component
- [ ] Admin page with `requireAdminSession()`
- [ ] Service function with mock fallback
- [ ] DB migration if table is new (see `/new-migration` prompt)
- [ ] Add link to `AdminSidebar` in `src/components/layout/admin-sidebar.tsx`
