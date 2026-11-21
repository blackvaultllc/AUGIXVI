// Augie AR Cube v2 — MindAR image tracking + Three.js models.
//
// WHAT CHANGED IN v2 (Domenick's fix list from live use, 2026-11-21):
// 1. CAMERA ALWAYS VISIBLE. v1's viewport went black while the status said
//    "Camera running": MindAR 1.2.5 pins its <video> at z-index -2, and the
//    container's opaque background painted straight over the feed. The
//    container is transparent now and the layering is pinned in CSS and
//    re-asserted inline after start (see fixCameraLayering below).
// 2. RECOGNITION. Face targets re-extracted from the paper-cube net on the
//    exact face grid (v1 rode ~28 px high and clipped every face) with a
//    levels crush + sharpen, then targets.mind recompiled. Same face ->
//    target index mapping as v1.
// 3. TYPED FILTER + REAL MODEL LIBRARY. Type what you want ("wolf",
//    "castle", "brain") and that model is the one pinned to the cube.
//    Library = the 4 built-in primitives PLUS Domenick's own GLB files
//    served from /models/. GLBs load LAZILY: only the selected model is
//    downloaded/instantiated, one at a time, so tracking stays light.
// 4. The same page runs full-screen at /avatar/cube and small inside the
//    avatar screen's AR Cube floating window (an iframe of this page).
// 5. v2.1 ANCHORING FIX (same day, Domenick's live test): the Hell Wolf
//    rendered standing on the table beside the cube. GLB seats are no
//    longer computed from CPU bounding boxes — for these skinned exports
//    they lie about where the model renders. Seats are MEASURED from the
//    model's own rendered silhouette, clips are pinned in place and
//    stand/idle loops preferred, ground slabs inside files are stripped,
//    and four-legged figures stand in profile on the face — every model
//    now takes over the cube like the primitives do. See the "GLB
//    seating" section below for the full diagnosis.
// 6. v2.2 TAKEOVER FIX (same day, Domenick's second live test): the seat
//    was right but the printed cube still showed around the model — he
//    wants the cube GONE: "the animation should be taking over the cube
//    ... or it should be inside the cube so that way they can be looking
//    at it in a 3D aspect — it needs to be augmented reality." So each
//    anchor now carries an OCCLUSION SHELL: a virtual cube the size of
//    the real one (a hair larger, so tracking jitter cannot leak a
//    printed edge), extending from the tracked face back through the
//    cube's whole volume, rendered inside-out (BackSide). The shell
//    paints over the cube's entire silhouette with the volume's inner
//    walls, and the model is re-staged INSIDE that volume — centered on
//    the cube's center, standing on its floor — so where the printed
//    cube was, there is now a small 3D stage holding the item, viewable
//    in the round as the cube turns. See "Takeover shell" below.
import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Target index order in targets.mind (see README.md / assets/faces/):
const FACE_NAMES = [
  'Eye Triangle',      // 0 — top face of the net
  'Compass Circle',    // 1 — left face of the net
  'Diamond Star',      // 2 — center face of the net
  'Moon Octagon',      // 3 — right face of the net
  'Cube + MERGE Band', // 4 — face below center
  'Triangles',         // 5 — bottom face of the net
];

const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const container = document.getElementById('ar-container');
const filterInput = document.getElementById('modelFilter');
const matchesEl = document.getElementById('filterMatches');
const loadNoteEl = document.getElementById('loadNote');

function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className = cls;
}

function setLoadNote(text, isError = false) {
  loadNoteEl.textContent = text || '';
  loadNoteEl.className = isError ? 'error' : '';
}

// ---------------------------------------------------------------------------
// Model builders. Anchor space: x = right along the face, y = up along the
// face, z = out of the face toward the camera. 1 unit = one cube-face width.
// Every builder returns { group, update(t, delta) }.
// ---------------------------------------------------------------------------

