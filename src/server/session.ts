import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { env } from "./env";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  timezone: string;
};

function toCurrentUser(user: {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  timezone?: string | null;
}): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    timezone: user.timezone || env().APP_TIMEZONE,
  };
}

/** Loads a user by id (e.g. the `sub` of an OAuth access token). */
export async function getCurrentUserById(userId: string): Promise<CurrentUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, timezone: true },
  });
  return user ? toCurrentUser(user) : null;
}

/** Current user, or null when signed out. */
export async function getOptionalUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? toCurrentUser(session.user) : null;
}

/** Current user for pages and server actions. Redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  return user;
}
