import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { LaunchGateError, resolveDataMode } from "@/lib/safety/data-mode";

export const dynamic = "force-dynamic";

const syntheticConfig = {
  mode: "synthetic" as const,
  launchGatesComplete: false,
  campaign: null,
  contentVersions: null,
  payment: { available: false, reason: "Official payment route is parked until written PRC approval and provider configuration exist." },
  externalNotifications: { available: false, reason: "SMS and email delivery are parked to avoid provider cost." },
};

export async function GET() {
  try {
    const mode = resolveDataMode();
    if (mode === "synthetic") return NextResponse.json(syntheticConfig, { headers: { "Cache-Control": "no-store" } });

    const admin = getSupabaseAdminClient();
    const { data: campaign } = await admin
      .from("pilot_campaigns")
      .select("id, name, membership_fee, approved_fields, approved_payment_routes")
      .eq("id", process.env.APPROVED_CAMPAIGN_ID as string)
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!campaign) return NextResponse.json({ mode: "unavailable", configurationError: "No active approved pilot campaign." }, { status: 503, headers: { "Cache-Control": "no-store" } });

    const { data: content } = await admin
      .from("content_versions")
      .select("id, content_type, locale, version, title, body, source, review_date")
      .in("content_type", ["benefit", "exclusion", "privacy_notice", "consent_text", "claims_education"])
      .in("locale", ["tl", "en"])
      .eq("version", Number(process.env.APPROVED_CONTENT_VERSION))
      .eq("approval_status", "approved")
      .eq("is_published", true);

    const required = ["privacy_notice", "consent_text"];
    const hasRequired = ["tl", "en"].every((locale) => required.every((type) => content?.some((item) => item.locale === locale && item.content_type === type)));
    const hasBenefitStoryboard = content?.some((item) => item.content_type === "benefit");
    if (!hasRequired || !hasBenefitStoryboard) return NextResponse.json({ mode: "unavailable", configurationError: "Required governed benefit and bilingual consent/privacy content is incomplete." }, { status: 503, headers: { "Cache-Control": "no-store" } });

    const paymentAvailable = process.env.ENABLE_OFFICIAL_PAYMENT_HANDOFF === "true" && Array.isArray(campaign.approved_payment_routes) && campaign.approved_payment_routes.length > 0;
    return NextResponse.json({
      mode: "live",
      launchGatesComplete: true,
      campaign,
      content,
      payment: { available: paymentAvailable, reason: paymentAvailable ? null : "Official payment handoff is parked." },
      externalNotifications: { available: false, reason: "Provider-dependent notifications are parked." },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof LaunchGateError
      ? error.message
      : "The production pilot backend is unavailable.";
    return NextResponse.json({ mode: "unavailable", configurationError: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
