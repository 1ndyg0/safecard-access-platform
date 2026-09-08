import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const routeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  instructions: z.string().min(1),
  accountName: z.string().min(1).optional(),
  accountNumber: z.string().min(1).optional(),
  qrImageUrl: z.string().url().optional(),
});

const configSchema = z.object({
  amount: z.number().positive(),
  currency: z.literal("PHP"),
  routes: z.array(routeSchema).min(1),
});

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
    const parsed = configSchema.parse(JSON.parse(process.env.PRC_PAYMENT_ROUTES_JSON ?? ""));
    return NextResponse.json({ available: true, reason: null, ...parsed }, {
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
