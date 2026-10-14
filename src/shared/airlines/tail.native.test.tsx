import { render } from "@testing-library/react-native";
import { AirlineTail } from "./tail";
import type { TailPalette } from "./types";

const AIR_FRANCE: TailPalette = { base: "#0b2d6b", stripe1: "#ffffff", stripe2: "#e1001a", disc: null };
const LUFTHANSA: TailPalette = { base: "#0b2d5c", stripe1: null, stripe2: null, disc: "#f9b000" };

interface HostNode {
  type: string;
  props: { fill?: { payload: number }; clipPath?: string; name?: string };
  children: HostNode[] | null;
}

// react-native-svg convertit les couleurs en entiers ARGB dans l'arbre de rendu.
function argb(hex: string): number {
  return 0xff000000 + Number.parseInt(hex.slice(1), 16);
}

function collect(node: HostNode, type: string): HostNode[] {
  const own = node.type === type ? [node] : [];
  return own.concat((node.children ?? []).flatMap((child) => collect(child, type)));
}

async function renderTree(palette: TailPalette): Promise<HostNode> {
  const screen = await render(<AirlineTail palette={palette} width={100} height={147} />);
  return screen.toJSON() as unknown as HostNode;
}

function fills(tree: HostNode, type: string): number[] {
  return collect(tree, type).flatMap((node) => (node.props.fill ? [node.props.fill.payload] : []));
}

describe("AirlineTail", () => {
  it("draws the base and both stripes when the disc is null", async () => {
    const tree = await renderTree(AIR_FRANCE);
    const pathFills = fills(tree, "RNSVGPath");
    expect(pathFills).toContain(argb("#0b2d6b"));
    expect(pathFills).toContain(argb("#ffffff"));
    expect(pathFills).toContain(argb("#e1001a"));
    expect(collect(tree, "RNSVGCircle")).toHaveLength(0);
  });

  it("draws the base and the disc when both stripes are null", async () => {
    const tree = await renderTree(LUFTHANSA);
    expect(fills(tree, "RNSVGPath")).toContain(argb("#0b2d5c"));
    expect(fills(tree, "RNSVGCircle")).toEqual([argb("#f9b000")]);
    // Chemin de découpage + forme de base : aucune bande.
    expect(collect(tree, "RNSVGPath")).toHaveLength(2);
  });

  it("gives each instance its own clip path identifier", async () => {
    const first = await renderTree(AIR_FRANCE);
    const second = await renderTree(LUFTHANSA);
    const [firstClip] = collect(first, "RNSVGClipPath");
    const [secondClip] = collect(second, "RNSVGClipPath");
    expect(firstClip?.props.name).toBeDefined();
    expect(firstClip?.props.name).not.toEqual(secondClip?.props.name);
  });
});
