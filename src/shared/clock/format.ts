/** `HH:MM` sur 24 h dans le fuseau IANA reçu, secondes tronquées. */
export function formatClockTime(timestampMs: number, timeZone: string): string {
  // Assemblé depuis `formatToParts` : le motif de `format()` est localisé sur iOS.
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(timestampMs);
  const partOf = (type: "hour" | "minute"): string => parts.find((part) => part.type === type)?.value ?? "00";
  return `${partOf("hour")}:${partOf("minute")}`;
}
