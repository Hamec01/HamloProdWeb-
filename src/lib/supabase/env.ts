export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function hasSupabaseEnv() {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey);
}