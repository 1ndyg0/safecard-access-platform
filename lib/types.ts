export type SponsorshipStatus = "invited" | "informed" | "consented" | "submitted" | "completed";

export type Sponsorship = {
  id: string;
  inviteCode: string;
  sponsorAlias: string;
  status: SponsorshipStatus;
  createdAt: string;
  updatedAt: string;
};

export const statusLabels: Record<SponsorshipStatus, string> = {
  invited: "Invited",
  informed: "Learning complete",
  consented: "Consented",
  submitted: "Submitted",
  completed: "Completed",
};
