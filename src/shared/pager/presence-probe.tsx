import { useEffect } from "react";
import type { PageName } from "../feature";

export interface PresenceProbeProps {
  presence: (displayedPage: PageName) => boolean;
  displayedPage: PageName;
  onChange: (present: boolean) => void;
}

/** Appelle `presence` comme un crochet, hors de l'écran, et remonte sa valeur au pager. */
export function PresenceProbe({ presence, displayedPage, onChange }: PresenceProbeProps) {
  const present = presence(displayedPage);
  useEffect(() => {
    onChange(present);
  }, [present, onChange]);
  return null;
}
