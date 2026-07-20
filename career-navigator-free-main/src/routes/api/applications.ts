import { ok, fail, parseBody, withErrorHandler, authenticateRequest, NotFoundError, ApiError, ConflictError } from "@/lib/server-utils";
import { db } from "@/lib/db";

/**
 * GET /api/applications
 *
 * List all applications for the authenticated user.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);
  const applications = await db.applications.listForUser(userId);
  return ok(applications);
});

/**
 * POST /api/applications
 *
 * Create a new application for an institution.
 * Body: { institutionId }
 */
export const POST = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);
  const { institutionId } = await parseBody<{ institutionId: string }>(request);

  if (!institutionId) {
    throw new ApiError("institutionId is required", 400, "VALIDATION_ERROR");
  }

  // Verify institution exists
  const institution = await db.tables.institutions.get(institutionId);
  if (!institution) {
    throw new NotFoundError("Institution not found");
  }

  // Check for duplicate
  const existing = await db.tables.applications.list({
    column: "user_id",
    value: userId,
  });
  if (existing.some((a) => (a as unknown as Record<string, unknown>).institution_id === institutionId)) {
    throw new ConflictError("Already applied to this institution");
  }

  const application = await db.tables.applications.insert({
    user_id: userId,
    institution_id: institutionId,
    amount_cents: institution.application_fee_cents,
    payment_status: institution.is_free ? "free" : "unpaid",
  });

  return ok(application, 201);
});

/**
 * PATCH /api/applications
 *
 * Batch-save the user's selected institutions.
 * Body: { institutionIds: string[] }
 *
 * This replaces the current selection – adds new and removes deselected.
 */
export const PATCH = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);
  const { institutionIds } = await parseBody<{ institutionIds: string[] }>(request);

  if (!Array.isArray(institutionIds)) {
    throw new ApiError("institutionIds array is required", 400, "VALIDATION_ERROR");
  }

  // Get current applications
  const current = await db.tables.applications.list({
    column: "user_id",
    value: userId,
  });

  const currentMap = new Map(
    current.map((a) => [(a as unknown as Record<string, string>).institution_id, a]),
  );

  // Remove applications that are no longer selected
  const toRemove = current.filter(
    (a) => !institutionIds.includes((a as unknown as Record<string, string>).institution_id),
  );
  for (const app of toRemove) {
    await db.tables.applications.remove((app as unknown as Record<string, string>).id);
  }

  // Add new selections
  for (const id of institutionIds) {
    if (!currentMap.has(id)) {
      const institution = await db.tables.institutions.get(id);
      if (institution) {
        await db.tables.applications.insert({
          user_id: userId,
          institution_id: id,
          amount_cents: institution.application_fee_cents,
          payment_status: institution.is_free ? "free" : "unpaid",
        });
      }
    }
  }

  const updated = await db.applications.listForUser(userId);
  return ok(updated);
});

/**
 * DELETE /api/applications?id=<applicationId>
 *
 * Remove an application.
 */
export const DELETE = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);
  const url = new URL(request.url);
  const appId = url.searchParams.get("id");

  if (!appId) {
    throw new ApiError("Application ID is required", 400, "VALIDATION_ERROR");
  }

  // Verify ownership
  const app = await db.tables.applications.get(appId);
  if (!app) {
    throw new NotFoundError("Application not found");
  }
  if ((app as unknown as Record<string, string>).user_id !== userId) {
    throw new ApiError("Not authorized to delete this application", 403, "FORBIDDEN");
  }

  await db.tables.applications.remove(appId);
  return ok({ deleted: true });
});