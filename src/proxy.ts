import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Admin now uses own auth (src/lib/auth/session.ts). Do NOT run the Supabase
// session refresh for admin paths — it must not touch /admin/* or /api/admin/*.
const OWN_AUTH_PREFIXES = ["/admin", "/api/admin"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  if (OWN_AUTH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookieValues) {
        cookieValues.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookieValues.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh session and write updated auth cookies to the response.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
