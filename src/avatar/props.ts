import * as THREE from "three";

/** Particle props (hands, file) that materialize from scattered "unknown" points. */
const vert = /* glsl */ `
attribute vec3 aScatter; attribute float aRand;
uniform float uTime, uForm, uPixel, uSize;
varying float vRand; varying float vA;
void main(){
  float f = smoothstep(aRand * 0.5, aRand * 0.5 + 0.5, uForm);
  vec3 p = mix(aScatter, position, f);
  p += vec3(sin(uTime*1.3+aRand*50.), cos(uTime*1.1+aRand*40.), 0.) * 0.006;
  vRand = aRand; vA = f;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * uPixel * (4.0 / -mv.z) * (0.7 + aRand * 0.6);
  gl_Position = projectionMatrix * mv;
}`;
const frag = /* glsl */ `
uniform vec3 uColA, uColB; uniform float uTime, uGlow;
varying float vRand; varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.0, r) * (0.25 + 0.75 * vA);
  vec3 col = mix(uColB, uColA, 0.5 + 0.5 * sin(uTime * 2.0 + vRand * 9.0)) * uGlow;
  gl_FragColor = vec4(col * a, a);
}`;

export function makeProp(points: Float32Array, scatterRadius: number) {
  const n = points.length / 3;
  const scatter = new Float32Array(n * 3), rand = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = new THREE.Vector3().randomDirection().multiplyScalar(scatterRadius * (0.6 + Math.random()));
    scatter[i * 3] = d.x; scatter[i * 3 + 1] = d.y; scatter[i * 3 + 2] = d.z - scatterRadius; rand[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(points, 3));
  geo.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uForm: { value: 0 }, uPixel: { value: 1 }, uSize: { value: 1.6 }, uGlow: { value: 1 },
      uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() } },
  });
  return new THREE.Points(geo, mat);
}

/** Hand + forearm in local space: wrist at origin, fingers toward +y, palm facing +z. side = -1 left, 1 right. */
export function handPoints(n: number, side: number): Float32Array {
  const out = new Float32Array(n * 3);
  const fingers = [ // [baseX, length, angle]
    [-0.13, 0.26, 0.12], [-0.045, 0.32, 0.03], [0.045, 0.34, 0], [0.13, 0.3, -0.06],
  ];
  for (let i = 0; i < n; i++) {
    const r = Math.random(); let x = 0, y = 0, z = 0;
    if (r < 0.3) { // palm: contour rings
      const ring = Math.floor(Math.random() * 10) / 10 + 0.08; const a = Math.random() * Math.PI * 2;
      x = Math.cos(a) * 0.17 * ring; y = 0.17 + Math.sin(a) * 0.17 * ring; z = 0.02 * Math.cos(a * 2);
    } else if (r < 0.75) {
      const f = fingers[Math.floor(Math.random() * 4)]!; const t = Math.random(); const a = Math.random() * Math.PI * 2;
      const bend = t * t * 0.08;
      x = f[0]! + Math.sin(f[2]!) * t * f[1]! + Math.cos(a) * 0.028; y = 0.32 + Math.cos(f[2]!) * t * f[1]!; z = Math.sin(a) * 0.025 + bend;
    } else if (r < 0.85) { // thumb
      const t = Math.random(); const a = Math.random() * Math.PI * 2;
      x = -0.17 - t * 0.14 + Math.cos(a) * 0.03; y = 0.1 + t * 0.17; z = 0.05 + t * 0.06 + Math.sin(a) * 0.03;
    } else { // forearm
      const t = Math.random(); const a = Math.random() * Math.PI * 2; const rr = 0.09 + t * 0.04;
      x = Math.cos(a) * rr; y = -t * 0.9; z = Math.sin(a) * rr * 0.8;
    }
    out[i * 3] = x * side; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}

/** A document card: outline, folded corner, lines of "text". */
export function filePoints(n: number): Float32Array {
  const out = new Float32Array(n * 3); const W = 0.8, H = 1.05;
  for (let i = 0; i < n; i++) {
    const r = Math.random(); let x = 0, y = 0;
    if (r < 0.35) { // outline
      const t = Math.random() * 4; const s = t % 1;
      if (t < 1) { x = -W / 2 + s * W; y = -H / 2; } else if (t < 2) { x = W / 2; y = -H / 2 + s * (H - 0.18); }
      else if (t < 3) { x = -W / 2; y = -H / 2 + s * H; } else { x = -W / 2 + s * (W - 0.18); y = H / 2; }
      if (t >= 1 && t < 2 && s > 0.99) { x = W / 2; }
    } else if (r < 0.42) { const s = Math.random(); x = W / 2 - 0.18 + s * 0.18; y = H / 2 - s * 0.18; } // fold
    else { // text lines
      const line = Math.floor(Math.random() * 9); const len = line === 0 ? 0.4 : 0.55 + ((line * 37) % 10) / 40;
      x = -W / 2 + 0.1 + Math.random() * len; y = H / 2 - 0.22 - line * 0.09;
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
  }
  return out;
}
