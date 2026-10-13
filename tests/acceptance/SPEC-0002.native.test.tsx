import { render, screen } from "@testing-library/react-native";
import type { ComponentType } from "react";
import { StyleSheet } from "react-native";

// Contrat de SPEC-0002, partie rendu (Jest) : la dérive générique. La logique (couleurs, résolution) est dans
// SPEC-0002.test.ts (Vitest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

interface GenericTailProps {
  base: string;
  band1: string;
  band2: string;
  disc: string;
  width: number;
}

// Module posé par cette spec : chargé à la demande, avec le type du contrat d'interface recopié ici.
function loadGenericTail(): ComponentType<GenericTailProps> {
  const loaded = require("../../src/shared/airline-theme/generic-tail") as {
    GenericTail: ComponentType<GenericTailProps>;
  };
  return loaded.GenericTail;
}

const IBERIA = { base: "#F6C344", band1: "#8E0A22", band2: "none", disc: "none" };

describe.skip("SPEC-0002 airline theme (rendering)", () => {
  it("CA10 : renders at the requested width with the height of the 300 x 440 drawing", async () => {
    const GenericTail = loadGenericTail();
    await render(<GenericTail {...IBERIA} width={272} />);
    const root = screen.toJSON();
    if (root === null || Array.isArray(root)) throw new TypeError("expected a single root");
    const style = StyleSheet.flatten(root.props.style);
    expect(style.width).toBe(272);
    expect(style.height).toBeCloseTo((272 * 440) / 300, 5);
  });

  it("CA10 : mirrors the drawing horizontally so that it faces left", async () => {
    const GenericTail = loadGenericTail();
    await render(<GenericTail {...IBERIA} width={170} />);
    const root = screen.toJSON();
    if (root === null || Array.isArray(root)) throw new TypeError("expected a single root");
    const style = StyleSheet.flatten(root.props.style);
    expect(style.transform).toEqual([{ scaleX: -1 }]);
  });

  it("CA10 : is hidden from assistive technologies and holds no text", async () => {
    const GenericTail = loadGenericTail();
    await render(<GenericTail {...IBERIA} width={170} />);
    const root = screen.toJSON();
    if (root === null || Array.isArray(root)) throw new TypeError("expected a single root");
    expect(root.props.accessibilityElementsHidden).toBe(true);
    expect(root.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(screen.queryByText(/./)).toBeNull();
  });

  it("CA10 : renders the drawing for a tail with a disc and no band", async () => {
    const GenericTail = loadGenericTail();
    await render(<GenericTail base="#1A3466" band1="none" band2="none" disc="#F9B000" width={170} />);
    expect(screen.toJSON()).not.toBeNull();
  });
});
