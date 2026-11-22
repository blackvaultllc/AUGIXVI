/**
 * THE BUILDER'S 3D HAND — renders the Captain's designed room
 * (builder/room.ts data) inside the avatar stage's Three.js scene.
 *
 * Items are real geometry, not pictures: a store is a body with a
 * sign board, a door and windows; a pine is a trunk under cones; a
 * fountain is a basin with water and a jet. Shapes look like what
 * they claim. Each base in the library has one parametric builder
 * here, and its FORMS genuinely change the geometry — that is what
 * makes the library's variant count honest.
 *
 * The group stands on the same ground line as the living world
 * (y = -3.2, floor plane y = 0 in room coordinates), beside the
 * WorldSceneManager's group — the builder's furniture belongs to
 * the Room scene, and the renderer shows this group only there.
 *
 * Reconciliation is by item id with a build signature
 * (base|form|size|color): dragging an item updates only its
 * transform, never rebuilds its geometry.
 */
import * as THREE from "three";
import { colorHex, libraryItem, sizeScale } from "./library";
import type { PlacedItem, RoomContent } from "./room";

/** Same ground line the SceneManager and the living world build on. */
const GROUND_Y = -3.2;

const mat = (hex: string, emissive = 0x000000) =>
  new THREE.MeshLambertMaterial({ color: new THREE.Color(hex), emissive: new THREE.Color(emissive) });

function box(
  group: THREE.Group,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  ry = 0,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = ry;
  group.add(mesh);
  return mesh;
}

function cyl(
  group: THREE.Group,
  rTop: number,
  rBottom: number,
  h: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  segments = 14,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  mesh.position.set(x, y + h / 2, z);
  group.add(mesh);
  return mesh;
}

function cone(
  group: THREE.Group,
  r: number,
  h: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  segments = 14,
) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, segments), material);
  mesh.position.set(x, y + h / 2, z);
  group.add(mesh);
  return mesh;
}

function ball(
  group: THREE.Group,
  r: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  squashY = 1,
) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material);
  mesh.position.set(x, y + r * squashY, z);
  mesh.scale.y = squashY;
  group.add(mesh);
  return mesh;
}

/** A gable/prism roof: a 3-sided cylinder laid along z. */
function prism(
  group: THREE.Group,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(h / 1.5, h / 1.5, d, 3, 1), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.rotation.y = Math.PI / 2;
  mesh.scale.x = w / h;
  mesh.position.set(x, y + h / 2, z);
  group.add(mesh);
  return mesh;
}

const GLASS = "#26343f";
const CREAM = "#f2e3bb";
const WATER = "#7fb8d8";

