import { ok, withErrorHandler, authenticateRequest } from "@/lib/server-utils";
import { db } from "@/lib/db";

/**
 * GET /api/institutions
 *
 * List all institutions, optionally filtered by the user's APS and province.
 * Query params: ?filter=all|qualifies|province
 */
export const GET = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);

  // Get the user's profile for APS and province
  const profile = await db.profiles.get(userId);

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? "all";

  let institutions;
  if (filter === "qualifies" && profile?.aps_score) {
    institutions = await db.institutions.recommend({
      minAps: profile.aps_score,
    });
  } else if (filter === "province" && profile?.province) {
    institutions = await db.institutions.recommend({
      province: profile.province,
    });
  } else {
    institutions = await db.tables.institutions.list({
      orderBy: { column: "type", ascending: true },
    });
  }

  return ok(institutions);
});