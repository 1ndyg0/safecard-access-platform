"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type StaffUser = {
  id: string;
  email: string;
  full_name: string;
  mfa_enabled: boolean;
  is_active: boolean;
  created_at: string;
  active_roles: string[];
};

export default function UserRoleManagementPage() {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Assign Role Form State
  const [selectedUserId, setSelectedUserId] = useState("");
  const [roleToAssign, setRoleToAssign] = useState("support_agent");
  const [assignReason, setAssignReason] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const overviewRes = await fetch("/api/admin/overview", { cache: "no-store" });
        if (overviewRes.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const overview = await overviewRes.json();
        const selectedCamp = overview.selectedCampaignId ?? "";
        setCampaignId(selectedCamp);
        if (overview.campaigns?.[0]?.organization_id) {
          setOrgId(overview.campaigns[0].organization_id);
        }

        if (selectedCamp) {
          const usersRes = await fetch(`/api/admin/users?campaign_id=${selectedCamp}`, { cache: "no-store" });
          const usersData = await usersRes.json();
          if (!usersRes.ok) throw new Error(usersData.error ?? "Failed to load staff users");
          setUsers(usersData.users ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  async function handleAssignRole(event: FormEvent) {
    event.preventDefault();
    if (!selectedUserId || !roleToAssign) return;
    setAssigning(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/roles/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUserId,
          role: roleToAssign,
          campaign_id: campaignId || undefined,
          organization_id: orgId || undefined,
          reason: assignReason.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to assign role");
      setMessage(data.message ?? "Role assigned successfully");
      setAssignReason("");

      // Refresh users list
      if (campaignId) {
        const usersRes = await fetch(`/api/admin/users?campaign_id=${campaignId}`, { cache: "no-store" });
        const usersData = await usersRes.json();
        setUsers(usersData.users ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role assignment failed.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <AdminShell>
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Access Control & Staff</p>
          <h1>User & Role Management</h1>
        </div>
      </header>

      {error && <p className="form-message error">{error}</p>}
      {message && <p className="form-message info">{message}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "1.5rem", marginTop: "1rem" }}>
        <section className="admin-panel stack">
          <p className="eyebrow">Active Staff Accounts</p>
          {loading ? (
            <p>Loading staff users...</p>
          ) : users.length === 0 ? (
            <p>No active staff users found for this campaign.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Active Roles</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.full_name}</strong></td>
                    <td>{u.email}</td>
                    <td>{u.active_roles.map((r) => r.replaceAll("_", " ")).join(", ") || "No active role"}</td>
                    <td>
                      <button
                        type="button"
                        className="button-quiet"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
                        onClick={() => setSelectedUserId(u.id)}
                      >
                        Select to Assign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-panel stack" style={{ height: "fit-content" }}>
          <p className="eyebrow">Assign Staff Role</p>
          <form onSubmit={handleAssignRole} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span>Target Staff Member:</span>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid var(--border)", background: "var(--card)" }}
              >
                <option value="">Select staff user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span>Select Role:</span>
              <select
                value={roleToAssign}
                onChange={(e) => setRoleToAssign(e.target.value)}
                required
                style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid var(--border)", background: "var(--card)" }}
              >
                <option value="support_agent">Support Agent</option>
                <option value="school_admin">School Admin</option>
                <option value="finance_export">Finance Export</option>
                <option value="prc_liaison">PRC Liaison</option>
                <option value="content_approver">Content Approver</option>
                <option value="privacy_admin_owner">Privacy Admin Owner</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span>Reason for Granting Role:</span>
              <input
                type="text"
                value={assignReason}
                onChange={(e) => setAssignReason(e.target.value)}
                placeholder="e.g. Assigned to pilot support team"
                style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid var(--border)", background: "var(--card)" }}
              />
            </label>

            <button type="submit" className="button-primary" disabled={assigning || !selectedUserId}>
              {assigning ? "Assigning..." : "Assign Role"}
            </button>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}
