import { ok, fail, parseBody, withErrorHandler, authenticateRequest, NotFoundError, ApiError } from "@/lib/server-utils";
import { db } from "@/lib/db";

/**
 * GET /api/profiles
 *
 * Get the authenticated user's profile.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);
  const profile = await db.profiles.get(userId);
  if (!profile) {
    throw new NotFoundError("Profile not found. Complete onboarding first.");
  }
  return ok(profile);
});

/**
 * PATCH /api/profiles
 *
 * Update the authenticated user's profile.
 * Body: Partial profile fields (full_name, phone, province, etc.)
 */
export const PATCH = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);
  const body = await parseBody<Record<string, unknown>>(request);

  // Only allow specific fields to be updated
  const allowedFields = [
    "full_name",
    "id_number",
    "phone",
    "province",
    "latitude",
    "longitude",
    "aps_score",
    "preferred_field",
    "quiz_answers",
    "status",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError("No valid fields to update", 400, "VALIDATION_ERROR");
  }

  const updated = await db.tables.profiles.update(userId, updates);
  return ok(updated);
});