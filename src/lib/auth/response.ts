import { NextResponse } from "next/server";

/** JSON response with `Cache-Control: no-store` — for every auth endpoint. */
export function jsonNoStore(body: unknown, init?: { status?: number }): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
