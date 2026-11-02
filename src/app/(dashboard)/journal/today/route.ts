import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/auth";
import { env } from "@/server/env";
import { todayKey } from "@/lib/dates";

/** /journal/today → /journal/YYYY-MM-DD in the user's timezone. */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  const timezone = session.user.timezone || env().APP_TIMEZONE;
  return NextResponse.redirect(new URL(`/journal/${todayKey(timezone)}`, req.url));
}