/** Build one placed item's geometry. Origin: floor center of the item. */
export function buildItemGroup(item: PlacedItem): THREE.Group {
  const group = new THREE.Group();
  const base = libraryItem(item.baseId);
  if (!base) return group;
  const main = mat(colorHex(base, item.color));
  const dark = mat("#3a3f45");
  const glass = mat(GLASS, 0x0a1a24);
  const cream = mat(CREAM);
  const trunk = mat("#6b4a2a");
  const form = item.form;

  switch (item.baseId) {
    case "store": {
      box(group, 1.9, 1.1, 1.4, main, 0, 0, 0);
      box(group, 1.7, 0.34, 0.08, cream, 0, 1.12, 0.72); // the sign board
      box(group, 0.42, 0.78, 0.06, dark, -0.5, 0, 0.72); // door
      box(group, 0.55, 0.5, 0.06, glass, 0.45, 0.35, 0.72); // window
      if (form === "gable") prism(group, 2.1, 0.55, 1.6, dark, 0, 1.44, 0);
      else if (form === "awning") {
        const awning = box(group, 1.8, 0.05, 0.55, mat("#b03040"), 0, 0.82, 0.95);
        awning.rotation.x = -0.35;
      } else box(group, 2.05, 0.1, 1.55, dark, 0, 1.44, 0);
      break;
    }
    case "house": {
      box(group, 1.6, 1.0, 1.3, main, 0, 0, 0);
      box(group, 0.4, 0.75, 0.06, dark, 0, 0, 0.67);
      box(group, 0.4, 0.4, 0.06, glass, -0.5, 0.45, 0.67);
      box(group, 0.22, 0.5, 0.22, mat("#8a8d90"), 0.45, 1.3, -0.3); // chimney
      if (form === "hip") cone(group, 1.45, 0.6, dark, 0, 1.0, 0, 4);
      else if (form === "flat") box(group, 1.75, 0.09, 1.45, dark, 0, 1.0, 0);
      else prism(group, 1.8, 0.55, 1.5, dark, 0, 1.0, 0);
      break;
    }
    case "office-block": {
      const windows = mat("#bfe0ea", 0x24333c);
      if (form === "twin") {
        for (const side of [-0.55, 0.55]) {
          box(group, 0.95, 2.7, 1.3, main, side, 0, 0);
          for (let r = 0; r < 5; r += 1) box(group, 0.75, 0.16, 0.05, windows, side, 0.35 + r * 0.48, 0.67);
        }
      } else if (form === "stepped") {
        box(group, 1.9, 1.5, 1.7, main, 0, 0, 0);
        box(group, 1.4, 1.1, 1.25, main, 0, 1.5, 0);
        for (let r = 0; r < 3; r += 1) box(group, 1.6, 0.15, 0.05, windows, 0, 0.3 + r * 0.45, 0.87);
        for (let r = 0; r < 2; r += 1) box(group, 1.1, 0.15, 0.05, windows, 0, 1.75 + r * 0.45, 0.65);
      } else {
        box(group, 1.8, 2.6, 1.7, main, 0, 0, 0);
        for (let r = 0; r < 5; r += 1) box(group, 1.5, 0.16, 0.05, windows, 0, 0.35 + r * 0.48, 0.87);
      }
      break;
    }
    case "cafe": {
      box(group, 1.8, 1.05, 1.35, main, 0, 0, 0);
      for (const side of [-0.45, 0.45]) {
        const win = cyl(group, 0.21, 0.21, 0.06, glass, side, 0.45, 0.68, 18);
        win.rotation.x = Math.PI / 2;
      }
      if (form === "terrace") {
        box(group, 2.0, 0.08, 1.6, dark, 0, 1.05, 0);
        box(group, 1.9, 0.3, 0.05, dark, 0, 1.13, 0.78);
      } else if (form === "gable") prism(group, 2.0, 0.5, 1.55, dark, 0, 1.05, 0);
      else {
        for (let i = 0; i < 5; i += 1) {
          const stripe = box(group, 0.36, 0.05, 0.6, i % 2 ? cream : mat("#b03040"), -0.72 + i * 0.36, 0.86, 0.95);
          stripe.rotation.x = -0.3;
        }
      }
      break;
    }
    case "market-stall": {
      for (const [px, pz] of [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]] as const)
        cyl(group, 0.045, 0.045, 1.5, trunk, px, 0, pz, 8);
      box(group, 1.7, 0.5, 0.9, main, 0, 0.25, 0.2); // counter
      box(group, 0.4, 0.35, 0.4, mat("#8a6134"), -0.95, 0, 0.75); // crate
      box(group, 0.4, 0.35, 0.4, mat("#8a6134"), -0.95, 0, 0.25);
      if (form === "striped") {
        for (let i = 0; i < 5; i += 1) {
          const slat = box(group, 0.38, 0.05, 1.4, i % 2 ? cream : main, -0.76 + i * 0.38, 1.5, 0);
          slat.rotation.z = 0.06;
        }
      } else if (form === "canopy") {
        const canopy = box(group, 1.95, 0.06, 1.5, main, 0, 1.52, 0);
        canopy.rotation.z = 0.06;
      }
      break;
    }
    case "kiosk": {
      box(group, 1.1, 1.2, 1.1, main, 0, 0, 0);
      box(group, 0.8, 0.55, 0.06, dark, 0, 0.45, 0.57); // serving hatch
      if (form === "dome") ball(group, 0.72, dark, 0, 1.2, 0, 0.65);
      else if (form === "flat") box(group, 1.25, 0.09, 1.25, dark, 0, 1.2, 0);
      else cone(group, 0.85, 0.55, dark, 0, 1.2, 0, 4);
      break;
    }
    case "tower": {
      cyl(group, 0.52, 0.62, 2.5, main, 0, 0, 0, 10);
      box(group, 0.3, 0.5, 0.06, dark, 0, 0, 0.6);
      if (form === "spire") cone(group, 0.72, 1.0, dark, 0, 2.5, 0, 10);
      else if (form === "lantern") {
        box(group, 0.5, 0.45, 0.5, mat("#ffd98a", 0x665511), 0, 2.5, 0);
        cone(group, 0.6, 0.5, dark, 0, 2.95, 0, 4);
      } else {
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * Math.PI * 2;
          box(group, 0.18, 0.3, 0.18, main, Math.cos(a) * 0.52, 2.5, Math.sin(a) * 0.52);
        }
      }
      break;
    }
    case "gazebo": {
      cyl(group, 1.05, 1.05, 0.12, dark, 0, 0, 0, 8);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        cyl(group, 0.05, 0.05, 1.35, main, Math.cos(a) * 0.92, 0.1, Math.sin(a) * 0.92, 8);
      }
      if (form === "dome") ball(group, 1.15, main, 0, 1.45, 0, 0.55);
      else if (form === "pyramid") cone(group, 1.3, 0.7, main, 0, 1.45, 0, 4);
      else cone(group, 1.3, 0.75, main, 0, 1.45, 0, 8);
      break;
    }
    case "pine": {
      cyl(group, 0.09, 0.13, 0.7, trunk, 0, 0, 0, 8);
      if (form === "layered") {
        cone(group, 0.85, 0.9, main, 0, 0.55, 0);
        cone(group, 0.62, 0.8, main, 0, 1.15, 0);
        cone(group, 0.38, 0.7, main, 0, 1.7, 0);
      } else if (form === "slim") cone(group, 0.5, 2.3, main, 0, 0.6, 0);
      else cone(group, 0.95, 1.9, main, 0, 0.6, 0);
      break;
    }
    case "round-tree": {
      cyl(group, 0.1, 0.15, 0.9, trunk, 0, 0, 0, 8);
      if (form === "wide") ball(group, 1.05, main, 0, 0.95, 0, 0.62);
      else if (form === "cluster") {
        ball(group, 0.62, main, -0.4, 1.0, 0);
        ball(group, 0.7, main, 0.35, 1.15, 0.15);
        ball(group, 0.5, main, 0, 1.35, -0.3);
      } else ball(group, 0.85, main, 0, 0.95, 0);
      break;
    }
    case "palm": {
      const fronds = (topX: number, topY: number) => {
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * Math.PI * 2;
          const frond = box(group, 0.85, 0.04, 0.2, main, topX + Math.cos(a) * 0.38, topY + 0.12, Math.sin(a) * 0.38);
          frond.rotation.y = -a;
          frond.rotation.z = Math.cos(a) * -0.5;
          frond.rotation.x = Math.sin(a) * 0.5;
        }
      };
      if (form === "twin") {
        cyl(group, 0.07, 0.1, 1.7, trunk, -0.3, 0, 0, 8);
        cyl(group, 0.07, 0.1, 1.45, trunk, 0.35, 0, 0.2, 8);
        fronds(-0.3, 1.7);
        fronds(0.35, 1.45);
      } else if (form === "straight") {
        cyl(group, 0.08, 0.11, 1.9, trunk, 0, 0, 0, 8);
        fronds(0, 1.9);
      } else {
        const leaning = cyl(group, 0.08, 0.11, 1.9, trunk, 0, 0, 0, 8);
        leaning.rotation.z = 0.22;
        leaning.position.x = 0.2;
        fronds(0.42, 1.82);
      }
      break;
    }
    case "bush": {
      if (form === "mound") ball(group, 0.55, main, 0, 0, 0, 0.5);
      else if (form === "cluster") {
        ball(group, 0.4, main, -0.3, 0, 0, 0.8);
        ball(group, 0.48, main, 0.25, 0, 0.1, 0.8);
        ball(group, 0.34, main, 0, 0, -0.3, 0.8);
      } else ball(group, 0.5, main, 0, 0, 0, 0.85);
      break;
    }
    case "flower-bed": {
      const soil = mat("#4a3421");
      const blooms = (cx: number, cz: number, n: number, spread: number) => {
        for (let i = 0; i < n; i += 1) {
          const a = i * 2.39996;
          ball(group, 0.075, main, cx + Math.cos(a) * spread * ((i % 5) / 5 + 0.3), 0.16, cz + Math.sin(a) * spread * 0.6, 0.9);
        }
      };
      if (form === "round") {
        cyl(group, 0.65, 0.7, 0.22, soil, 0, 0, 0, 16);
        blooms(0, 0, 9, 0.4);
      } else if (form === "border") {
        box(group, 2.4, 0.2, 0.45, soil, 0, 0, 0);
        blooms(0, 0, 12, 1.0);
      } else {
        box(group, 1.7, 0.22, 0.8, soil, 0, 0, 0);
        blooms(0, 0, 10, 0.6);
      }
      break;
    }
    case "hedge": {
      if (form === "corner") {
        box(group, 1.8, 0.65, 0.45, main, -0.35, 0, 0);
        box(group, 0.45, 0.65, 1.8, main, 0.32, 0, 0.35);
      } else if (form === "arch-top") {
        box(group, 2.0, 0.5, 0.45, main, 0, 0, 0);
        const top = cyl(group, 0.23, 0.23, 2.0, main, 0, 0.5, 0, 10);
        top.rotation.z = Math.PI / 2;
      } else box(group, 2.0, 0.65, 0.45, main, 0, 0, 0);
      break;
    }
    case "rock": {
      const rockGeo = (r: number) => new THREE.DodecahedronGeometry(r);
      if (form === "shard") {
        const shard = new THREE.Mesh(rockGeo(0.55), main);
        shard.scale.set(0.8, 1.7, 0.8);
        shard.position.y = 0.5;
        group.add(shard);
      } else if (form === "cluster") {
        for (const [rx, rz, rr] of [[-0.4, 0, 0.42], [0.3, 0.15, 0.55], [0.05, -0.35, 0.33]] as const) {
          const rock = new THREE.Mesh(rockGeo(rr), main);
          rock.position.set(rx, rr * 0.6, rz);
          group.add(rock);
        }
      } else {
        const boulder = new THREE.Mesh(rockGeo(0.62), main);
        boulder.scale.y = 0.8;
        boulder.position.y = 0.35;
        group.add(boulder);
      }
      break;
    }
    case "cactus": {
      if (form === "barrel") ball(group, 0.42, main, 0, 0, 0, 0.85);
      else if (form === "column") cyl(group, 0.16, 0.19, 1.5, main, 0, 0, 0, 10);
      else {
        cyl(group, 0.17, 0.2, 1.4, main, 0, 0, 0, 10);
        for (const side of [-1, 1] as const) {
          // Out along the elbow, then up — the saguaro arm.
          const connector = cyl(group, 0.085, 0.085, 0.3, main, side * 0.14, 0.72, 0, 8);
          connector.rotation.z = Math.PI / 2;
          const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), main);
          elbow.position.set(side * 0.28, 0.8, 0);
          group.add(elbow);
          cyl(group, 0.085, 0.085, 0.5, main, side * 0.28, 0.8, 0, 8);
        }
      }
      break;
    }
    case "bench": {
      if (form === "solid") {
        box(group, 1.7, 0.12, 0.5, main, 0, 0.42, 0);
        box(group, 1.7, 0.5, 0.1, main, 0, 0.54, -0.24);
        box(group, 0.12, 0.42, 0.45, dark, -0.7, 0, 0);
        box(group, 0.12, 0.42, 0.45, dark, 0.7, 0, 0);
      } else {
        for (let i = 0; i < 3; i += 1) box(group, 1.7, 0.05, 0.13, main, 0, 0.44, -0.16 + i * 0.16);
        for (let i = 0; i < 2; i += 1) box(group, 1.7, 0.11, 0.05, main, 0, 0.72 + i * 0.22, -0.26);
        const legMat = form === "iron" ? mat("#2e3134") : dark;
        box(group, 0.09, 0.44, 0.4, legMat, -0.7, 0, 0);
        box(group, 0.09, 0.44, 0.4, legMat, 0.7, 0, 0);
      }
      break;
    }
    case "lamp-post": {
      cyl(group, 0.045, 0.06, 1.9, main, 0, 0, 0, 8);
      const glow = mat("#ffd98a", 0x776622);
      if (form === "twin") {
        box(group, 0.8, 0.06, 0.06, main, 0, 1.82, 0);
        ball(group, 0.13, glow, -0.4, 1.68, 0);
        ball(group, 0.13, glow, 0.4, 1.68, 0);
      } else if (form === "lantern") box(group, 0.24, 0.3, 0.24, glow, 0, 1.9, 0);
      else ball(group, 0.16, glow, 0, 1.9, 0);
      break;
    }
    case "fountain": {
      const water = mat(WATER, 0x11222c);
      if (form === "square") {
        box(group, 1.7, 0.42, 1.7, main, 0, 0, 0);
        box(group, 1.4, 0.06, 1.4, water, 0, 0.4, 0);
        cyl(group, 0.09, 0.12, 0.7, main, 0, 0.4, 0, 8);
      } else {
        cyl(group, 0.95, 1.05, 0.42, main, 0, 0, 0, 20);
        const disc = cyl(group, 0.82, 0.82, 0.05, water, 0, 0.4, 0, 20);
        disc.position.y = 0.42;
        cyl(group, 0.09, 0.13, 0.75, main, 0, 0.4, 0, 8);
        if (form === "tiered") {
          cyl(group, 0.45, 0.5, 0.14, main, 0, 1.05, 0, 16);
          cyl(group, 0.05, 0.07, 0.35, main, 0, 1.15, 0, 8);
        } else ball(group, 0.09, water, 0, 1.15, 0);
      }
      break;
    }
    case "statue": {
      box(group, 0.7, 0.8, 0.7, main, 0, 0, 0);
      if (form === "obelisk") {
        const ob = cyl(group, 0.06, 0.3, 1.5, main, 0, 0.8, 0, 4);
        ob.rotation.y = Math.PI / 4;
      } else if (form === "sentinel") {
        box(group, 0.42, 0.85, 0.26, main, 0, 0.8, 0);
        ball(group, 0.17, main, 0, 1.68, 0);
      } else {
        cyl(group, 0.09, 0.11, 0.7, main, 0, 0.8, 0, 8);
        ball(group, 0.3, main, 0, 1.5, 0);
      }
      break;
    }
    case "sign-post": {
      if (form === "board") {
        cyl(group, 0.05, 0.05, 1.3, trunk, -0.6, 0, 0, 8);
        cyl(group, 0.05, 0.05, 1.3, trunk, 0.6, 0, 0, 8);
        box(group, 1.5, 0.8, 0.06, main, 0, 0.55, 0);
      } else if (form === "double") {
        cyl(group, 0.05, 0.06, 1.5, trunk, 0, 0, 0, 8);
        box(group, 0.95, 0.3, 0.05, main, 0.3, 1.15, 0);
        box(group, 0.95, 0.3, 0.05, main, -0.3, 0.8, 0);
      } else {
        cyl(group, 0.05, 0.06, 1.5, trunk, 0, 0, 0, 8);
        box(group, 0.7, 0.06, 0.06, trunk, 0.3, 1.38, 0);
        box(group, 0.6, 0.42, 0.05, main, 0.32, 0.92, 0);
      }
      break;
    }
    case "fence": {
      const length = 2.3;
      if (form === "iron") {
        for (let i = 0; i < 9; i += 1) cyl(group, 0.025, 0.025, 0.85, mat("#2e3134"), -length / 2 + i * (length / 8), 0, 0, 6);
        box(group, length, 0.05, 0.05, mat("#2e3134"), 0, 0.8, 0);
        box(group, length, 0.05, 0.05, mat("#2e3134"), 0, 0.35, 0);
      } else {
        for (let i = 0; i < 5; i += 1) {
          const px = -length / 2 + i * (length / 4);
          box(group, 0.11, 0.8, 0.11, main, px, 0, 0);
          if (form === "picket") cone(group, 0.09, 0.16, main, px, 0.8, 0, 4);
        }
        box(group, length, 0.09, 0.04, main, 0, 0.55, 0);
        box(group, length, 0.09, 0.04, main, 0, 0.25, 0);
      }
      break;
    }
    case "planter": {
      if (form === "urn") {
        cyl(group, 0.32, 0.2, 0.55, main, 0, 0, 0, 12);
        ball(group, 0.36, mat("#3f7d3a"), 0, 0.5, 0, 0.7);
      } else if (form === "trough") {
        box(group, 1.9, 0.4, 0.5, main, 0, 0, 0);
        ball(group, 0.3, mat("#3f7d3a"), -0.6, 0.38, 0, 0.6);
        ball(group, 0.34, mat("#3f7d3a"), 0.1, 0.4, 0, 0.6);
        ball(group, 0.28, mat("#3f7d3a"), 0.7, 0.38, 0, 0.6);
      } else {
        box(group, 0.95, 0.45, 0.95, main, 0, 0, 0);
        ball(group, 0.42, mat("#3f7d3a"), 0, 0.42, 0, 0.7);
      }
      break;
    }
    case "arch": {
      box(group, 0.12, 1.6, 0.12, main, -0.85, 0, 0);
      box(group, 0.12, 1.6, 0.12, main, 0.85, 0, 0);
      if (form === "curve") {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 8, 20, Math.PI), main);
        arc.position.y = 1.6;
        group.add(arc);
      } else {
        box(group, 1.85, 0.14, 0.14, main, 0, 1.6, 0);
        if (form === "gate") {
          box(group, 0.7, 1.1, 0.05, main, -0.42, 0.05, 0);
          box(group, 0.7, 1.1, 0.05, main, 0.42, 0.05, 0);
        }
      }
      break;
    }
    case "well": {
      cyl(group, 0.55, 0.6, 0.7, main, 0, 0, 0, 12);
      if (form !== "open") {
        cyl(group, 0.05, 0.05, 1.3, trunk, -0.55, 0.5, 0, 8);
        cyl(group, 0.05, 0.05, 1.3, trunk, 0.55, 0.5, 0, 8);
        prism(group, 1.5, 0.4, 1.1, mat("#7a4a30"), 0, 1.75, 0);
        if (form === "bucket") box(group, 0.22, 0.2, 0.22, dark, 0, 1.0, 0);
      }
      break;
    }
    case "tent": {
      if (form === "pavilion") {
        cyl(group, 0.8, 0.95, 0.9, main, 0, 0, 0, 10);
        cone(group, 1.15, 0.6, main, 0, 0.9, 0, 10);
      } else if (form === "lean-to") {
        const lean = box(group, 1.7, 0.06, 1.4, main, 0, 0.95, 0);
        lean.rotation.z = 0.5;
        cyl(group, 0.05, 0.05, 1.25, trunk, -0.75, 0, 0.5, 8);
        cyl(group, 0.05, 0.05, 0.6, trunk, 0.75, 0, 0.5, 8);
      } else prism(group, 1.6, 1.05, 2.0, main, 0, 0, 0);
      break;
    }
    default:
      box(group, 0.8, 0.8, 0.8, main, 0, 0, 0);
  }
  return group;
}

