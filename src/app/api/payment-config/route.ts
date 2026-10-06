import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { getApprovedPaymentRoutes, MANUAL_PAYMENT_CONFIG } from "@/lib/payment/config";

export const dynamic = "force-dynamic";

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
    const routes = getApprovedPaymentRoutes(approvedTypes);
    if (routes.length === 0 || Number(campaign.membership_fee) !== MANUAL_PAYMENT_CONFIG.amount) {
      return NextResponse.json(
        { available: false, reason: "Approved bank transfer or the annual fee is not configured for this campaign.", amount: null, currency: "PHP", routes: [] },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json({
      available: true,
      reason: null,
      amount: Number(campaign.membership_fee),
      currency: MANUAL_PAYMENT_CONFIG.currency,
      accountName: MANUAL_PAYMENT_CONFIG.accountName,
      routes,
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
