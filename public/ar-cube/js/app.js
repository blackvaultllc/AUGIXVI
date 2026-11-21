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
  { key: 'squishy',   label: 'Squishy',   kind: 'primitive', build: buildSquishy, hint: 'key 1',
    keywords: ['squishy', 'blob', 'cute', 'pink'] },
  { key: 'goldcube',  label: 'Gold Cube', kind: 'primitive', build: buildGoldCube, hint: 'key 2',
    keywords: ['gold', 'cube', 'gold cube', 'pharaoh', 'pyramid'] },
  { key: 'heart',     label: 'Heart',     kind: 'primitive', build: buildHeart, hint: 'key 3',
    keywords: ['heart', 'love'] },
  { key: 'castle',    label: 'Castle',    kind: 'primitive', build: buildCastle, hint: 'key 4',
    keywords: ['castle', 'fort', 'kingdom', 'tower'] },
  { key: 'wolf',      label: 'Wolf',      kind: 'glb', file: 'wolf_with_animations.glb',
    keywords: ['wolf', 'wolves', 'dog', 'animated wolf'] },
  { key: 'direwolf',  label: 'Dire Wolf', kind: 'glb', file: 'warcraft_-_dire_wolf.glb',
    keywords: ['wolf', 'wolves', 'dire wolf', 'dire', 'warcraft'] },
  { key: 'hellwolf',  label: 'Hell Wolf', kind: 'glb', file: 'hell_wolf.glb',
    keywords: ['wolf', 'wolves', 'hell wolf', 'hell', 'dark wolf'] },
  { key: 'character', label: 'Character', kind: 'glb', file: 'cyberpunk_character.glb',
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

// Wrap a cloned GLB scene so it stands on the cube face the same way the
// primitives do: centered on the face, base near the face's lower edge,
// biggest dimension ~0.85 of a face width, pushed out from the surface.
function instantiateGlb(gltf) {
  const inner = SkeletonUtils.clone(gltf.scene);
  const bbox = new THREE.Box3().setFromObject(inner);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 0.85 / maxDim;
  inner.scale.setScalar(scale);
  inner.position.set(-center.x * scale, -bbox.min.y * scale - 0.38, -center.z * scale);
  const g = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.z = 0.30;
  holder.add(inner);
  g.add(holder);
  let mixer = null;
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(inner);
    mixer.clipAction(gltf.animations[0]).play();
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

function refreshModelButtons() {
  document.querySelectorAll('.modelBtn').forEach(b =>
    b.classList.toggle('active', b.dataset.model === appliedModel));
}

function applyToAnchors(makeInstance) {
  for (let i = 0; i < anchorRoots.length; i++) {
    if (modelInstances[i]) {
      anchorRoots[i].remove(modelInstances[i].group);
      // GLB clones share geometry with the cached prototype — never dispose
      // those; primitive builds own their geometry and are safe to dispose.
      if (CATALOG_BY_KEY[appliedModel] && CATALOG_BY_KEY[appliedModel].kind === 'primitive') {
        disposeInstance(modelInstances[i]);
      }
    }
    const built = makeInstance();
    anchorRoots[i].add(built.group);
    modelInstances[i] = built;
  }
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
    applyToAnchors(() => instantiateGlb(gltf));
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
      anchor.onTargetFound = () => {
        lockedFace = i;
        setStatus('Locked on: ' + FACE_NAMES[i], 'locked');
      };
      anchor.onTargetLost = () => {
        if (lockedFace === i) {
          lockedFace = -1;
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
