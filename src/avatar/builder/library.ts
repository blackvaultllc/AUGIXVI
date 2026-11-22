/**
 * THE ENVIRONMENT BUILDER'S COMPONENT LIBRARY (owner order
 * 2026-11-22): the pieces the Captain designs his room with —
 * stores and buildings, parks and trees, street dressing. Every
 * piece is parametric: a base form, a set of variant FORMS (roof
 * lines, canopy shapes, builds), four SIZES, and a palette of
 * COLORS. A variant is real only because every combination is
 * actually selectable in the builder and actually renders
 * differently on the stage — form changes the geometry, size
 * changes the scale, color changes the material.
 *
 * THE COUNT IS HONEST: the library never advertises a number it
 * cannot show the math for. `variantCount` is forms × sizes ×
 * colors per base, summed over the catalog, and the builder's
 * library panel prints that math next to the total. If a base is
 * added or a palette grows, the count moves because the math moved.
 *
 * This module is plain data + math — no three.js, no DOM — so the
 * counts and the catalog are unit-testable (AGENTS.md: avatar rules
 * stay in plain TS modules).
 */

export type LibraryCategory = "buildings" | "nature" | "park & street";

export type ItemSizeId = "small" | "medium" | "large" | "grand";

export const ITEM_SIZES: readonly { id: ItemSizeId; label: string; scale: number }[] = [
  { id: "small", label: "Small", scale: 0.7 },
  { id: "medium", label: "Medium", scale: 1 },
  { id: "large", label: "Large", scale: 1.5 },
  { id: "grand", label: "Grand", scale: 2.1 },
];

export function sizeScale(size: ItemSizeId): number {
  return ITEM_SIZES.find((entry) => entry.id === size)?.scale ?? 1;
}

export type LibraryColor = { id: string; label: string; hex: string };

const color = (id: string, label: string, hex: string): LibraryColor => ({ id, label, hex });

/** Palettes are per-base: a store can be brick red, a tree cannot. */
const BUILDING_COLORS: readonly LibraryColor[] = [
  color("brick", "Brick red", "#a03d2d"),
  color("sand", "Sandstone", "#c8a165"),
  color("cream", "Cream", "#eadfc6"),
  color("slate", "Slate blue", "#4d6a8a"),
  color("forest", "Forest green", "#3f6b4f"),
  color("plum", "Plum", "#6d4668"),
  color("charcoal", "Charcoal", "#3c4148"),
  color("terracotta", "Terracotta", "#c06a3a"),
  color("gold", "House gold", "#b98a1e"),
  color("white", "Bright white", "#f2f0ea"),
];

const ROOF_COLORS: readonly LibraryColor[] = BUILDING_COLORS;

const GREENS: readonly LibraryColor[] = [
  color("pine", "Pine green", "#2e7d46"),
  color("lime", "Lime green", "#79b34a"),
  color("deep", "Deep green", "#1f5c33"),
  color("sage", "Sage", "#8aa888"),
  color("autumn", "Autumn rust", "#b0622a"),
  color("goldleaf", "Gold leaf", "#c9a227"),
];

const FLOWER_COLORS: readonly LibraryColor[] = [
  color("rose", "Rose pink", "#d45d7e"),
  color("violet", "Violet", "#7a5fb0"),
  color("sunflower", "Sunflower", "#e0a81c"),
  color("whitebloom", "White bloom", "#f0eee6"),
  color("coral", "Coral", "#e07850"),
  color("sky", "Sky blue", "#6a9fd0"),
  color("crimson", "Crimson", "#b03040"),
  color("lavender", "Lavender", "#a48fd0"),
];

const STONE_COLORS: readonly LibraryColor[] = [
  color("granite", "Granite", "#8a8d90"),
  color("marble", "Marble white", "#e8e6df"),
  color("basalt", "Basalt", "#43464a"),
  color("sandstone", "Sandstone", "#c2a878"),
  color("bronze", "Bronze", "#8a6a34"),
];

const WOOD_COLORS: readonly LibraryColor[] = [
  color("oak", "Oak", "#8a6134"),
  color("walnut", "Walnut", "#5c4026"),
  color("painted-white", "Painted white", "#ece8de"),
  color("painted-green", "Painted green", "#3f6b4f"),
  color("painted-red", "Painted red", "#9c3830"),
  color("iron", "Black iron", "#2e3134"),
];

