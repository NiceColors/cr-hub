export const PALETTE_STORAGE_KEY = "cr-palette";
export const PALETTE_EVENT = "cr-palette";

export const PALETTES = [
  { id: "indigo", label: "Índigo", hue: 264 },
  { id: "blue", label: "Azul", hue: 230 },
  { id: "violet", label: "Violeta", hue: 292 },
  { id: "rose", label: "Rosa", hue: 350 },
  { id: "red", label: "Vermelho", hue: 25 },
  { id: "green", label: "Verde", hue: 152 },
  { id: "teal", label: "Turquesa", hue: 190 },
  { id: "orange", label: "Laranja", hue: 52 },
  { id: "amber", label: "Âmbar", hue: 78 },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

const PALETTE_IDS = new Set<string>(PALETTES.map((palette) => palette.id));

export function isPaletteId(value: string | null | undefined): value is PaletteId {
  return value != null && PALETTE_IDS.has(value);
}

/** Runs before paint so the saved palette is on <html> before the first frame. */
export const PALETTE_BOOT_SCRIPT = `(function(){try{var allowed={indigo:1,blue:1,violet:1,rose:1,red:1,green:1,teal:1,orange:1,amber:1};var p=localStorage.getItem("${PALETTE_STORAGE_KEY}");if(p&&allowed[p])document.documentElement.dataset.palette=p;}catch(e){}})();`;

export function applyPalette(id: PaletteId) {
  document.documentElement.dataset.palette = id;
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, id);
  } catch {
    // Private mode or a full quota: the choice still applies for this page.
  }
  window.dispatchEvent(new Event(PALETTE_EVENT));
}

export function readPalette(): PaletteId {
  const value = document.documentElement.dataset.palette;
  return isPaletteId(value) ? value : "indigo";
}
