import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/db/client";

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
  const live = process.env.LAUNCH_GATES_COMPLETE === "true" && process.env.NEXT_PUBLIC_DATA_MODE === "live";
  if (!live) return NextResponse.json(syntheticConfig, { headers: { "Cache-Control": "no-store" } });

  try {
    const admin = getSupabaseAdminClient();
    const { data: campaign } = await admin
      .from("pilot_campaigns")
      .select("id, name, membership_fee, approved_fields, approved_payment_routes")
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!campaign) return NextResponse.json({ ...syntheticConfig, configurationError: "No active approved pilot campaign." });

    const { data: content } = await admin
      .from("content_versions")
      .select("id, content_type, locale, version, title, body, source, review_date")
      .in("content_type", ["benefit", "exclusion", "privacy_notice", "consent_text", "claims_education"])
      .in("locale", ["tl", "en"])
      .eq("approval_status", "approved")
      .eq("is_published", true);

    const required = ["privacy_notice", "consent_text"];
    const hasRequired = ["tl", "en"].every((locale) => required.every((type) => content?.some((item) => item.locale === locale && item.content_type === type)));
    if (!hasRequired) return NextResponse.json({ ...syntheticConfig, configurationError: "Required bilingual approved content is incomplete." });

    const paymentAvailable = process.env.ENABLE_OFFICIAL_PAYMENT_HANDOFF === "true" && Array.isArray(campaign.approved_payment_routes) && campaign.approved_payment_routes.length > 0;
    return NextResponse.json({
      mode: "live",
      launchGatesComplete: true,
      campaign,
      content,
      payment: { available: paymentAvailable, reason: paymentAvailable ? null : "Official payment handoff is parked." },
      externalNotifications: { available: false, reason: "Provider-dependent notifications are parked." },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ...syntheticConfig, configurationError: "Pilot backend is not ready; synthetic mode remains enforced." });
  }
}
