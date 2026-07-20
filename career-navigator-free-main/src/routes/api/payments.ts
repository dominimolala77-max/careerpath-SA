import { ok, fail, parseBody, withErrorHandler, authenticateRequest, NotFoundError, ApiError } from "@/lib/server-utils";
import { db } from "@/lib/db";
import { config } from "@/lib/config";

/**
 * POST /api/payments/charge
 *
 * Initiate a Yoco payment for an application fee.
 * Body: { applicationId }
 *
 * In production, this creates a Yoco checkout session.
 * In development/test mode, it simulates a successful payment.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const { userId } = await authenticateRequest(request);
  const { applicationId } = await parseBody<{ applicationId: string }>(request);

  if (!applicationId) {
    throw new ApiError("applicationId is required", 400, "VALIDATION_ERROR");
  }

  // Verify the application exists and belongs to the user
  const app = await db.tables.applications.get(applicationId);
  if (!app) {
    throw new NotFoundError("Application not found");
  }

  const appData = app as unknown as Record<string, string>;
  if (appData.user_id !== userId) {
    throw new ApiError("Not authorized to pay this application", 403, "FORBIDDEN");
  }

  if (appData.payment_status === "paid" || appData.payment_status === "free") {
    throw new ApiError("Application fee is already covered", 400, "ALREADY_PAID");
  }

  // Get institution details
  const institution = await db.tables.institutions.get(appData.institution_id);
  if (!institution) {
    throw new NotFoundError("Associated institution not found");
  }

  const isDev = config.nodeEnv === "development";

  if (isDev) {
    // Simulate payment in dev mode
    const chargeId = `test_ch_${Date.now()}`;
    const updated = await db.tables.applications.update(applicationId, {
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      yoco_charge_id: chargeId,
    } as never);

    // Log the update
    await db.tables.updates.insert({
      user_id: userId,
      title: `Payment received: ${(institution as unknown as Record<string, string>).name}`,
      body: `Charge ${chargeId}. Your application fee is paid.`,
    } as never);

    return ok({
      chargeId,
      status: "paid",
      amount: institution.application_fee_cents,
      isTest: true,
    });
  }

  // Production Yoco integration would go here:
  // 1. Create a Yoco checkout session
  // 2. Return the checkout URL to the client
  // The client redirects to Yoco, and Yoco calls a webhook on success.
  throw new ApiError(
    "Production payment not yet configured. Add YOCO_SECRET_KEY and implement Yoco checkout.",
    501,
    "NOT_IMPLEMENTED",
  );
});

/**
 * GET /api/payments/config
 *
 * Return public Yoco configuration (safe for client).
 * The client uses this to initialise the Yoco Popup.
 */
export const GET = withErrorHandler(async (request: Request) => {
  await authenticateRequest(request);

  return ok({
    yocoPublicKey: config.public.yocoPublicKey,
    environment: config.nodeEnv,
  });
});