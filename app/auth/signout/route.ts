import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/db/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
}