export type LibraryItem = {
  id: string;
  name: string;
  category: LibraryCategory;
  blurb: string;
  /** Variant forms — each one renders as genuinely different geometry. */
  forms: readonly { id: string; label: string }[];
  /** The palette this base can wear (its main material color). */
  colors: readonly LibraryColor[];
};

const form = (id: string, label: string) => ({ id, label });

export const LIBRARY: readonly LibraryItem[] = [
  /* ------------------------------ buildings ------------------------------ */
  {
    id: "store",
    name: "Store",
    category: "buildings",
    blurb: "A shopfront with a sign board, door and windows.",
    forms: [form("flat", "Flat roof"), form("gable", "Gable roof"), form("awning", "Awning")],
    colors: BUILDING_COLORS,
  },
  {
    id: "house",
    name: "House",
    category: "buildings",
    blurb: "A home with a chimney and a front door.",
    forms: [form("gable", "Gable roof"), form("hip", "Hip roof"), form("flat", "Flat roof")],
    colors: BUILDING_COLORS,
  },
  {
    id: "office-block",
    name: "Office block",
    category: "buildings",
    blurb: "A tall block with rows of lit windows.",
    forms: [form("slab", "Slab"), form("stepped", "Stepped"), form("twin", "Twin towers")],
    colors: BUILDING_COLORS,
  },
  {
    id: "cafe",
    name: "Café",
    category: "buildings",
    blurb: "A café with a striped awning and round windows.",
    forms: [form("awning", "Awning"), form("terrace", "Terrace roof"), form("gable", "Gable roof")],
    colors: BUILDING_COLORS,
  },
  {
    id: "market-stall",
    name: "Market stall",
    category: "buildings",
    blurb: "A market stall with a canopy and crates.",
    forms: [form("canopy", "Canopy"), form("striped", "Striped canopy"), form("open", "Open counter")],
    colors: BUILDING_COLORS,
  },
  {
    id: "kiosk",
    name: "Kiosk",
    category: "buildings",
    blurb: "A small kiosk with a serving hatch.",
    forms: [form("pyramid", "Pyramid roof"), form("dome", "Dome roof"), form("flat", "Flat roof")],
    colors: BUILDING_COLORS,
  },
  {
    id: "tower",
    name: "Tower",
    category: "buildings",
    blurb: "A watch tower with a crown.",
    forms: [form("spire", "Spire"), form("crenellated", "Crenellated"), form("lantern", "Lantern top")],
    colors: ROOF_COLORS,
  },
  {
    id: "gazebo",
    name: "Gazebo",
    category: "buildings",
    blurb: "Open posts and a roof — a place to stand under.",
    forms: [form("cone", "Cone roof"), form("pyramid", "Pyramid roof"), form("dome", "Dome roof")],
    colors: BUILDING_COLORS,
  },
  /* ------------------------------- nature -------------------------------- */
  {
    id: "pine",
    name: "Pine tree",
    category: "nature",
    blurb: "A pine with a cone canopy.",
    forms: [form("cone", "Single cone"), form("layered", "Layered cones"), form("slim", "Slim spire")],
    colors: GREENS,
  },
  {
    id: "round-tree",
    name: "Round tree",
    category: "nature",
    blurb: "A broad-canopy tree.",
    forms: [form("round", "Round canopy"), form("wide", "Wide canopy"), form("cluster", "Cluster canopy")],
    colors: GREENS,
  },
  {
    id: "palm",
    name: "Palm",
    category: "nature",
    blurb: "A leaning palm with fronds.",
    forms: [form("leaning", "Leaning"), form("straight", "Straight"), form("twin", "Twin trunks")],
    colors: GREENS,
  },
  {
    id: "bush",
    name: "Bush",
    category: "nature",
    blurb: "A rounded bush.",
    forms: [form("round", "Round"), form("mound", "Low mound"), form("cluster", "Cluster")],
    colors: GREENS,
  },
  {
    id: "flower-bed",
    name: "Flower bed",
    category: "nature",
    blurb: "A planted bed of blooms.",
    forms: [form("bed", "Long bed"), form("round", "Round bed"), form("border", "Border strip")],
    colors: FLOWER_COLORS,
  },
  {
    id: "hedge",
    name: "Hedge",
    category: "nature",
    blurb: "A clipped hedge run.",
    forms: [form("straight", "Straight"), form("corner", "Corner"), form("arch-top", "Arched top")],
    colors: GREENS,
  },
  {
    id: "rock",
    name: "Rock",
    category: "nature",
    blurb: "A standing rock.",
    forms: [form("boulder", "Boulder"), form("shard", "Shard"), form("cluster", "Cluster")],
    colors: STONE_COLORS,
  },
  {
    id: "cactus",
    name: "Cactus",
    category: "nature",
    blurb: "A desert cactus.",
    forms: [form("saguaro", "Saguaro arms"), form("barrel", "Barrel"), form("column", "Column")],
    colors: GREENS,
  },
  /* ---------------------------- park & street ---------------------------- */
  {
    id: "bench",
    name: "Bench",
    category: "park & street",
    blurb: "A bench with slats and legs.",
    forms: [form("slatted", "Slatted"), form("solid", "Solid"), form("iron", "Iron frame")],
    colors: WOOD_COLORS,
  },
  {
    id: "lamp-post",
    name: "Lamp post",
    category: "park & street",
    blurb: "A lamp post with a glowing head.",
    forms: [form("globe", "Globe"), form("lantern", "Lantern"), form("twin", "Twin heads")],
    colors: WOOD_COLORS,
  },
  {
    id: "fountain",
    name: "Fountain",
    category: "park & street",
    blurb: "A basin fountain with a center jet.",
    forms: [form("basin", "Round basin"), form("tiered", "Tiered"), form("square", "Square basin")],
    colors: STONE_COLORS,
  },
  {
    id: "statue",
    name: "Statue",
    category: "park & street",
    blurb: "A figure on a pedestal.",
    forms: [form("orb", "Orb bearer"), form("obelisk", "Obelisk"), form("sentinel", "Sentinel")],
    colors: STONE_COLORS,
  },
  {
    id: "sign-post",
    name: "Sign post",
    category: "park & street",
    blurb: "A post with a hanging sign board.",
    forms: [form("hanging", "Hanging sign"), form("board", "Notice board"), form("double", "Double board")],
    colors: BUILDING_COLORS,
  },
  {
    id: "fence",
    name: "Fence",
    category: "park & street",
    blurb: "A run of fence posts and rails.",
    forms: [form("picket", "Picket"), form("rail", "Post and rail"), form("iron", "Iron bars")],
    colors: WOOD_COLORS,
  },
  {
    id: "planter",
    name: "Planter",
    category: "park & street",
    blurb: "A planter box with green growth.",
    forms: [form("box", "Box"), form("trough", "Trough"), form("urn", "Urn")],
    colors: BUILDING_COLORS,
  },
  {
    id: "arch",
    name: "Garden arch",
    category: "park & street",
    blurb: "An arch to walk under.",
    forms: [form("beam", "Beam top"), form("curve", "Curved top"), form("gate", "With gates")],
    colors: WOOD_COLORS,
  },
  {
    id: "well",
    name: "Well",
    category: "park & street",
    blurb: "A stone well with a little roof.",
    forms: [form("roofed", "Roofed"), form("open", "Open"), form("bucket", "With bucket")],
    colors: STONE_COLORS,
  },
  {
    id: "tent",
    name: "Tent",
    category: "park & street",
    blurb: "A canvas tent.",
    forms: [form("ridge", "Ridge tent"), form("pavilion", "Pavilion"), form("lean-to", "Lean-to")],
    colors: BUILDING_COLORS,
  },
];

export function libraryItem(id: string): LibraryItem | null {
  return LIBRARY.find((item) => item.id === id) ?? null;
}

/** The honest math for one base: forms × sizes × colors. */
export function variantCount(item: LibraryItem): number {
  return item.forms.length * ITEM_SIZES.length * item.colors.length;
}

/** The honest total across the whole catalog. */
export function totalVariantCount(): number {
  return LIBRARY.reduce((sum, item) => sum + variantCount(item), 0);
}

/** The count line the panel prints — the math, not just the number. */
export function variantCountLine(): string {
  const total = totalVariantCount();
  return `${LIBRARY.length} base pieces — forms × ${ITEM_SIZES.length} sizes × colors each = ${total.toLocaleString("en-US")} placeable variants`;
}

/** The default variant a base is added with (its first form + first color). */
export function defaultVariant(item: LibraryItem): { form: string; size: ItemSizeId; color: string } {
  return {
    form: item.forms[0]!.id,
    size: "medium",
    color: item.colors[0]!.id,
  };
}

/** Resolve a stored color id to its hex (falls back to the first palette color). */
export function colorHex(item: LibraryItem, colorId: string): string {
  return (item.colors.find((entry) => entry.id === colorId) ?? item.colors[0])!.hex;
}
