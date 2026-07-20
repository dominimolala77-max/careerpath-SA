/**
 * Server-side utilities for API route handlers.
 *
 * Provides helpers for:
 *   - Authenticating requests inside API routes
 *   - Parsing request bodies
 *   - Returning typed JSON responses
 *   - Handling errors consistently
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ */
/*   Error classes                                                     */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "Bad request") {
    super(message, 400, "BAD_REQUEST");
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}

/* ------------------------------------------------------------------ */
/*   Auth helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Extract and validate a Bearer token from a Request, then return
 * the authenticated user ID.
 *
 * Throws UnauthorizedError if the token is missing or invalid.
 */
export async function requireAuth(
  request: Request,
  supabase: SupabaseClient<Database>,
): Promise<{ userId: string; email: string | undefined }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const token = authHeader.slice("Bearer ".length);
  if (!token || token.split(".").length !== 3) {
    throw new UnauthorizedError("Invalid token format");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  return {
    userId: user.id,
    email: user.email ?? undefined,
  };
}

/**
 * Authenticate using the request's authorization header.
 * For use inside API route handlers (.server.ts routes).
 */
export async function authenticateRequest(
  request: Request,
): Promise<{ userId: string; email?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = supabaseAdmin as unknown as SupabaseClient<Database>;
  return requireAuth(request, supabase);
}

/* ------------------------------------------------------------------ */
/*   Response helpers                                                  */
/* ------------------------------------------------------------------ */

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

/**
 * Return a successful JSON response.
 */
export function ok<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = { success: true, data };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Return an error JSON response.
 */
export function fail(error: ApiError): Response {
  const body: ApiResponse = {
    success: false,
    error: error.message,
    code: error.code,
  };
  return new Response(JSON.stringify(body), {
    status: error.statusCode,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Wrap an API route handler with automatic error handling.
 */
export function withErrorHandler(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(err);
      }
      console.error("[API] Unhandled error:", err);
      return fail(new ApiError("Internal server error", 500, "INTERNAL_ERROR"));
    }
  };
}

/* ------------------------------------------------------------------ */
/*   Body parsing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse JSON body from a Request. Throws BadRequestError on invalid JSON.
 */
export async function parseBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    const text = await request.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }
}