"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { readJson } from "@/components/admin/use-async-load";

const roles = [
  "support_agent",
  "finance_export",
  "content_approver",
  "school_admin",
  "prc_liaison",
  "privacy_admin_owner",
] as const;

type Campaign = { id: string; name: string; organization_id: string };
type StaffUser = {
  id: string;
  email: string;
  full_name: string;
  active_roles: string[];
  is_active: boolean;
};
type Assignment = {
  id: string;
  role: string;
  is_active: boolean;
  granted_at: string;
  users: { id: string; email: string; full_name: string; mfa_enabled?: boolean };
};

export function UserManagement() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCampaign = useCallback(async (selectedId: string) => {
    if (!selectedId) {
      setUsers([]);
      setAssignments([]);
      return;
    }
    const [usersResponse, rolesResponse] = await Promise.all([
      fetch(`/api/admin/users?campaign_id=${encodeURIComponent(selectedId)}`, { cache: "no-store" }),
      fetch(`/api/admin/roles/list?campaign_id=${encodeURIComponent(selectedId)}`, { cache: "no-store" }),
    ]);
    const usersBody = await readJson(usersResponse, "Unable to load staff accounts.");
    const rolesBody = await readJson(rolesResponse, "Unable to load role assignments.");
    setUsers(usersBody.users ?? []);
    setAssignments(rolesBody.assignments ?? []);
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = await readJson(response, "Unable to load campaign access.");
      const available = (body.campaigns ?? []) as Campaign[];
      const selected = body.selectedCampaignId || available[0]?.id || "";
      setCampaigns(available);
      setCampaignId(selected);
      await loadCampaign(selected);
      setState("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load users.");
      setState("error");
    }
  }, [loadCampaign, router]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const campaign = campaigns.find((item) => item.id === campaignId);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaign) return;
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const userResponse = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: campaign.organization_id,
          campaign_id: campaign.id,
          full_name: form.get("full_name"),
          email: form.get("email"),
          role: form.get("role"),
          reason: form.get("reason"),
        }),
      });
      await readJson(userResponse, "The staff invitation and initial role could not be created.");
      setNotice("Invitation sent and the initial campaign role was assigned.");
      event.currentTarget.reset();
      await loadCampaign(campaign.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invitation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await assignRole(
        String(form.get("user_id")),
        String(form.get("role")),
        String(form.get("reason")),
      );
      await readJson(response, "The role could not be assigned.");
      setNotice("Role assignment recorded in the audit trail.");
      event.currentTarget.reset();
      await loadCampaign(campaignId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Role assignment failed.");
    } finally {
      setBusy(false);
    }
  }

  function assignRole(userId: string, role: string, reason: string) {
    return fetch("/api/admin/roles/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        role,
        campaign_id: campaignId,
        reason,
      }),
    });
  }

  async function revoke(event: FormEvent<HTMLFormElement>, assignmentId: string) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const reason = String(new FormData(event.currentTarget).get("reason"));
    try {
      const response = await fetch("/api/admin/roles/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_assignment_id: assignmentId, reason }),
      });
      await readJson(response, "The role could not be revoked.");
      setNotice("Role revoked and recorded in the audit trail.");
      await loadCampaign(campaignId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Role revocation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Least-privilege administration</p>
          <h1>Staff and roles</h1>
          <p className="muted-note">Assign only the access needed for the selected campaign.</p>
        </div>
        <label className="field-block compact">
          <span>Campaign</span>
          <select
            value={campaignId}
            disabled={!campaigns.length || busy}
            onChange={(event) => {
              const selected = event.target.value;
              setCampaignId(selected);
              setError("");
              void loadCampaign(selected).catch((caught) => {
                setError(caught instanceof Error ? caught.message : "Unable to load staff access.");
              });
            }}
          >
            {campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </header>

      <div aria-live="polite" role="status">
        {state === "loading" && <p className="form-message">Loading staff access…</p>}
        {error && <p className="form-message error">{error}</p>}
        {notice && <p className="form-message">{notice}</p>}
      </div>

      {state === "ready" && campaign && (
        <>
          <div className="admin-two-column">
            <form className="admin-panel stack" onSubmit={invite}>
              <div><p className="eyebrow">New staff account</p><h2>Invite securely</h2></div>
              <label className="field-block"><span>Full name</span><input name="full_name" minLength={2} maxLength={200} required /></label>
              <label className="field-block"><span>Email</span><input name="email" type="email" required /></label>
              <label className="field-block"><span>Initial role</span><select name="role" required>{roles.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select></label>
              <label className="field-block"><span>Audit reason</span><input name="reason" minLength={10} maxLength={500} required /></label>
              <button type="submit" className="button-primary" disabled={busy}>Send invitation and assign role</button>
            </form>

            <form className="admin-panel stack" onSubmit={addRole}>
              <div><p className="eyebrow">Existing staff</p><h2>Add a campaign role</h2></div>
              <label className="field-block"><span>User</span><select name="user_id" required>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name} · {user.email}</option>)}</select></label>
              <label className="field-block"><span>Role</span><select name="role" required>{roles.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select></label>
              <label className="field-block"><span>Audit reason</span><input name="reason" minLength={10} maxLength={500} required /></label>
              <button type="submit" className="button-primary" disabled={busy || !users.length}>Assign role</button>
            </form>
          </div>

          <section className="admin-panel stack">
            <div><p className="eyebrow">Current access</p><h2>Campaign role assignments</h2></div>
            <div className="role-list">
              {assignments.filter((assignment) => assignment.is_active).map((assignment) => (
                <article key={assignment.id}>
                  <div>
                    <strong>{assignment.users.full_name}</strong>
                    <span>{assignment.users.email}</span>
                    <span className="status-pill">{formatRole(assignment.role)}</span>
                  </div>
                  <details>
                    <summary>Revoke access</summary>
                    <form onSubmit={(event) => void revoke(event, assignment.id)}>
                      <label className="field-block"><span>Audit reason</span><input name="reason" minLength={10} maxLength={500} required /></label>
                      <label className="confirmation-check"><input type="checkbox" required /><span>I understand this immediately removes the selected role.</span></label>
                      <button type="submit" className="button-danger" disabled={busy}>Confirm revocation</button>
                    </form>
                  </details>
                </article>
              ))}
              {!assignments.some((assignment) => assignment.is_active) && <p>No active role assignments for this campaign.</p>}
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}

function formatRole(role: string) {
  return role.replaceAll("_", " ");
}
