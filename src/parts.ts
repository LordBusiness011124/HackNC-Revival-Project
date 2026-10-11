export function partNames(parts: string[]) {
  return [...new Set(parts.flatMap((p) => p.toLowerCase().split(/,|;|\band\b|&/).map((name) => {
    const cleaned = name.trim();
    return ["batter", "batteries", "batery"].includes(cleaned) ? "battery" : cleaned;
  }).filter(Boolean)))];
}
export function sharedParts(needed: string[], offered: string[]) {
  const available = partNames(offered);
  return partNames(needed).filter((p) => available.includes(p));
}
