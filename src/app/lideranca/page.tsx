import { notFound } from "next/navigation";
import { LeadView } from "@/components/lead/lead-view";
import { ENABLE_LEAD_VIEW } from "@/lib/features";

export default function Page() {
  if (!ENABLE_LEAD_VIEW) notFound();
  return <LeadView />;
}
