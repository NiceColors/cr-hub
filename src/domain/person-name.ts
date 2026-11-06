const NAME_PARTICLES = new Set(["da", "das", "de", "del", "della", "di", "do", "dos", "du", "e"]);

/** Up to two initials for an avatar fallback: "Victor Batista" → "VB". */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** "Victor Batista do Carmo" → "Victor C." The full name stays available as a tooltip. */
export function shortPersonName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  const surname =
    [...parts].reverse().find((part) => !NAME_PARTICLES.has(part.toLocaleLowerCase("pt-BR"))) ??
    parts[parts.length - 1];
  if (surname === parts[0]) return parts[0];
  const initial = surname[0]?.toLocaleUpperCase("pt-BR");
  return initial ? `${parts[0]} ${initial}.` : parts[0];
}
