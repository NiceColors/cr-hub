"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { PROFILE_HOME, PROFILE_LABELS, persistProfile, type Profile } from "@/lib/profile";

type ProfileContextValue = {
  profile: Profile;
  /** Troca o perfil, grava no cookie e vai para a home dele. */
  setProfile: (profile: Profile) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}

export function ProfileProvider({
  initialProfile,
  children,
}: {
  initialProfile: Profile;
  children: React.ReactNode;
}) {
  const [profile, setProfileState] = useState(initialProfile);
  const router = useRouter();

  const setProfile = useCallback(
    (next: Profile) => {
      if (next === profile) return;
      setProfileState(next);
      persistProfile(next);
      router.push(PROFILE_HOME[next]);
      toast.info(`Perfil ${PROFILE_LABELS[next]} ativo`, {
        description:
          next === "lead"
            ? "O menu e a home agora mostram o Painel do líder."
            : "O menu e a home voltaram para a Fila de CRs.",
      });
    },
    [profile, router],
  );

  const value = useMemo(() => ({ profile, setProfile }), [profile, setProfile]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
