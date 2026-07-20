import { ok, fail, withErrorHandler, authenticateRequest, ApiError } from "@/lib/server-utils";
import { db } from "@/lib/db";

/**
 * GET /api/documents
 *
 * List the authenticated user's uploaded documents.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);
  const documents = await db.tables.documents.list({
    column: "user_id",
    value: userId,
  });
  return ok(documents);
});

/**
 * DELETE /api/documents?id=<documentId>
 *
 * Delete a document.
 */
export const DELETE = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);
  const url = new URL(request.url);
  const docId = url.searchParams.get("id");

  if (!docId) {
    throw new ApiError("Document ID is required", 400, "VALIDATION_ERROR");
  }

  const doc = await db.tables.documents.get(docId);
  if (!doc) {
    throw new ApiError("Document not found", 404, "NOT_FOUND");
  }

  const docData = doc as unknown as Record<string, string>;
  if (docData.user_id !== userId) {
    throw new ApiError("Not authorized", 403, "FORBIDDEN");
  }

  // Delete from storage
  const filePath = docData.file_path;
  if (filePath) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from("documents").remove([filePath]);
  }

  await db.tables.documents.remove(docId);
  return ok({ deleted: true });
});