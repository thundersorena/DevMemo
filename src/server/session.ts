import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
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
