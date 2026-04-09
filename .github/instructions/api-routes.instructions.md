---
applyTo: "src/app/api/admin/**"
---

# Admin API Routes — Conventions

Every admin API route must follow this exact pattern.

## Required Boilerplate (top of every handler)

```ts
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { <entity>FormSchema } from "@/lib/validations/<entity>";

function unauthorizedResponse(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
}
```

## Auth Guard (start of every handler)

```ts
if (!hasSupabaseEnv()) {
  return unauthorizedResponse("Supabase env is not configured.", 503);
}
const session = await getAdminSessionState();
if (!session.isAuthenticated) {
  return unauthorizedResponse("Unauthorized");
}
```

## Validation

```ts
const parsed = <entity>FormSchema.safeParse(await request.json());
if (!parsed.success) {
  return NextResponse.json(
    { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
    { status: 400 }
  );
}
```

## DB camelCase → snake_case

App types use camelCase; DB columns use snake_case. Always map explicitly:
- `caseNumber` → `case_number`
- `coverPalette` → `cover_palette`
- `previewUrl` → `preview_url`
- `priceUsd` → `price_usd`
- `artistName` → `artist_name`
- `releaseDate` → `release_date`
- `spotifyUrl` → `spotify_url`
- `appleMusicUrl` → `apple_music_url`
- `youtubeUrl` → `youtube_url`

## After successful mutation — revalidate

```ts
revalidatePath("/");
revalidatePath("/<public-entity-path>");
revalidatePath("/admin/<entity>");
return NextResponse.json({ ok: true });
```

## File structure

```
src/app/api/admin/<entity>/
  route.ts       # POST (create)
  [id]/
    route.ts     # PUT (update), DELETE
```

## Error response shape

Always: `{ error: string }` or `{ ok: true }`. Never return raw DB errors to the client beyond `error.message`.
