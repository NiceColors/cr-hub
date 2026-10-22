import { ConfigView } from "@/components/config/config-view";
import { PageTransition } from "@/components/motion/page-transition";

export default function Page() {
  return (
    <PageTransition>
      <ConfigView />
    </PageTransition>
  );
}
