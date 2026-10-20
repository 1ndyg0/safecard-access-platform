import { Suspense } from "react";
import { ApplicationWizard } from "@/components/application/ApplicationWizard";

export const metadata = { title: "Apply — SafeCard" };

export default function ApplyPage() {
  return <Suspense><ApplicationWizard /></Suspense>;
}
