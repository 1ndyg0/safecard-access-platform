import { Suspense } from "react";
import { ApplicationWizard } from "@/components/application/ApplicationWizard";

export const metadata = { title: "Private application walkthrough — SafeCard" };

export default function ApplyPage() {
  return <Suspense><ApplicationWizard /></Suspense>;
}
