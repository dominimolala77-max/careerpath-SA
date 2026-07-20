import { ok, fail, parseBody, withErrorHandler, authenticateRequest, ApiError } from "@/lib/server-utils";
import { db } from "@/lib/db";

/**
 * GET /api/subjects
 *
 * List the authenticated user's subjects.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);
  const subjects = await db.tables.subjects.list({
    column: "user_id",
    value: userId,
  });
  return ok(subjects);
});

/**
 * POST /api/subjects
 *
 * Save the authenticated user's subjects (replaces all existing).
 * Body: { subjects: Array<{ name: string; percentage: number }> }
 */
export const POST = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);
  const { subjects } = await parseBody<{
    subjects: Array<{ name: string; percentage: number }>;
  }>(request);

  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new ApiError("subjects array is required", 400, "VALIDATION_ERROR");
  }

  // Validate each subject
  for (const s of subjects) {
    if (!s.name?.trim()) {
      throw new ApiError("Each subject must have a name", 400, "VALIDATION_ERROR");
    }
    if (typeof s.percentage !== "number" || s.percentage < 0 || s.percentage > 100) {
      throw new ApiError(`Invalid percentage for subject "${s.name}"`, 400, "VALIDATION_ERROR");
    }
  }

  // Delete existing subjects and insert new ones
  await db.tables.subjects.remove(userId);

  const rows = subjects
    .filter((s) => s.name.trim())
    .map((s) => ({
      user_id: userId,
      name: s.name.trim(),
      percentage: s.percentage,
    }));

  if (rows.length > 0) {
    await db.tables.subjects.insert(rows[0] as never);
    for (let i = 1; i < rows.length; i++) {
      await db.tables.subjects.insert(rows[i] as never);
    }
  }

  return ok({ saved: rows.length }, 200);
});