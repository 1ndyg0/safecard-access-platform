-- Normal production intake may have no fixed campaign quota. NULL means
-- unbounded; positive values continue to enforce an explicitly approved cap.
alter table public.pilot_campaigns
  alter column max_applications drop not null,
  alter column max_applications drop default,
  alter column max_sponsors drop not null,
  alter column max_sponsors drop default;

alter table public.pilot_campaigns
  add constraint pilot_campaigns_max_applications_positive
    check (max_applications is null or max_applications > 0),
  add constraint pilot_campaigns_max_sponsors_positive
    check (max_sponsors is null or max_sponsors > 0);