function buildSquishy() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const mat = (c, r = 0.35) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0.0 });
  const sph = (r, c, x, y, z, sx = 1, sy = 1, sz = 1, rough = 0.35) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat(c, rough));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); inner.add(m); return m;
  };
  // glossy blob body
  sph(0.30, 0xffa8c5, 0, 0, 0.26, 1, 0.95, 0.9, 0.22);
  // cream belly patch
  sph(0.19, 0xfff3e0, 0, -0.08, 0.43, 1, 1.1, 0.45, 0.4);
  // big shiny eyes
  sph(0.075, 0xffffff, -0.11, 0.10, 0.50, 1, 1, 0.6, 0.15);
  sph(0.075, 0xffffff,  0.11, 0.10, 0.50, 1, 1, 0.6, 0.15);
  sph(0.038, 0x1c2430, -0.11, 0.10, 0.545, 1, 1, 0.5, 0.15);
  sph(0.038, 0x1c2430,  0.11, 0.10, 0.545, 1, 1, 0.5, 0.15);
  sph(0.013, 0xffffff, -0.095, 0.125, 0.565, 1, 1, 0.5, 0.1);
  sph(0.013, 0xffffff,  0.125, 0.125, 0.565, 1, 1, 0.5, 0.1);
  // rosy cheeks
  sph(0.045, 0xff7d9c, -0.20, -0.02, 0.46, 1, 1, 0.4, 0.5);
  sph(0.045, 0xff7d9c,  0.20, -0.02, 0.46, 1, 1, 0.4, 0.5);
  // nub arms + feet
  sph(0.07, 0xffa8c5, -0.31, -0.05, 0.30, 1.2, 0.8, 0.8, 0.3);
  sph(0.07, 0xffa8c5,  0.31, -0.05, 0.30, 1.2, 0.8, 0.8, 0.3);
  sph(0.08, 0xffa8c5, -0.13, -0.295, 0.30, 1.2, 0.55, 1, 0.3);
  sph(0.08, 0xffa8c5,  0.13, -0.295, 0.30, 1.2, 0.55, 1, 0.3);
  return { group: g, update(t) {
    const s = Math.sin(t * 3.0);
    inner.scale.set(1 + s * 0.03, 1 - s * 0.045, 1 + s * 0.03); // squash & stretch
    inner.position.z = Math.abs(Math.sin(t * 3.0)) * 0.02;
  }};
}

function buildGoldCube() {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.28, metalness: 0.9 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x14418f, roughness: 0.35, metalness: 0.6 }); // pharaoh blue
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), gold);
  cube.position.z = 0.30; spin.add(cube);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.14), blue);
  band.position.z = 0.30; spin.add(band);
  const pyr = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.17, 4), gold);
  pyr.position.set(0, 0.315, 0.30); pyr.rotation.y = Math.PI / 4; spin.add(pyr);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.055),
    new THREE.MeshStandardMaterial({ color: 0x2f6df6, roughness: 0.15, metalness: 0.3, emissive: 0x0a2a7a }));
  gem.position.set(0, 0, 0.545); spin.add(gem);
  return { group: g, update(t) {
    spin.rotation.z = t * 0.5;
    spin.position.z = Math.sin(t * 1.6) * 0.02;
  }};
}

function buildHeart() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.30);
  s.bezierCurveTo(-0.42, 0.02, -0.30, 0.34, 0, 0.16);
  s.bezierCurveTo(0.30, 0.34, 0.42, 0.02, 0, -0.30);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 24 });
  geo.center();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe63950, roughness: 0.25, metalness: 0.05 }));
  mesh.position.z = 0.28;
  const g = new THREE.Group(); g.add(mesh);
  return { group: g, update(t) {
    const p = 1 + Math.sin(t * 4.0) * 0.06;
    mesh.scale.set(p, p, 1);
    mesh.position.z = 0.28 + Math.sin(t * 2.0) * 0.015;
  }};
}

function buildCastle() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.8, metalness: 0.05 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.85, metalness: 0.05 });
  const roofBlue = new THREE.MeshStandardMaterial({ color: 0x14418f, roughness: 0.5, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.9 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  const box = (w, h, d, m, x, y, z) => {
    const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    q.position.set(x, y, z); g.add(q); return q;
  };
  const cyl = (rT, rB, h, m, x, y, z) => {
    const q = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, 20), m);
    q.position.set(x, y, z); g.add(q); return q;
  };
  const cone = (r, h, m, x, y, z) => {
    const q = new THREE.Mesh(new THREE.ConeGeometry(r, h, 20), m);
    q.position.set(x, y, z); g.add(q); return q;
  };
  box(0.86, 0.09, 0.42, stoneDark, 0, -0.355, 0.21);          // platform
  box(0.46, 0.44, 0.30, stone, 0, -0.10, 0.19);               // keep
  [-0.16, 0, 0.16].forEach(x => box(0.09, 0.07, 0.30, stone, x, 0.155, 0.19)); // battlements
  cyl(0.095, 0.105, 0.58, stone, -0.34, -0.03, 0.19);         // left tower
  cyl(0.095, 0.105, 0.58, stone,  0.34, -0.03, 0.19);         // right tower
  cone(0.14, 0.20, roofBlue, -0.34, 0.36, 0.19);              // tower roofs
  cone(0.14, 0.20, roofBlue,  0.34, 0.36, 0.19);
  cyl(0.06, 0.06, 0.18, stone, 0, 0.21, 0.19);                // center turret
  cone(0.09, 0.13, roofBlue, 0, 0.365, 0.19);
  box(0.14, 0.20, 0.02, dark, 0, -0.22, 0.345);               // gate
  box(0.045, 0.07, 0.012, glow, -0.34, 0.05, 0.288);          // lit windows
  box(0.045, 0.07, 0.012, glow,  0.34, 0.05, 0.288);
  const pole = cyl(0.008, 0.008, 0.16, dark, 0, 0.47, 0.19); // flag pole
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.075),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.4 }));
  flag.position.set(0.072, 0.515, 0.19); g.add(flag);
  return { group: g, update(t) { flag.rotation.y = Math.sin(t * 6.0) * 0.45; } };
}

