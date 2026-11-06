import { Suspense } from "react";
import { BancadaView } from "@/components/revisao/bancada-view";

export const metadata = {
  title: "Homologação · CR Tracker",
};

export default function Page() {
  return (
    <Suspense>
      <BancadaView />
    </Suspense>
  );
}
