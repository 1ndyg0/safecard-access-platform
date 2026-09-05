"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Sponsorship, SponsorshipStatus } from "./types";

const STORE = "safecard-demo-sponsorships-v1";
const mode = process.env.NEXT_PUBLIC_DATA_MODE === "supabase" ? "supabase" : "demo";

let client: SupabaseClient | null = null;

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  client ??= createClient(url, key, { auth: { persistSession: true } });
  return client;
}

function seed(): Sponsorship[] {
  const now = Date.now();
  return [
    { id: "demo-104", inviteCode: "DEMO104", sponsorAlias: "Student sponsor", status: "invited", createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() },
    { id: "demo-087", inviteCode: "DEMO087", sponsorAlias: "Student sponsor", status: "submitted", createdAt: new Date(now - 86400000).toISOString(), updatedAt: new Date(now - 86400000).toISOString() },
    { id: "demo-061", inviteCode: "DEMO061", sponsorAlias: "Student sponsor", status: "completed", createdAt: new Date(now - 259200000).toISOString(), updatedAt: new Date(now - 259200000).toISOString() },
  ];
}

function readLocal(): Sponsorship[] {
  const raw = localStorage.getItem(STORE);
  if (raw) return JSON.parse(raw) as Sponsorship[];
  const initial = seed();
  localStorage.setItem(STORE, JSON.stringify(initial));
  return initial;
}

function writeLocal(items: Sponsorship[]) {
  localStorage.setItem(STORE, JSON.stringify(items));
  window.dispatchEvent(new Event("safecard:data"));
}

async function ensureAnonymousUser() {
  const db = supabase();
  const { data } = await db.auth.getSession();
  if (!data.session) {
    const { error } = await db.auth.signInAnonymously();
    if (error) throw error;
  }
}

const fromRow = (row: Record<string, string>): Sponsorship => ({
  id: row.id,
  inviteCode: row.invite_code,
  sponsorAlias: row.sponsor_alias,
  status: row.status as SponsorshipStatus,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listSponsorships(): Promise<Sponsorship[]> {
  if (mode === "demo") return readLocal();
  await ensureAnonymousUser();
  const { data, error } = await supabase().from("sponsorships").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function createSponsorship(sponsorAlias: string): Promise<Sponsorship> {
  const inviteCode = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  if (mode === "demo") {
    const now = new Date().toISOString();
    const item = { id: crypto.randomUUID(), inviteCode, sponsorAlias, status: "invited" as const, createdAt: now, updatedAt: now };
    writeLocal([item, ...readLocal()]);
    return item;
  }
  await ensureAnonymousUser();
  const { data, error } = await supabase().from("sponsorships").insert({ invite_code: inviteCode, sponsor_alias: sponsorAlias }).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function getInvitation(code: string): Promise<Sponsorship | null> {
  if (mode === "demo") return readLocal().find((item) => item.inviteCode === code.toUpperCase()) ?? null;
  const { data, error } = await supabase().rpc("get_invitation", { p_invite_code: code.toUpperCase() });
  if (error) throw error;
  return data?.[0] ? fromRow(data[0]) : null;
}

export async function advanceInvitation(code: string, status: SponsorshipStatus) {
  if (mode === "demo") {
    writeLocal(readLocal().map((item) => item.inviteCode === code.toUpperCase() ? { ...item, status, updatedAt: new Date().toISOString() } : item));
    return;
  }
  const { error } = await supabase().rpc("advance_invitation", { p_invite_code: code.toUpperCase(), p_status: status });
  if (error) throw error;
}

export const dataMode = mode;
