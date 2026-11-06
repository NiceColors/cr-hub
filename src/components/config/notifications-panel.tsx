"use client";

import { BellRingIcon, MonitorDownIcon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { Switch } from "@/components/motion/switch";
import { SectionHeader } from "@/components/config/section-header";
import { NOTIFICATION_TYPES } from "@/domain/attention";
import {
  NOTIFICATION_LABELS,
  requestNotificationPermission,
  setNotificationPref,
  useNotificationPermission,
  useNotificationPrefs,
} from "@/lib/notifications";
import { toast } from "@/lib/toast";

const PERMISSION_COPY = {
  granted: "Permitidas neste navegador.",
  denied: "Bloqueadas. Libere nas configurações do site, no ícone ao lado do endereço.",
  default: "Ainda não autorizadas.",
  unsupported: "Este navegador não suporta notificações.",
} as const;

export function NotificationsPanel() {
  const permission = useNotificationPermission();
  const prefs = useNotificationPrefs();

  async function askPermission() {
    const result = await requestNotificationPermission();
    if (result === "granted") toast.success("Notificações ativadas.");
    else if (result === "denied") toast.warning("As notificações foram bloqueadas no navegador.");
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Notificações e contador"
        description="Avisos disparam só em transições e nunca se repetem. PRs silenciados não notificam. As preferências ficam salvas neste navegador."
      />

      <div className="divide-y overflow-hidden rounded-2xl border bg-card">
        <section className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Permissão do navegador</h3>
            <p className="text-xs text-muted-foreground">{PERMISSION_COPY[permission]}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={askPermission}
            disabled={permission !== "default"}
            className="self-start sm:self-auto"
          >
            <BellRingIcon className="size-3.5" />
            {permission === "granted" ? "Ativadas" : "Permitir notificações"}
          </Button>
        </section>

        <fieldset className="flex flex-col gap-3 px-4 py-4">
          <legend className="float-left mb-3 text-sm font-medium">Avisar quando</legend>
          <div className="clear-left grid gap-4 sm:grid-cols-2">
            {NOTIFICATION_TYPES.map((type) => (
              <Switch
                key={type}
                size="sm"
                checked={prefs[type]}
                onCheckedChange={(checked) => setNotificationPref(type, checked)}
                label={NOTIFICATION_LABELS[type].title}
                description={NOTIFICATION_LABELS[type].hint}
              />
            ))}
          </div>
        </fieldset>

        <section className="flex gap-3 px-4 py-4">
          <MonitorDownIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Ícone na barra de tarefas</h3>
            <p className="text-xs text-muted-foreground">
              Instale o app pelo ícone de instalação na barra de endereço do Chrome ou do Edge. O
              ícone instalado mostra quantos PRs esperam sua revisão, como um app de e-mail. O
              número atualiza enquanto o app está aberto, mesmo minimizado.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
