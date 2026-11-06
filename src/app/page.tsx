import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { PullRequestsView } from "@/components/pull-requests/pull-requests-view";

export default function Home() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PullRequestsView />
    </Suspense>
  );
}