// ---------------------------------------------------------------------------
// Model catalog — built-in primitives + Domenick's GLB library.
// GLB files live in the app's public /models/ folder; the page sits at
// /ar-cube/, so '../models/<file>' resolves to the app origin's /models/.
// ---------------------------------------------------------------------------
const MODELS_BASE = '../models/';
const MODEL_CATALOG = [
  { key: 'squishy',   label: 'Squishy',   kind: 'primitive', build: buildSquishy, hint: 'key 1', stageScale: 1.3,
    keywords: ['squishy', 'blob', 'cute', 'pink'] },
  { key: 'goldcube',  label: 'Gold Cube', kind: 'primitive', build: buildGoldCube, hint: 'key 2', stageScale: 1.45,
    keywords: ['gold', 'cube', 'gold cube', 'pharaoh', 'pyramid'] },
  { key: 'heart',     label: 'Heart',     kind: 'primitive', build: buildHeart, hint: 'key 3', stageScale: 1.05,
    keywords: ['heart', 'love'] },
  { key: 'castle',    label: 'Castle',    kind: 'primitive', build: buildCastle, hint: 'key 4', stageScale: 1.0,
    keywords: ['castle', 'fort', 'kingdom', 'tower'] },
  { key: 'wolf',      label: 'Wolf',      kind: 'glb', file: 'wolf_with_animations.glb',
    keywords: ['wolf', 'wolves', 'dog', 'animated wolf'] },
  { key: 'direwolf',  label: 'Dire Wolf', kind: 'glb', file: 'warcraft_-_dire_wolf.glb',
    keywords: ['wolf', 'wolves', 'dire wolf', 'dire', 'warcraft'] },
  { key: 'hellwolf',  label: 'Hell Wolf', kind: 'glb', file: 'hell_wolf.glb',
    keywords: ['wolf', 'wolves', 'hell wolf', 'hell', 'dark wolf'] },
  { key: 'character', label: 'Character', kind: 'glb', file: 'cyberpunk_character.glb', turn: Math.PI,
    keywords: ['character', 'cyberpunk', 'person', 'figure', 'glasses'] },
  { key: 'brain',     label: 'Brain',     kind: 'glb', file: 'human-brain.glb',
    keywords: ['brain', 'mind', 'human brain'] },
  { key: 'skull',     label: 'Skull',     kind: 'glb', file: 'human_female_skull.glb',
    keywords: ['skull', 'bone', 'skeleton', 'human skull'] },
  { key: 'scanner',   label: 'Scanner',   kind: 'glb', file: 'futuristic_sci-fi_planet_scanner_radar_thing.glb',
    keywords: ['scanner', 'radar', 'planet scanner', 'sci-fi', 'scifi', 'dish'] },
];
const CATALOG_BY_KEY = Object.fromEntries(MODEL_CATALOG.map(m => [m.key, m]));

// Ranked filter matching: exact label > label contains > exact keyword >
// keyword contains. Returns catalog entries, best first.
function matchModels(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const m of MODEL_CATALOG) {
    const label = m.label.toLowerCase();
    let score = -1;
    if (label === q) score = 0;
    else if (label.startsWith(q)) score = 1;
    else if (label.includes(q)) score = 2;
    else if (m.keywords.some(k => k === q)) score = 3;
    else if (m.keywords.some(k => k.includes(q))) score = 4;
    if (score >= 0) scored.push({ m, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.map(s => s.m);
}

// ---------------------------------------------------------------------------
// GLB loading — lazy and cached. Only the selected model is fetched; the
// parsed prototype is kept and cloned per anchor, so switching back is
// instant and tracking never carries more than the one chosen model.
// ---------------------------------------------------------------------------
const gltfLoader = new GLTFLoader();
const glbPrototypes = new Map(); // key -> Promise<gltf>

function loadGlbPrototype(entry) {
  if (!glbPrototypes.has(entry.key)) {
    glbPrototypes.set(entry.key, gltfLoader.loadAsync(MODELS_BASE + entry.file));
  }
  return glbPrototypes.get(entry.key);
}

// ---------------------------------------------------------------------------
// GLB seating — MEASURED from the GPU, never from bounding-box APIs.
//
// Domenick's live test (2026-11-21): he picked the Hell Wolf, pointed the
// camera at his cube, and the wolf rendered standing on the table BESIDE
// the cube, huge — not on the cube at all. Diagnosis, proven against the
// rendered pixels in a headless harness: for these Sketchfab/FBX exports
// every CPU bounding box lies about where a skinned model really renders.
// Box3.setFromObject reads the Hell Wolf as 2.28 units long standing at
// +Y; the GPU renders it 228 units long hanging at -Y (a 100x unit factor
// plus a reflection), the Dire Wolf's length comes back axis-swapped, the
// animated Wolf's bounds are swallowed by the 5.5-unit ground plane in
// its file, and the clips walk their root bones through space. Rigid
// models (brain, skull, scanner) were always fine — their boxes are true.
//
// So a GLB's seat is computed from the only witness that cannot lie: its
// own rendered silhouette, measured offscreen across its animation, with
// the clip pinned in place first. What the silhouette says is where the
// model goes — centered on the face, at cube scale, paws/base on the face.
// ---------------------------------------------------------------------------

// The clip a model wears on the cube: a standing/idle loop when the file
// offers one (the Wolf's "04_Idle", the Dire Wolf's "Wolf_Stand"), else
// its first clip (the Hell Wolf has only "Take 001").
function pickGlbClip(gltf) {
  const anims = gltf.animations || [];
  if (!anims.length) return null;
  return anims.find(a => /stand|idle/i.test(a.name || '')) || anims[0];
}

// A copy of the clip with the skeleton roots' position tracks removed.
// FBX clips carry root motion — a run cycle would carry the figure clean
// off the cube. With the root pinned, the legs/arms/head still animate,
// but the figure stays where it was put: on the cube.
function pinClipInPlace(clip, root) {
  const rootBones = new Set();
  root.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) {
      for (const bone of o.skeleton.bones) {
        let p = bone.parent, isRoot = true;
        while (p) { if (p.isBone) { isRoot = false; break; } p = p.parent; }
        if (isRoot) rootBones.add(bone.name);
      }
    }
  });
  if (!rootBones.size) return clip;
  const kept = clip.tracks.filter((t) =>
    !t.name.endsWith('.position') || !rootBones.has(t.name.slice(0, -9)));
  if (kept.length === clip.tracks.length) return clip;
  const pinned = clip.clone();
  pinned.tracks = kept;
  return pinned;
}

