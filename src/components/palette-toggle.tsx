"use client";

import { useState, useSyncExternalStore } from "react";
import { PaletteIcon } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import {
  ColorSelector,
  ColorSelectorItem,
  ColorSelectorLabel,
  ColorSelectorList,
} from "@/components/motion/color-selector";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/motion/popover";
import {
  applyPalette,
  isPaletteId,
  PALETTE_EVENT,
  PALETTE_STORAGE_KEY,
  PALETTES,
  readPalette,
} from "@/lib/palette";

function subscribe(onStoreChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key != null && event.key !== PALETTE_STORAGE_KEY) return;
    if (isPaletteId(event.newValue)) {
      document.documentElement.dataset.palette = event.newValue;
    }
    onStoreChange();
  }
  window.addEventListener(PALETTE_EVENT, onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PALETTE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function PaletteToggle() {
  const palette = useSyncExternalStore(subscribe, readPalette, () => "indigo" as const);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen} align="end" sideOffset={10}>
      <PopoverTrigger>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Paleta de cores"
          className="text-primary hover:text-primary"
        >
          <PaletteIcon aria-hidden className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <ColorSelector
          value={palette}
          onValueChange={(value) => {
            if (isPaletteId(value)) applyPalette(value);
          }}
        >
          <ColorSelectorLabel className="mb-2 text-xs">Paleta</ColorSelectorLabel>
          <ColorSelectorList className="grid grid-cols-3 gap-2">
            {PALETTES.map((item) => (
              <ColorSelectorItem
                key={item.id}
                value={item.id}
                label={item.label}
                color={`oklch(0.62 0.16 ${item.hue})`}
              />
            ))}
          </ColorSelectorList>
        </ColorSelector>
      </PopoverContent>
    </Popover>
  );
}
