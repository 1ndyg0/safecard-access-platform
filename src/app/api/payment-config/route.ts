import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { getApprovedPaymentRoutes, MANUAL_PAYMENT_CONFIG } from "@/lib/payment/config";

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

export async function GET(request: Request) {
  try {
    const campaignId = new URL(request.url).searchParams.get("campaign_id");
    if (!campaignId || !z.string().uuid().safeParse(campaignId).success) {
      return NextResponse.json(
        { available: false, reason: "A valid campaign is required.", amount: null, currency: "PHP", routes: [] },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const admin = getSupabaseAdminClient();
    const { data: campaign, error } = await admin
      .from("pilot_campaigns")
      .select("membership_fee,approved_payment_routes,is_active")
      .eq("id", campaignId)
      .maybeSingle();
    if (error || !campaign?.is_active) {
      return NextResponse.json(
        { available: false, reason: "This campaign is not available for payment.", amount: null, currency: "PHP", routes: [] },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    const approvedTypes = new Set(
      ((campaign.approved_payment_routes ?? []) as Array<Record<string, unknown>>)
        .filter((route) => route.is_active === true && typeof route.type === "string")
        .map((route) => route.type as string),
    );
    const qrImageUrl = await getQrImageUrl();
    const routes = getApprovedPaymentRoutes(approvedTypes, qrImageUrl ?? undefined);
    if (routes.length === 0) {
      return NextResponse.json(
        { available: false, reason: "No official payment route is approved for this campaign.", amount: null, currency: "PHP", routes: [] },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json({
      available: true,
      reason: null,
      amount: Number(campaign.membership_fee),
      monthlyEquivalent: MANUAL_PAYMENT_CONFIG.monthlyEquivalent,
      currency: MANUAL_PAYMENT_CONFIG.currency,
      accountName: MANUAL_PAYMENT_CONFIG.accountName,
      routes,
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
