import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireMemberSession } from "@/lib/auth/member-session";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { formatFullName, isAdministratorApproved, maskMobile } from "@/lib/member/approved";
import { benefitStoryboards } from "@/lib/benefit-storyboards";

type ApprovedProfile = { first_name: string; last_name: string; mobile_number: string | null; city: string | null; province: string | null };

export async function GET() {
  try {
    const { caseId } = await requireMemberSession();
    const admin = getSupabaseAdminClient();
    const { data: record, error } = await admin.from("recipient_cases")
      .select("application_ref, membership_state, application_review_state, payment_state, recipient_profiles!inner(first_name,last_name,mobile_number,city,province)")
      .eq("id", caseId).single();
    if (error || !record) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    // Approval by the administrator, with the payment proof verified, is the whole approval process.
    if (!isAdministratorApproved(record)) {
      return NextResponse.json({ active: false, approved: false, reference: record.application_ref }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const approvedProfiles = record.recipient_profiles as unknown as ApprovedProfile | ApprovedProfile[];
    const approvedProfile = Array.isArray(approvedProfiles) ? approvedProfiles[0] : approvedProfiles;
    const { data: decision } = await admin.from("application_review_decisions")
      .select("decided_at").eq("case_id", caseId).eq("decision", "approved")
      .order("decided_at", { ascending: false }).limit(1).maybeSingle();
    const approvedQr = await QRCode.toDataURL(JSON.stringify({ type: "safecard-administrator-approved", reference: record.application_ref }), { margin: 1, width: 360, errorCorrectionLevel: "M" });
    return NextResponse.json({
      active: false,
      approved: true,
      reference: record.application_ref,
      name: formatFullName(approvedProfile.first_name, approvedProfile.last_name),
      mobileMasked: maskMobile(approvedProfile.mobile_number),
      location: [approvedProfile.city, approvedProfile.province].filter(Boolean).join(", "),
      approvedAt: decision?.decided_at ?? null,
      qrDataUrl: approvedQr,
      benefits: benefitStoryboards.map((benefit) => ({ id: benefit.id, icon: benefit.icon, title: benefit.title, summary: benefit.summary })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Member authentication required." }, { status: 401 });
  }
}
