import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { getPaymentRoutes, MANUAL_PAYMENT_CONFIG } from "@/lib/payment/config";

export const dynamic = "force-dynamic";

async function getQrImageUrl() {
  try {
    const bucket = process.env.PAYMENT_PROOFS_BUCKET ?? "payment-proofs";
    const { data } = await getSupabaseAdminClient().storage
      .from(bucket)
      .createSignedUrl(MANUAL_PAYMENT_CONFIG.qrObjectPath, 300);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  if (process.env.LAUNCH_GATES_COMPLETE !== "true" || process.env.ENABLE_OFFICIAL_PAYMENT_HANDOFF !== "true") {
    return NextResponse.json({
      available: false,
      reason: "Official payment handoff is parked until PRC approval and launch-gate sign-off.",
      amount: null,
      currency: "PHP",
      routes: [],
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const qrImageUrl = await getQrImageUrl();
    return NextResponse.json({
      available: true,
      reason: null,
      amount: MANUAL_PAYMENT_CONFIG.amount,
      monthlyEquivalent: MANUAL_PAYMENT_CONFIG.monthlyEquivalent,
      currency: MANUAL_PAYMENT_CONFIG.currency,
      accountName: MANUAL_PAYMENT_CONFIG.accountName,
    routes: getPaymentRoutes(qrImageUrl ?? undefined),
      controlledPilotWarning: "Verify the QR and account details with the payment owner and PRC before production activation.",
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({
      available: false,
      reason: "The approved payment configuration is missing or invalid.",
      amount: null,
      currency: "PHP",
      routes: [],
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
