"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

const roles = ["support_agent", "finance_export", "content_approver", "school_admin", "prc_liaison", "privacy_admin_owner"] as const;
type User = { id: string; email: string; full_name: string; active_roles: string[]; is_active: boolean };
type Assignment = { id: string; role: string; is_active: boolean; granted_at: string; users: { id: string; email: string; full_name: string } };

export function UserManagement() {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const overviewResponse = await fetch("/api/admin/overview", { cache: "no-store" });
    if (overviewResponse.status === 401) { router.replace("/admin/login"); return; }
    const overview = await overviewResponse.json();
    if (!overviewResponse.ok) throw new Error(overview.error);
    const selectedCampaign = overview.campaigns.find((campaign: { id: string }) => campaign.id === overview.selectedCampaignId);
    if (!selectedCampaign) throw new Error("No campaign is assigned to this account.");
    setCampaignId(selectedCampaign.id);
    setOrganizationId(selectedCampaign.organization_id);
    const [usersResponse, rolesResponse] = await Promise.all([
      fetch(`/api/admin/users?campaign_id=${selectedCampaign.id}`, { cache: "no-store" }),
      fetch(`/api/admin/roles/list?campaign_id=${selectedCampaign.id}`, { cache: "no-store" }),
    ]);
    const [usersBody, rolesBody] = await Promise.all([usersResponse.json(), rolesResponse.json()]);
    if (!usersResponse.ok) throw new Error(usersBody.error);
    if (!rolesResponse.ok) throw new Error(rolesBody.error);
    setUsers(usersBody.users ?? []);
    setAssignments(rolesBody.assignments ?? []);
  }

  useEffect(() => { const timer = window.setTimeout(() => void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load users.")), 0); return () => window.clearTimeout(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const userResponse = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organization_id: organizationId, full_name: form.get("full_name"), email: form.get("email") }) });
      const user = await userResponse.json();
      if (!userResponse.ok) throw new Error(user.error);
      const roleResponse = await assignRole(user.userId, String(form.get("role")), "Initial role assigned with staff invitation");
      if (!roleResponse.ok) { const body = await roleResponse.json(); throw new Error(body.error); }
      setNotice("Invitation sent and initial role assigned.");
      event.currentTarget.reset();
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Invitation failed."); }
    finally { setBusy(false); }
  }

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await assignRole(String(form.get("user_id")), String(form.get("role")), String(form.get("reason")));
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setNotice("Role assignment recorded."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Role assignment failed."); }
    finally { setBusy(false); }
  }

  function assignRole(userId: string, role: string, reason: string) {
    return fetch("/api/admin/roles/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, role, campaign_id: campaignId, organization_id: organizationId, reason }) });
  }

  async function revoke(event: FormEvent<HTMLFormElement>, assignmentId: string) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const reason = String(new FormData(event.currentTarget).get("reason"));
    try {
      const response = await fetch("/api/admin/roles/revoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role_assignment_id: assignmentId, reason }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setNotice("Role revoked and audit event recorded."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Role revocation failed."); }
    finally { setBusy(false); }
  }

  return <AdminShell>
    <header className="admin-heading"><div><p className="eyebrow">Least-privilege administration</p><h1>Users and roles</h1></div></header>
    {error && <p className="form-message error" role="alert">{error}</p>}{notice && <p className="form-message" role="status">{notice}</p>}
    <div className="admin-two-column">
      <form className="admin-panel stack" onSubmit={invite}><div><p className="eyebrow">New staff account</p><h2>Invite securely</h2></div><label className="field-block"><span>Full name</span><input name="full_name" minLength={2} maxLength={200} required /></label><label className="field-block"><span>Email</span><input name="email" type="email" required /></label><label className="field-block"><span>Initial role</span><select name="role" required>{roles.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select></label><button className="button-primary" disabled={busy || !organizationId}>Send invitation and assign role</button></form>
      <form className="admin-panel stack" onSubmit={addRole}><div><p className="eyebrow">Existing staff</p><h2>Add a scoped role</h2></div><label className="field-block"><span>User</span><select name="user_id" required>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name} · {user.email}</option>)}</select></label><label className="field-block"><span>Role</span><select name="role" required>{roles.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select></label><label className="field-block"><span>Reason</span><input name="reason" minLength={5} maxLength={500} required /></label><button className="button-primary" disabled={busy || !users.length}>Assign role</button></form>
    </div>
    <section className="admin-panel stack"><div><p className="eyebrow">Current access</p><h2>Campaign role assignments</h2></div><div className="role-list">{assignments.filter((assignment) => assignment.is_active).map((assignment) => <article key={assignment.id}><div><strong>{assignment.users.full_name}</strong><span>{assignment.users.email}</span><span className="status-pill">{formatRole(assignment.role)}</span></div><details><summary>Revoke access</summary><form onSubmit={(event) => void revoke(event, assignment.id)}><label className="field-block"><span>Reason</span><input name="reason" minLength={5} maxLength={500} required /></label><label className="confirmation-check"><input type="checkbox" required /><span>I understand this immediately removes the selected role.</span></label><button className="button-danger" disabled={busy}>Confirm revocation</button></form></details></article>)}</div></section>
  </AdminShell>;
}

function formatRole(role: string) { return role.replaceAll("_", " "); }
