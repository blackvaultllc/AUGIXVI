// Augie AR Cube v1 — MindAR image tracking + Three.js primitive models.
// HARD RULE (Domenick's order): models are built ONLY from Three.js primitives
// in this file. No external GLB/3D files are ever downloaded, so models load
// instantly. The only data file is assets/targets.mind (the cube-face tracking
// data compiled from his own cube's face patterns).
import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';

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

function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className = cls;
}

// ---------------------------------------------------------------------------
// Model builders. Anchor space: x = right along the face, y = up along the
// face, z = out of the face toward the camera. 1 unit = one cube-face width.
// Every builder returns { group, update(t) } and uses primitives only.
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

const MODELS = { squishy: buildSquishy, goldcube: buildGoldCube, heart: buildHeart, castle: buildCastle };
const MODEL_LABELS = { squishy: 'Squishy', goldcube: 'Gold Cube', heart: 'Heart', castle: 'Castle' };

// ---------------------------------------------------------------------------
// Tracking setup
// ---------------------------------------------------------------------------
let mindarThree = null;
let started = false;
let currentModel = 'squishy';
let lockedFace = -1;
const anchorRoots = [];   // one plain Group per face anchor; holds the model
const modelInstances = []; // per-anchor built model {group, update}

function setModel(key) {
  currentModel = key;
  document.querySelectorAll('.modelBtn').forEach(b =>
    b.classList.toggle('active', b.dataset.model === key));
  for (let i = 0; i < anchorRoots.length; i++) {
    if (modelInstances[i]) anchorRoots[i].remove(modelInstances[i].group);
    const built = MODELS[key]();
    anchorRoots[i].add(built.group);
    modelInstances[i] = built;
  }
}

document.querySelectorAll('.modelBtn').forEach(b =>
  b.addEventListener('click', () => setModel(b.dataset.model)));
window.addEventListener('keydown', (e) => {
  const map = { '1': 'squishy', '2': 'goldcube', '3': 'heart', '4': 'castle' };
  if (map[e.key]) setModel(map[e.key]);
});

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
    setModel(currentModel);

    await mindarThree.start();
    setStatus('Looking for cube…', 'scanning');
    startBtn.textContent = 'Camera running — show it the cube';

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const t = clock.getElapsedTime();
      for (const inst of modelInstances) if (inst && inst.update) inst.update(t);
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
