"use client";

import { useId, useState } from "react";
import { BookmarkPlusIcon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { CenterMorphModal, CenterMorphModalContent } from "@/components/motion/center-morph-modal";
import { Input } from "@/components/motion/input";
import { useCreateSavedView } from "@/hooks/use-config";
import type { SavedViewInput } from "@/lib/api/config";

function SaveViewForm({
  draft,
  onSaved,
  onCancel,
}: {
  draft: Omit<SavedViewInput, "name">;
  onSaved: (id: number) => void;
  onCancel: () => void;
}) {
  const create = useCreateSavedView();
  const descriptionId = useId();
  const [name, setName] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ ...draft, name: name.trim() }, { onSuccess: (data) => onSaved(data.id) });
  }

  return (
    <form onSubmit={submit} aria-describedby={descriptionId} className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1 pr-10">
        <h2 className="text-lg font-semibold">Salvar visão</h2>
        <p id={descriptionId} className="text-sm text-muted-foreground">
          Guarda a aba, o time, os filtros e a opção de mostrar silenciados. A visão aparece na
          barra lateral e na paleta de comandos.
        </p>
      </div>
      <Input
        label="Nome"
        value={name}
        onChange={setName}
        placeholder="Ex.: Hotfixes, Squad fundos > 24h"
        maxLength={60}
        classNames={{ input: "text-sm" }}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          <BookmarkPlusIcon />
          Salvar
        </Button>
      </div>
    </form>
  );
}

export function SaveViewDialog({
  open,
  onOpenChange,
  draft,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Omit<SavedViewInput, "name">;
  onSaved: (id: number) => void;
}) {
  return (
    <CenterMorphModal open={open} onOpenChange={onOpenChange}>
      <CenterMorphModalContent ariaLabel="Salvar visão" closeButtonLabel="Fechar" className="max-w-md">
        {open ? (
          <SaveViewForm
            draft={draft}
            onSaved={(id) => {
              onOpenChange(false);
              onSaved(id);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </CenterMorphModalContent>
    </CenterMorphModal>
  );
}
