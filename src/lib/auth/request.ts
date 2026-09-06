/** Best-effort client IP + user agent from a Route Handler request. */
export function clientInfo(request: Request): { ip: string | null; userAgent: string | null } {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    (forwarded ? forwarded.split(",")[0]?.trim() : null) ||
    request.headers.get("x-real-ip") ||
    null;

  return {
    ip: ip && ip.length <= 45 ? ip : null,
    userAgent: request.headers.get("user-agent"),
  };
}