// A skinned figure sometimes ships standing on a big flat ground slab
// (wolf_with_animations carries a 5.5 x 5.5 plane). The slab is scenery,
// not the item. Identification: the candidate's own box is trustworthy
// (rigid meshes' boxes are true), and it is judged against the figure's
// MEASURED size passed in by the caller — flat (thinnest side <= 10% of
// its longest) and huge (longest side at least 2x the figure's largest
// dimension). Small props a figure legitimately carries never qualify.
function findGroundPlanes(inner, figureMaxDim) {
  const doomed = [];
  inner.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh) return;
    const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
    const mx = Math.max(s.x, s.y, s.z);
    const mn = Math.min(s.x, s.y, s.z);
    if (mx >= 2 * figureMaxDim && mn <= 0.10 * mx) doomed.push(o);
  });
  return doomed;
}

function removeGroundPlanes(inner, figureMaxDim) {
  for (const o of findGroundPlanes(inner, figureMaxDim)) {
    if (o.parent) o.parent.remove(o);
  }
}

let sharedMeasureRenderer = null;
function getMeasureRenderer() {
  if (!sharedMeasureRenderer) {
    sharedMeasureRenderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    sharedMeasureRenderer.setSize(256, 256);
    sharedMeasureRenderer.setClearColor(0xff00ff, 1); // magenta: no model is magenta, so any model pixel differs
  }
  return sharedMeasureRenderer;
}

