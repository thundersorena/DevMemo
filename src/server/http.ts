import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { authenticateToken, bearerToken } from "./api-token.service";
import { auth } from "./auth";
import { env } from "./env";
import { AppError, BadRequestError, UnauthorizedError } from "./errors";
import type { CurrentUser } from "./session";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export function handleError(error: unknown) {
  // Let Next.js control-flow errors (prerender bailouts, redirects) propagate.
  unstable_rethrow(error);
  if (error instanceof ZodError) {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid request", error.issues);
  }
  if (error instanceof AppError) {
    return errorResponse(error.status, error.code, error.message);
  }
  console.error("[api] unhandled error", error);
  return errorResponse(500, "INTERNAL_ERROR", "Something went wrong");
}

/** Session cookie (browser) or `Authorization: Bearer dm_…` (API clients). */
async function userFromRequest(req: NextRequest): Promise<CurrentUser> {
  const token = bearerToken(req.headers);
  if (token) {
    const user = await authenticateToken(token);
    if (!user) throw new UnauthorizedError("Invalid or revoked token");
    return user;
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) throw new UnauthorizedError();
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    timezone: user.timezone || env().APP_TIMEZONE,
  };
}

type Handler<Ctx> = (args: { req: NextRequest; ctx: Ctx; user: CurrentUser }) => Promise<Response>;

export function withUser<Ctx>(handler: Handler<Ctx>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      const user = await userFromRequest(req);
      return await handler({ req, ctx, user });
    } catch (error) {
      return handleError(error);
    }
  };
}

export async function parseJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON");
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}
