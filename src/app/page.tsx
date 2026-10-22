import { PageTransition } from "@/components/motion/page-transition";
import { PullRequestsView } from "@/components/pull-requests/pull-requests-view";

export default function Home() {
  return (
    <PageTransition>
      <PullRequestsView />
    </PageTransition>
  );
}