// Union of the model's rendered silhouettes in its own (gltf scene) space.
// pose = null measures the bind pose; pose = { mixer, duration } steps the
// playing clip. Two camera passes per pose set: front (+z) for x/y, and a
// -90° Y-rotated pass for z/y. Each pass hunts for the model's scale, then
// refits tight, expanding if the silhouette touches the frame edge.
// Returns a Box3, or null when nothing renders at all.
function measureRenderedBounds(inner, pose) {
  let renderer;
  try { renderer = getMeasureRenderer(); } catch (e) { return null; }
  const W = 256, H = 256;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const dl = new THREE.DirectionalLight(0xffffff, 1.2);
  dl.position.set(0.5, 1, 2); scene.add(dl);
  const probe = new THREE.Group();
  probe.add(inner);
  scene.add(probe);
  const gl = renderer.getContext();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);

  const times = [-1]; // -1 = leave the pose exactly as it is (bind)
  if (pose && pose.mixer && pose.duration > 0) {
    times.length = 0;
    for (let i = 0; i <= 10; i++) times.push(pose.duration * i / 10);
  }

  function silhouette() {
    probe.visible = true;
    renderer.render(scene, cam);
    const a = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a);
    probe.visible = false;
    renderer.render(scene, cam);
    const b = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
    probe.visible = true;
    let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) {
        n++;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
    return n ? { minx, miny, maxx, maxy } : null;
  }

  // One view pass. viewZ=false: screen x = model x. viewZ=true (probe
  // rotated -90° about Y): screen x = -model z. Returns { u: [min,max],
  // y: [min, max] } in model space for that view's horizontal axis, or null.
  function viewPass(viewZ) {
    probe.rotation.y = viewZ ? -Math.PI / 2 : 0;
    let center = { x: 0, y: 0 }, half = 512, sil = null;
    // scale hunt at the first pose
    for (let hunt = 0; hunt < 8; hunt++) {
      if (times[0] >= 0 && pose) pose.mixer.setTime(times[0]);
      cam.position.set(center.x, center.y, 2000);
      cam.lookAt(center.x, center.y, 0);
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
      cam.updateProjectionMatrix();
      sil = silhouette();
      if (sil) break;
      half /= 4;
    }
    if (!sil) { probe.rotation.y = 0; return null; }
    const px2u = (px) => center.x - half + (px + 0.5) / W * 2 * half;
    const py2u = (py) => center.y - half + (py + 0.5) / H * 2 * half;
    // refit tight around the hunt result, then union every pose
    center = { x: (px2u(sil.minx) + px2u(sil.maxx)) / 2, y: (py2u(sil.miny) + py2u(sil.maxy)) / 2 };
    half = Math.max(px2u(sil.maxx) - px2u(sil.minx), py2u(sil.maxy) - py2u(sil.miny)) * 0.75 + 0.01;
    let uMin = Infinity, uMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (let round = 0; round < 4; round++) {
      uMin = Infinity; uMax = -Infinity; yMin = Infinity; yMax = -Infinity;
      let clipped = false;
      for (const t of times) {
        if (t >= 0 && pose) pose.mixer.setTime(t);
        cam.position.set(center.x, center.y, 2000);
        cam.lookAt(center.x, center.y, 0);
        cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
        cam.updateProjectionMatrix();
        const s = silhouette();
        if (!s) continue;
        if (s.minx <= 1 || s.maxx >= W - 2 || s.miny <= 1 || s.maxy >= H - 2) clipped = true;
        uMin = Math.min(uMin, px2u(s.minx)); uMax = Math.max(uMax, px2u(s.maxx));
        yMin = Math.min(yMin, py2u(s.miny)); yMax = Math.max(yMax, py2u(s.maxy));
      }
      if (!clipped || !isFinite(uMin)) break;
      center = { x: (uMin + uMax) / 2, y: (yMin + yMax) / 2 };
      half *= 1.6;
    }
    probe.rotation.y = 0;
    if (!isFinite(uMin)) return null;
    if (viewZ) return { u: [-uMax, -uMin], y: [yMin, yMax] }; // screen x was -model z
    return { u: [uMin, uMax], y: [yMin, yMax] };
  }

  const front = viewPass(false);
  if (!front) { scene.remove(probe); return null; }
  const depth = viewPass(true);
  scene.remove(probe);
  const box = new THREE.Box3(
    new THREE.Vector3(front.u[0], front.y[0], depth ? depth.u[0] : -0.001),
    new THREE.Vector3(front.u[1], front.y[1], depth ? depth.u[1] : 0.001));
  if (depth) { // y seen from two views: keep the wider witness
    box.min.y = Math.min(box.min.y, depth.y[0]);
    box.max.y = Math.max(box.max.y, depth.y[1]);
  }
  return box;
}

// The 8 corners of a box run through a rotation, re-boxed.
function rotatedBox(box, basis) {
  const out = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    v.set(x, y, z).applyMatrix4(basis);
    out.expandByPoint(v);
  }
  return out;
}

// Compute a model's seat ONCE (from a throwaway probe clone) and cache it:
// every anchor's clone then just re-applies the same numbers. The seat is
// what makes the item TAKE OVER the cube face: centered on the face, sized
// to the face, base/paws on the face. Upright figures and objects
// (character, brain, skull, scanner) stand on the face like the primitives
// do. Four-legged figures (the wolves: a skinned body whose height is not
// its largest dimension) are turned side-on and stood on the face the same
// way — paws on the face's base line, body in profile across the face.
// Measure one fresh probe clone of the model (bind pose + the pinned clip
// stepped through), optionally after `setup` adjusts the clone (hide or
// remove meshes). Returns the probe and the union bounds (or null).
function measureGlbBounds(gltf, setup) {
  const probe = SkeletonUtils.clone(gltf.scene);
  if (setup) setup(probe);
  const bindBox = measureRenderedBounds(probe, null);
  const clip = pickGlbClip(gltf);
  let animBox = null;
  if (clip) {
    const pm = new THREE.AnimationMixer(probe);
    pm.clipAction(pinClipInPlace(clip, probe)).play();
    animBox = measureRenderedBounds(probe, { mixer: pm, duration: clip.duration });
  }
  let bounds = bindBox || animBox;
  if (bindBox && animBox) bounds = bindBox.clone().union(animBox);
  return { probe, bounds };
}

