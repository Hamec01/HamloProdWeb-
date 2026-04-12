"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { dictionary, type Locale } from "@/lib/i18n";

export function PublicAuthStatus({ email, locale }: { email: string; locale: Locale }) {
  const router = useRouter();
  const t = dictionary[locale];

  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-[var(--color-paper-200)]">
      <span className="max-w-48 truncate">{email}</span>
      <Button
        variant="ghost"
        onClick={async () => {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut();
          router.refresh();
        }}
      >
        {t.logout}
      </Button>
    </div>
  );
}