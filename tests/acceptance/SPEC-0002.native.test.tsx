import { render, screen } from "@testing-library/react-native";
import type { ComponentType } from "react";
import { StyleSheet } from "react-native";

// Contrat de SPEC-0002, partie rendu (Jest) : la dérive générique. La logique (couleurs, résolution, couches) est
// dans SPEC-0002.test.ts (Vitest).
// Une fois ce fichier fusionné sur main, un agent n'a le droit que de retirer `.skip` (scripts/check-contract.mjs).

// Les éléments de react-native-svg deviennent des éléments hôtes qui gardent leurs props telles quelles : le test lit
// les formes et les couleurs peintes sans dépendre du rendu natif de la bibliothèque.
jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: "Svg",
  Svg: "Svg",
  Defs: "Defs",
  ClipPath: "ClipPath",
  G: "G",
  Path: "Path",
  Circle: "Circle",
}));

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

interface Node {
  type: string;
  props: Record<string, unknown>;
  children: (Node | string)[] | null;
}

function rootOf(): Node {
  const root = screen.toJSON();
  if (root === null || Array.isArray(root)) throw new TypeError("expected a single root");
  return root as unknown as Node;
}

function descendants(node: Node): Node[] {
  const children = (node.children ?? []).filter((child): child is Node => typeof child !== "string");
  return children.flatMap((child) => [child, ...descendants(child)]);
}

/** Formes peintes : les `Path` et `Circle` qui portent une prop `fill`, dans l'ordre du document. */
function paintedShapes(root: Node): Node[] {
  return descendants(root).filter(
    (node) => (node.type === "Path" || node.type === "Circle") && node.props.fill !== undefined,
  );
}

const IBERIA = { base: "#F6C344", band1: "#8E0A22", band2: "none", disc: "none" };

describe.skip("SPEC-0002 airline theme (rendering)", () => {
  it("CA10 : renders at the requested width with the height of the 300 x 440 drawing", async () => {
    const GenericTail = loadGenericTail();
    await render(<GenericTail {...IBERIA} width={272} />);
    const style = StyleSheet.flatten(rootOf().props.style as object);
    expect(style.width).toBe(272);
    expect(style.height).toBeCloseTo((272 * 440) / 300, 5);
  });

  it("CA10 : mirrors the drawing horizontally so that it faces left", async () => {
    const GenericTail = loadGenericTail();
    await render(<GenericTail {...IBERIA} width={170} />);
    const style = StyleSheet.flatten(rootOf().props.style as object);
    expect(style.transform).toEqual([{ scaleX: -1 }]);
  });

  it("CA10 : is hidden from assistive technologies and holds no text", async () => {
    const GenericTail = loadGenericTail();
    await render(<GenericTail {...IBERIA} width={170} />);
    const root = rootOf();
    expect(root.props.accessibilityElementsHidden).toBe(true);
    expect(root.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(screen.queryByText(/./)).toBeNull();
  });

  it("CA10 : draws in the 300 x 440 viewBox", async () => {
    const GenericTail = loadGenericTail();
    await render(<GenericTail {...IBERIA} width={170} />);
    const svg = descendants(rootOf()).find((node) => node.type === "Svg");
    expect(svg?.props.viewBox).toBe("0 0 300 440");
  });

  it("CA10 : paints one shape per layer, in order, with the layer color", async () => {
    const GenericTail = loadGenericTail();
    await render(<GenericTail base="#F4F1EA" band1="#2B5BD6" band2="#E1251B" disc="none" width={170} />);
    const shapes = paintedShapes(rootOf());
    expect(shapes.map((node) => node.props.fill)).toEqual(["#F4F1EA", "#2B5BD6", "#E1251B"]);
    expect(shapes.map((node) => node.type)).toEqual(["Path", "Path", "Path"]);
    expect(shapes.map((node) => node.props.d)).toEqual([
      "M 36 14 Q 40 2 54 2 L 150 2 L 460 440 L 116 440 Z",
      "M 0 300 L 320 160 L 320 236 L 0 376 Z",
      "M 0 394 L 320 254 L 320 286 L 0 426 Z",
    ]);
  });

  it("CA10 : skips the colors set to none and draws the disc as a circle", async () => {
    const GenericTail = loadGenericTail();
    await render(<GenericTail base="#1A3466" band1="none" band2="none" disc="#F9B000" width={170} />);
    const shapes = paintedShapes(rootOf());
    expect(shapes.map((node) => node.props.fill)).toEqual(["#1A3466", "#F9B000"]);
    expect(shapes[1]?.type).toBe("Circle");
    expect(shapes[1]?.props).toMatchObject({ cx: 176, cy: 196, r: 66 });
  });

  it("CA10 : clips the layers other than the base with the outline of the tail", async () => {
    const GenericTail = loadGenericTail();
    await render(<GenericTail {...IBERIA} width={170} />);
    const nodes = descendants(rootOf());
    const clip = nodes.find((node) => node.type === "ClipPath");
    if (clip === undefined) throw new TypeError("expected a ClipPath");
    const outline = descendants(clip).find((node) => node.type === "Path");
    expect(outline?.props.d).toBe("M 36 14 Q 40 2 54 2 L 150 2 L 460 440 L 116 440 Z");
    expect(outline?.props.fill).toBeUndefined();
    const group = nodes.find((node) => node.type === "G");
    if (group === undefined) throw new TypeError("expected a G");
    expect(typeof clip.props.id).toBe("string");
    expect(group.props.clipPath).toBe(`url(#${clip.props.id})`);
    expect(paintedShapes(group).map((node) => node.props.fill)).toEqual(["#8E0A22"]);
  });
});