const glbSeatCache = new WeakMap(); // gltf -> seat
function computeGlbSeat(gltf, turn) {
  let { probe, bounds } = measureGlbBounds(gltf, null);
  // Ground-slab pass: when a skinned figure shares its file with separate
  // non-skinned meshes, measure the figure ALONE (rendered truth — the
  // slab cannot poison it), drop any flat huge slab against that size,
  // and re-measure what remains.
  let anySkin = false;
  const nonSkinned = [];
  probe.traverse((o) => {
    if (o.isSkinnedMesh) anySkin = true;
    else if (o.isMesh) nonSkinned.push(o);
  });
  let stripFigureMax = null;
  if (anySkin && nonSkinned.length) {
    const fig = measureGlbBounds(gltf, (p) => {
      p.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) o.visible = false; });
    });
    if (fig.bounds) {
      const fs = fig.bounds.getSize(new THREE.Vector3());
      const figureMax = Math.max(fs.x, fs.y, fs.z);
      if (findGroundPlanes(probe, figureMax).length) {
        stripFigureMax = figureMax;
        bounds = measureGlbBounds(gltf, (p) => removeGroundPlanes(p, figureMax)).bounds || bounds;
      }
    }
  }
  if (!bounds) bounds = new THREE.Box3().setFromObject(probe); // WebGL-less fallback: rigid-true boxes
  const size = bounds.getSize(new THREE.Vector3());

  if (anySkin && size.y < Math.max(size.x, size.z)) {
    // PROFILE figure (the wolves): a four-legged body whose length is not
    // its height. Turn it side-on and stand it on the face exactly like
    // the primitives stand — paws on the face's base line, body in
    // profile across the face, sized to fit the face both ways. (Laying
    // its ground plane onto the face instead would show the camera its
    // back, like a specimen pinned to a board — verified in the harness.)
    let basis = null;
    if (size.z > size.x) {
      // length runs along model z: yaw 90° so it runs across the face (x)
      basis = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
    }
    const rb = basis ? rotatedBox(bounds, basis) : bounds;
    const rs = rb.getSize(new THREE.Vector3());
    const rc = rb.getCenter(new THREE.Vector3());
    const s = Math.min(0.92 / (rs.x || 1), 0.85 / (rs.y || 1));
    return {
      basis, scale: s, holderZ: 0.30, stripFigureMax,
      innerPos: new THREE.Vector3(-rc.x * s, -rb.min.y * s - 0.38, -rc.z * s),
    };
  }
  // UPRIGHT: centered on the face, base at the face's lower edge, height
  // ~0.85 of a face width, pushed out from the surface. A catalog entry
  // may carry `turn` when its file faces away from the viewer (the
  // Character's A-pose shows his back) — yaw him around to face out.
  const basis = turn ? new THREE.Matrix4().makeRotationY(turn) : null;
  const rb = basis ? rotatedBox(bounds, basis) : bounds;
  const rc = rb.getCenter(new THREE.Vector3());
  const s = 0.85 / (size.y || 1);
  return {
    basis, scale: s, holderZ: 0.30, stripFigureMax,
    innerPos: new THREE.Vector3(-rc.x * s, -rb.min.y * s - 0.38, -rc.z * s),
  };
}

function instantiateGlb(gltf, turn) {
  const inner = SkeletonUtils.clone(gltf.scene);
  let seat = glbSeatCache.get(gltf);
  if (!seat) { seat = computeGlbSeat(gltf, turn); glbSeatCache.set(gltf, seat); }
  if (seat.stripFigureMax) removeGroundPlanes(inner, seat.stripFigureMax);
  if (seat.basis) inner.quaternion.setFromRotationMatrix(seat.basis);
  inner.scale.setScalar(seat.scale);
  inner.position.copy(seat.innerPos);
  const g = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.z = seat.holderZ;
  holder.add(inner);
  g.add(holder);
  let mixer = null;
  const clip = pickGlbClip(gltf);
  if (clip) {
    mixer = new THREE.AnimationMixer(inner);
    mixer.clipAction(pinClipInPlace(clip, inner)).play();
  }
  return { group: g, update(t, delta) { if (mixer) mixer.update(delta || 0); } };
}

function disposeInstance(inst) {
  if (!inst || !inst.group) return;
  inst.group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => m.dispose());
    }
  });
}

// ---------------------------------------------------------------------------
// TAKEOVER SHELL — the cube disappears, the item lives in its volume.
//
// Anchor space recap: the tracked face is the square [-0.5, 0.5]² at z=0,
// +z out of the face toward the camera. The physical cube fills the box
// behind that face: z from 0 back to -1. The shell is that box, built a
// hair oversize (1.05) so a whisper of tracking jitter still cannot leak
// a printed edge, and rendered BackSide: from outside you see only its
// INNER walls, floor and ceiling, projected across the cube's whole
// silhouette. Every pixel where the printed cube was is repainted — by
// the item where the item stands, by the volume's dim interior
// elsewhere. There is no front wall, so you look INTO the volume: the
// item stands inside the space the cube occupies, in 3D, and the whole
// stage rides the anchor as the cube turns in his hand.
//
// The model is re-staged into the volume by makeStageGroup: the seat the
// v2.1 fix measured (model standing on the face plane, holder pushed
// +0.30 out of the face) is shifted to the volume's center — base/paws
// land on the volume's floor (y = -0.5), the body centers on z = -0.5.
// Small primitives carry a catalog stageScale so they grow toward the
// cube's size: the item becomes the cube.
// ---------------------------------------------------------------------------
const TAKEOVER = {
  size: 1.05,                                  // shell edge length (anchor units)
  frontLip: 0.02,                              // how far the shell reaches in front of the face plane
  stagePos: new THREE.Vector3(0, -0.12, -0.80), // face seat -> volume seat
};

