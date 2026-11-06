"use client";

import { CodeXmlIcon, CompassIcon } from "lucide-react";
import { useAnimatedSidebar } from "@/components/motion/animated-sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { Tooltip } from "@/components/motion/tooltip";
import { useProfile } from "@/components/profile-provider";
import { PROFILE_LABELS, UI_PROFILES, type Profile } from "@/lib/profile";

const PROFILE_ICONS: Record<Profile, typeof CodeXmlIcon> = {
  dev: CodeXmlIcon,
  lead: CompassIcon,
};

export function ProfileSwitch() {
  const { profile, setProfile } = useProfile();
  const { state, isMobile } = useAnimatedSidebar();
  if (UI_PROFILES.length < 2) return null;
  const other: Profile = profile === "dev" ? "lead" : "dev";

  if (state === "collapsed" && !isMobile) {
    const Icon = PROFILE_ICONS[profile];
    return (
      <Tooltip side="right" content={`Perfil ${PROFILE_LABELS[profile]} · mudar para ${PROFILE_LABELS[other]}`}>
        <button
          type="button"
          aria-label={`Perfil ${PROFILE_LABELS[profile]}. Mudar para ${PROFILE_LABELS[other]}`}
          onClick={() => setProfile(other)}
          className="mx-auto grid size-8 place-items-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon aria-hidden className="size-4" />
        </button>
      </Tooltip>
    );
  }

  return (
    <Tabs value={profile} onValueChange={(v) => setProfile(v as Profile)} variant="segment">
      <TabsList aria-label="Perfil" wrapperClassName="w-full" className="grid w-full grid-cols-2">
        {UI_PROFILES.map((value) => {
          const Icon = PROFILE_ICONS[value];
          return (
            <TabsTrigger
              key={value}
              value={value}
              icon={<Icon className="size-3.5" />}
              className="w-full px-2 py-1 text-xs"
            >
              {PROFILE_LABELS[value]}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
