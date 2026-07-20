import { ok } from "@/lib/server-utils";

/**
 * GET /api/health
 *
 * Simple health-check endpoint. No authentication required.
 * Returns server status, uptime, and config fingerprint.
 */
export async function GET() {
  return ok({
    status: "ok",
    service: "CareerPath SA API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
  });
}