function buildTakeoverShell() {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(TAKEOVER.size, TAKEOVER.size, TAKEOVER.size),
    new THREE.MeshStandardMaterial({
      color: 0x12141f, roughness: 0.95, metalness: 0.0, side: THREE.BackSide,
    }));
  // Box center sits so the shell spans z = +frontLip .. frontLip - size:
  // the whole cube volume, plus a lip in front of the tracked face.
  wall.position.z = TAKEOVER.frontLip - TAKEOVER.size / 2;
  g.add(wall);
  // A soft lamp inside the volume, up near the open front: the item reads
  // lit and dimensional inside the dimmer shell, and the inner walls get
  // a gentle falloff instead of a flat fill. One shell is visible at a
  // time (see refreshShells), so at most one of these lamps is ever lit.
  const lamp = new THREE.PointLight(0xd8e4ff, 0.55, 0, 2);
  lamp.position.set(0.25, 0.45, -0.15);
  g.add(lamp);
  g.visible = false;
  return g;
}

// Wrap a built model instance in its stage: shifted from the face seat
// into the cube's volume and (for the small primitives) scaled up toward
// the cube's size. GLB seats already target the full face, so their
// stageScale is 1 — only the shift applies.
function makeStageGroup(inst, stageScale) {
  const stage = new THREE.Group();
  stage.position.copy(TAKEOVER.stagePos);
  if (stageScale && stageScale !== 1) stage.scale.setScalar(stageScale);
  stage.add(inst.group);
  return stage;
}

// ---------------------------------------------------------------------------
// Tracking setup + model application
// ---------------------------------------------------------------------------
let mindarThree = null;
let started = false;
let currentModel = 'squishy'; // selected
let appliedModel = 'squishy'; // last successfully put on the anchors
let modelSeq = 0;             // guards against out-of-order GLB loads
let lockedFace = -1;
const anchorRoots = [];   // one plain Group per face anchor; holds the model
const modelInstances = []; // per-anchor built model {group, update}
const modelStages = [];    // per-anchor stage group wrapping the model
const shellGroups = [];    // per-anchor takeover shell (volume + lamp)

// The takeover shell shows only on the face that is locked right now and
// only while a model stands in its volume — one shell, one lamp, ever.
// Tracking loss hides the shell with everything else (it lives under the
// anchor root, and this refresh runs on every found/lost transition).
function refreshShells() {
  for (let i = 0; i < shellGroups.length; i++) {
    shellGroups[i].visible = (i === lockedFace) && !!modelInstances[i];
  }
}

function refreshModelButtons() {
  document.querySelectorAll('.modelBtn').forEach(b =>
    b.classList.toggle('active', b.dataset.model === appliedModel));
}

function applyToAnchors(makeInstance) {
  const stageScale = (CATALOG_BY_KEY[currentModel] || {}).stageScale || 1;
  for (let i = 0; i < anchorRoots.length; i++) {
    if (modelInstances[i]) {
      if (modelStages[i]) anchorRoots[i].remove(modelStages[i]);
      // GLB clones share geometry with the cached prototype — never dispose
      // those; primitive builds own their geometry and are safe to dispose.
      if (CATALOG_BY_KEY[appliedModel] && CATALOG_BY_KEY[appliedModel].kind === 'primitive') {
        disposeInstance(modelInstances[i]);
      }
    }
    const built = makeInstance();
    const stage = makeStageGroup(built, stageScale);
    anchorRoots[i].add(stage);
    modelInstances[i] = built;
    modelStages[i] = stage;
  }
  refreshShells();
}

async function setModel(key) {
  const entry = CATALOG_BY_KEY[key];
  if (!entry) return;
  currentModel = key;
  const seq = ++modelSeq;
  if (entry.kind === 'primitive') {
    applyToAnchors(() => entry.build());
    appliedModel = key;
    setLoadNote('');
    refreshModelButtons();
    return;
  }
  // GLB: fetch only this one model, only now.
  setLoadNote('Loading ' + entry.label + '… (one-time download, a few MB)');
  try {
    const gltf = await loadGlbPrototype(entry);
    if (seq !== modelSeq) return; // a newer pick superseded this load
    applyToAnchors(() => instantiateGlb(gltf, entry.turn));
    appliedModel = key;
    setLoadNote(entry.label + ' ready.');
    refreshModelButtons();
  } catch (e) {
    if (seq !== modelSeq) return;
    console.error(e);
    // Honest failure: keep the previous model on the cube, say what happened.
    glbPrototypes.delete(entry.key); // a retry should re-fetch, not reuse the failure
    currentModel = appliedModel;
    setLoadNote('Could not load ' + entry.label + ' — the file did not arrive. ' +
      'The previous model is still on the cube; check the connection and pick it again.', true);
    refreshModelButtons();
  }
}

