import { ok, fail, parseBody, withErrorHandler, ApiError, UnauthorizedError } from "@/lib/server-utils";
import { config } from "@/lib/config";
import { db } from "@/lib/db";

/**
 * POST /api/auth/signup
 *
 * Create a new user account via Supabase Auth and ensure a profile row exists.
 * Body: { email, password, fullName? }
 */
export const POST = withErrorHandler(async (request: Request) => {
  const { email, password, fullName } = await parseBody<{
    email: string;
    password: string;
    fullName?: string;
  }>(request);

  if (!email || !password) {
    throw new ApiError("Email and password are required", 400, "VALIDATION_ERROR");
  }
  if (password.length < 6) {
    throw new ApiError("Password must be at least 6 characters", 400, "VALIDATION_ERROR");
  }

  // Use the Supabase admin client to create the user
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (error) {
    throw new ApiError(error.message, 400, "AUTH_ERROR");
  }

  // Ensure profile exists
  await db.profiles.ensure(data.user.id, email);

  return ok(
    {
      userId: data.user.id,
      email: data.user.email,
    },
    201,
  );
});

/**
 * POST /api/auth/login
 *
 * Sign in with email and password.
 * Body: { email, password }
 * Returns: { session, user }
 */
export const PUT = withErrorHandler(async (request: Request) => {
  const { email, password } = await parseBody<{ email: string; password: string }>(request);

  if (!email || !password) {
    throw new ApiError("Email and password are required", 400, "VALIDATION_ERROR");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new UnauthorizedError(error.message);
  }

  return ok({
    session: data.session,
    user: data.user,
  });
});

/**
 * GET /api/auth/session
 *
 * Validate a session token and return the user.
 * Header: Authorization: Bearer <token>
 */
export const GET = withErrorHandler(async (request: Request) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing authorization header");
  }

  const token = authHeader.slice("Bearer ".length);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  return ok({
    user: data.user,
  });
});