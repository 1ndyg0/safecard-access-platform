import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { handleApiError } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { createMemberToken, MEMBER_COOKIE, memberCookieOptions } from "@/lib/auth/member-session";

const schema = z.object({
  referenceNumber: z.string().trim().toUpperCase().regex(/^SC-\d{4}-[A-Z0-9]{8}$/),
  mobileNumber: z.string().trim().regex(/^(09|\+639)\d{9}$/),
});

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "member-login", 5, 300);
    const input = schema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    const { data: record } = await admin.from("recipient_cases")
      .select("id, recipient_profiles!inner(mobile_number)")
      .eq("application_ref", input.referenceNumber)
      .eq("is_active", true)
      .maybeSingle();
    const profiles = record?.recipient_profiles as unknown as { mobile_number: string } | { mobile_number: string }[] | undefined;
    const registered = Array.isArray(profiles) ? profiles[0]?.mobile_number : profiles?.mobile_number;
    if (!record || registered !== input.mobileNumber) {
      return NextResponse.json({ error: "Reference number and mobile number do not match." }, { status: 401 });
    }
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(MEMBER_COOKIE, createMemberToken(record.id), memberCookieOptions);
    return response;
  } catch (error) {
    return handleApiError(error, "Member login");
  }
}