// Buttons are generated from the catalog so the page and the list can't drift.
function buildModelButtons() {
  const rows = { primitive: document.getElementById('builtinRow'), glb: document.getElementById('libraryRow') };
  for (const entry of MODEL_CATALOG) {
    const b = document.createElement('button');
    b.className = 'modelBtn';
    b.dataset.model = entry.key;
    b.textContent = entry.label;
    if (entry.hint) {
      const s = document.createElement('small');
      s.textContent = entry.hint;
      b.appendChild(s);
    }
    b.addEventListener('click', () => { void setModel(entry.key); });
    rows[entry.kind].appendChild(b);
  }
  refreshModelButtons();
}

// ---------------------------------------------------------------------------
// Typed filter — type what you want; matches appear as chips, Enter picks
// the best one. No match is reported plainly, never faked.
// ---------------------------------------------------------------------------
function renderFilterMatches() {
  const q = filterInput.value;
  matchesEl.textContent = '';
  if (!q.trim()) return;
  const matches = matchModels(q);
  if (matches.length === 0) {
    const span = document.createElement('span');
    span.className = 'matchNone';
    span.textContent = 'No model matches "' + q.trim() + '" — try wolf, castle, brain, skull, scanner.';
    matchesEl.appendChild(span);
    return;
  }
  for (const m of matches) {
    const chip = document.createElement('button');
    chip.className = 'matchChip';
    chip.textContent = m.label;
    chip.addEventListener('click', () => { void setModel(m.key); });
    matchesEl.appendChild(chip);
  }
}
filterInput.addEventListener('input', renderFilterMatches);
filterInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const matches = matchModels(filterInput.value);
    if (matches.length > 0) void setModel(matches[0].key);
  }
});
window.addEventListener('keydown', (e) => {
  if (document.activeElement === filterInput) return; // don't steal his typing
  const map = { '1': 'squishy', '2': 'goldcube', '3': 'heart', '4': 'castle' };
  if (map[e.key]) void setModel(map[e.key]);
});

// ---------------------------------------------------------------------------
// CAMERA LAYERING FIX. MindAR creates its <video> with inline z-index -2;
// any ancestor/sibling paint above it (v1's opaque container background)
// hides the feed while tracking keeps running — the black viewport. Pin
// the real stacking here: video at 0, canvases above it, clear alpha 0.
// ---------------------------------------------------------------------------
function fixCameraLayering() {
  const video = container.querySelector('video');
  if (video) {
    video.style.zIndex = '0';
    video.style.position = 'absolute';
    video.style.top = '0px';
    video.style.left = '0px';
    video.style.pointerEvents = 'none';
  }
  container.querySelectorAll('canvas').forEach((c, i) => {
    c.style.zIndex = String(i + 1);
    c.style.pointerEvents = 'none';
  });
  if (mindarThree && mindarThree.renderer) {
    mindarThree.renderer.setClearColor(0x000000, 0);
  }
}

buildModelButtons();

startBtn.addEventListener('click', async () => {
  if (started) return;
  started = true;
  startBtn.disabled = true;
  startBtn.textContent = 'Starting…';
  setStatus('Starting camera…', 'scanning');
  try {
    mindarThree = new MindARThree({
      container,
      imageTargetSrc: './assets/targets.mind',
      maxTrack: 1,
      uiLoading: 'no', uiScanning: 'no', uiError: 'no',
    });
    const { renderer, scene, camera } = mindarThree;
    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(0.5, 1, 2);
    scene.add(dir);

    for (let i = 0; i < FACE_NAMES.length; i++) {
      const anchor = mindarThree.addAnchor(i);
      const root = new THREE.Group();
      anchor.group.add(root);
      anchorRoots.push(root);
      const shell = buildTakeoverShell();
      root.add(shell);
      shellGroups.push(shell);
      anchor.onTargetFound = () => {
        lockedFace = i;
        refreshShells();
        setStatus('Locked on: ' + FACE_NAMES[i], 'locked');
      };
      anchor.onTargetLost = () => {
        if (lockedFace === i) {
          lockedFace = -1;
          refreshShells();
          setStatus('Tracking lost — looking for cube…', 'scanning');
        }
      };
    }
    // Put the selected model on the anchors (instant for primitives; a GLB
    // pick made before Start loads in the background and swaps in).
    void setModel(currentModel);

    await mindarThree.start();
    fixCameraLayering();
    setStatus('Looking for cube…', 'scanning');
    startBtn.textContent = 'Camera running — show it the cube';

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();
      const t = clock.elapsedTime;
      for (const inst of modelInstances) if (inst && inst.update) inst.update(t, delta);
      renderer.render(scene, camera);
    });
  } catch (e) {
    console.error(e);
    setStatus('Could not start camera/tracking: ' + (e && e.message ? e.message : e), 'error');
    startBtn.disabled = false;
    startBtn.textContent = '▶ Start Camera';
    started = false;
  }
});
