function normalizeOverrideKey(name: string): string {
  return name.trim();
}

export function getDisplayEntityName(name: string): string {
  const normalized = normalizeOverrideKey(name);
  if (!normalized) return normalized;
  return normalized;
}

export const getDisplayPlayerName = getDisplayEntityName;
export const getDisplayStaffName = getDisplayEntityName;

export function localizeEntityNamesInText(text: string): string {
  return text;
}
