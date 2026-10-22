import { Suspense } from "react";
import { PullRequestsView } from "@/components/pull-requests/pull-requests-view";

export default function Home() {
  return (
    <Suspense>
      <PullRequestsView />
    </Suspense>
  );
}
