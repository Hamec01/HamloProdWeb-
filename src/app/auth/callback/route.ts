import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get("code");
	const next = requestUrl.searchParams.get("next") ?? "/";

	if (code) {
		const supabase = await createSupabaseServerClient();
		await supabase.auth.exchangeCodeForSession(code);
	}

	const safeNext = next.startsWith("/") ? next : "/";
	return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}