function itemSignature(item: PlacedItem): string {
  return `${item.baseId}|${item.form}|${item.size}|${item.color}`;
}

function disposeGroup(group: THREE.Group) {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose();
  });
}

/**
 * Owns the builder's corner of the stage scene: one group for the
 * placed items, a selection ring, an anchor ring per locked item,
 * and the lights the solid geometry needs.
 */
export class BuilderSceneManager {
  private group = new THREE.Group();
  private entries = new Map<string, { group: THREE.Group; signature: string; ring: THREE.Mesh }>();
  private selectionRing: THREE.Mesh;
  private selectedId: string | null = null;

  constructor(scene: THREE.Scene) {
    this.group.name = "augi-builder-room";
    this.group.position.y = GROUND_Y;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x9a8a70, 1.15);
    this.group.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
    sun.position.set(6, 10, 5);
    this.group.add(sun);
    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.0, 40),
      new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.03;
    this.selectionRing.visible = false;
    this.selectionRing.name = "builder-selection-ring";
    this.group.add(this.selectionRing);
    scene.add(this.group);
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  /** Reconcile the rendered items with the room data. */
  setRoom(room: RoomContent) {
    const seen = new Set<string>();
    for (const item of room.items) {
      seen.add(item.id);
      const signature = itemSignature(item);
      let entry = this.entries.get(item.id);
      if (!entry || entry.signature !== signature) {
        if (entry) {
          this.group.remove(entry.group);
          disposeGroup(entry.group);
          this.group.remove(entry.ring);
          disposeGroup(entry.ring as unknown as THREE.Group);
        }
        const built = buildItemGroup(item);
        built.name = `builder-item-${item.id}`;
        built.userData["itemId"] = item.id;
        built.traverse((child) => (child.userData["itemId"] = item.id));
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.8, 0.88, 36),
          new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.025;
        ring.name = `builder-anchor-ring-${item.id}`;
        this.group.add(built);
        this.group.add(ring);
        entry = { group: built, signature, ring };
        this.entries.set(item.id, entry);
      }
      this.applyTransform(item, entry);
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue;
      this.group.remove(entry.group);
      disposeGroup(entry.group);
      this.group.remove(entry.ring);
      disposeGroup(entry.ring as unknown as THREE.Group);
      this.entries.delete(id);
    }
    this.refreshSelection();
  }

  private applyTransform(item: PlacedItem, entry: { group: THREE.Group; ring: THREE.Mesh }) {
    const scale = sizeScale(item.size);
    entry.group.position.set(item.x, 0, item.z);
    entry.group.rotation.y = THREE.MathUtils.degToRad(item.rotation);
    entry.group.scale.setScalar(scale);
    entry.ring.position.set(item.x, 0.025, item.z);
    entry.ring.scale.setScalar(scale);
    entry.ring.visible = item.anchored;
  }

  setSelected(id: string | null) {
    this.selectedId = id;
    this.refreshSelection();
  }

  private refreshSelection() {
    const entry = this.selectedId ? this.entries.get(this.selectedId) : undefined;
    if (!entry) {
      this.selectionRing.visible = false;
      return;
    }
    const p = entry.group.position;
    this.selectionRing.position.set(p.x, 0.03, p.z);
    this.selectionRing.scale.setScalar(entry.group.scale.x);
    this.selectionRing.visible = true;
  }

  /** Raycast targets — the placed items' groups. */
  pickRoots(): THREE.Object3D[] {
    return [...this.entries.values()].map((entry) => entry.group);
  }

  dispose() {
    for (const entry of this.entries.values()) {
      disposeGroup(entry.group);
      disposeGroup(entry.ring as unknown as THREE.Group);
    }
    this.entries.clear();
    this.group.removeFromParent();
  }
}
