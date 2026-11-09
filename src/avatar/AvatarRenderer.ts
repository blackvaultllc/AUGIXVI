import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { AvatarBridge } from "./AvatarBridge";
import { proceduralBust, type ParticleSource } from "./particleSource";
import { spring, targetParams, type Params } from "./stateParams";
import { filePoints, handPoints, makeProp } from "./props";
import { THEMES, type ThemeName } from "./themes";

export type RenderSettings = { maxParticles: number; bloom: number; glitch: number; theme: ThemeName };

const vert = /* glsl */ `
attribute float aKind; attribute float aRand;
uniform float uTime, uBreath, uTight, uSpeech, uFlare, uSweep, uContour, uDrift, uPixel, uAttractK;
uniform vec3 uAttract; uniform vec2 uLook;
varying float vKind; varying float vRand; varying float vLine; varying float vFace; varying float vVein;
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
void main(){
  vec3 p = position; float kind = floor(aKind); vVein = fract(aKind) * step(0.5, aKind) * step(aKind, 1.99);
  vKind = kind; vRand = aRand;
  float headW = smoothstep(0.1, 0.45, p.y) * step(kind, 0.5) + step(1.5, kind) * step(0.3, p.y);
  if (kind < 0.5 || kind > 1.5) {
    p.x *= 1.0 + 0.012 * sin(uTime * 1.2) * uBreath * (1.0 - headW);
    p.y += 0.02 * sin(uTime * 1.2) * uBreath;
    vec3 pivot = vec3(0., 0.15, 0.);
    p = mix(p, rotY(uLook.x) * rotX(-uLook.y) * (p - pivot) + pivot, headW);
    // contour rotation shimmer
    vLine = fract(position.y * 42.0 - uTime * uContour);
    // mouth ripple
    vFace = smoothstep(0.35, 0.0, length(vec2(p.x, (p.y - 0.62) * 1.6))) * step(0.1, p.z);
    p.z += vFace * uSpeech * 0.08 * sin(length(p.xy - vec2(0., 0.62)) * 60.0 - uTime * 18.0);
    p += normalize(p - vec3(0., p.y, 0.) + 1e-4) * (aRand - 0.5) * 0.012 * (1.0 - uTight);
  } else {
    float side = sign(p.x);
    float ax = abs(p.x);
    p.y += (uFlare * 0.6 + uSweep * 0.5) * (ax - 0.9) * 0.25;
    p.x = side * (0.9 + (ax - 0.9) * (1.0 + uFlare * 0.15));
    p.y += sin(uTime * 0.6 + ax * 1.5) * 0.03;
    vLine = 0.0; vFace = 0.0;
  }
  // drift
  p += vec3(sin(uTime*0.5+aRand*40.), cos(uTime*0.4+aRand*30.), sin(uTime*0.3+aRand*20.)) * 0.012 * uDrift;
  // attractor
  vec3 d = uAttract - p; float dl = length(d);
  p += d / (dl + 0.0001) * uAttractK * 0.25 * exp(-dl * 1.4);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float sz = kind > 1.5 ? 5.0 : (kind > 0.5 ? 1.4 + vVein * 2.0 : 1.6);
  gl_PointSize = sz * uPixel * (4.0 / -mv.z) * (0.7 + aRand * 0.6);
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
uniform float uTime, uCore, uWhite, uSpeech;
uniform vec3 uColA, uColB, uColCore, uColVein;
varying float vKind; varying float vRand; varying float vLine; varying float vFace; varying float vVein;
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.0, r);
  vec3 col;
  if (vKind > 1.5) {
    col = mix(uColCore, vec3(1.0, 0.95, 0.85), uWhite * 0.8) * uCore * (0.8 + 0.4 * sin(uTime * 3.0 + vRand * 6.28));
    a *= 0.35;
  } else if (vKind > 0.5) {
    float travel = pow(0.5 + 0.5 * sin(uTime * 2.0 - vRand * 3.0), 6.0);
    col = mix(uColB, uColA, vRand * 0.7) * 0.7;
    col = mix(col, uColVein * 2.0, vVein * (0.35 + travel));
    a *= 0.6 + vVein;
  } else {
    float line = smoothstep(0.0, 0.5, vLine) * smoothstep(1.0, 0.5, vLine);
    col = mix(uColB, uColA, 0.4 + 0.6 * line) * (0.7 + line * 0.6);
    col = mix(col, uColCore * 1.6, vFace * (0.35 + uSpeech));
    col = mix(col, vec3(1.0), uWhite * 0.25);
  }
  gl_FragColor = vec4(col * a, a);
}`;

const postShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGlitch: { value: 0 }, uAberr: { value: 0.0015 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: /* glsl */ `
  uniform sampler2D tDiffuse; uniform float uTime, uGlitch, uAberr; uniform vec2 uRes; varying vec2 vUv;
  float h(float n){ return fract(sin(n) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    float band = floor(uv.y * 24.0 + floor(uTime * 12.0));
    float g = step(1.0 - uGlitch * 0.35, h(band + floor(uTime * 20.0)));
    uv.x += g * (h(band) - 0.5) * 0.08 * uGlitch;
    float ab = uAberr + uGlitch * 0.008;
    vec3 col = vec3(texture2D(tDiffuse, uv + vec2(ab, 0.)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ab, 0.)).b);
    col *= 0.9 + 0.1 * sin(vUv.y * uRes.y * 1.6);
    col *= smoothstep(1.2, 0.35, length(vUv - 0.5));
    gl_FragColor = vec4(col, 1.0);
  }`,
};

type V<T> = { value: T };
type Uniforms = Record<"uTime"|"uBreath"|"uTight"|"uSpeech"|"uFlare"|"uSweep"|"uContour"|"uDrift"|"uPixel"|"uAttractK"|"uCore"|"uWhite", V<number>> &
  { uAttract: V<THREE.Vector3>; uLook: V<THREE.Vector2>; uColA: V<THREE.Color>; uColB: V<THREE.Color>; uColCore: V<THREE.Color>; uColVein: V<THREE.Color> };
type PostU = { uTime: V<number>; uGlitch: V<number>; uRes: V<THREE.Vector2> };
const rgb = (c: THREE.Color, v: readonly number[]) => c.setRGB(v[0]!, v[1]!, v[2]!);

export type Inputs = { attract: THREE.Vector3; attractK: number; look: THREE.Vector2; sweep: number };

export class AvatarRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private post: ShaderPass;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private raf = 0;
  private clock = new THREE.Clock();
  private p: Params = targetParams("IDLE", 0);
  private v: Record<string, number> = {};
  private look = new THREE.Vector2(); private lookV = new THREE.Vector2();
  private attract = new THREE.Vector3(0, 0.5, 2); private attractK = 0; private sweep = 0;
  private drawCount: number; private frameTimes: number[] = [];
  private firstFrame = false; private glitchBurst = 0; private ro: ResizeObserver;
  private hands: THREE.Points[] = []; private file!: THREE.Points;
  private handForm = 0; private fileForm = 0; private pose = 0; private poseV = 0;
  onFrame?: (info: { fps: number; particles: number }) => void;
  inputs: Inputs = { attract: new THREE.Vector3(0, 0.5, 2), attractK: 0, look: new THREE.Vector2(), sweep: 0 };

  constructor(private host: HTMLElement, private bridge: AvatarBridge, public settings: RenderSettings, source: ParticleSource = proceduralBust) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x02040a, 1);
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 0.2, 7.2);
    const data = source(settings.maxParticles);
    this.drawCount = data.count;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    this.geo.setAttribute("aKind", new THREE.BufferAttribute(data.kind, 1));
    this.geo.setAttribute("aRand", new THREE.BufferAttribute(data.rand, 1));
    const u = (v: unknown) => ({ value: v });
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: u(0), uBreath: u(1), uTight: u(0), uSpeech: u(0), uFlare: u(0), uSweep: u(0), uContour: u(0.25), uDrift: u(1),
        uPixel: u(this.renderer.getPixelRatio()), uAttract: u(new THREE.Vector3()), uAttractK: u(0), uLook: u(new THREE.Vector2()),
        uCore: u(1), uWhite: u(0), uColA: u(new THREE.Color()), uColB: u(new THREE.Color()), uColCore: u(new THREE.Color()), uColVein: u(new THREE.Color()),
      },
    });
    this.applyTheme();
    this.scene.add(new THREE.Points(this.geo, this.mat));
    for (const side of [-1, 1]) { const h = makeProp(handPoints(7000, side), 2.5); this.hands.push(h); this.scene.add(h); }
    this.file = makeProp(filePoints(6000), 3); this.scene.add(this.file);
    this.applyPropTheme();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), settings.bloom, 0.6, 0.05);
    this.composer.addPass(this.bloom);
    this.post = new ShaderPass(postShader);
    this.composer.addPass(this.post);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    document.addEventListener("visibilitychange", this.onVis);
    this.start();
  }
  private onVis = () => { if (document.hidden) cancelAnimationFrame(this.raf); else { this.clock.getDelta(); this.start(); } };
  private start() { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(this.tick); }
  applyTheme() {
    const t = THEMES[this.settings.theme]; const U = this.mat.uniforms as unknown as Uniforms;
    rgb(U.uColA.value, t.a); rgb(U.uColB.value, t.b);
    rgb(U.uColCore.value, t.core); rgb(U.uColVein.value, t.vein);
  }
  private applyPropTheme() {
    const t = THEMES[this.settings.theme];
    for (const h of this.hands) { const U = h.material as THREE.ShaderMaterial; rgb(U.uniforms["uColA"]!.value, t.a); rgb(U.uniforms["uColB"]!.value, t.b); U.uniforms["uPixel"]!.value = this.renderer.getPixelRatio(); }
    const F = this.file.material as THREE.ShaderMaterial; rgb(F.uniforms["uColA"]!.value, t.vein); rgb(F.uniforms["uColB"]!.value, t.core);
    F.uniforms["uPixel"]!.value = this.renderer.getPixelRatio(); F.uniforms["uSize"]!.value = 1.8;
  }
  /** Hand pose: 0 = rest (low, near shoulders), 1 = presenting (forward, holding the item). */
  private updateProps(dt: number, t: number) {
    const presenting = this.bridge.presenting !== null;
    const active = presenting || this.bridge.state !== "IDLE";
    [this.pose, this.poseV] = spring(this.pose, this.poseV, presenting ? 1 : 0, 10, dt);
    this.handForm += ((active ? 1 : 0.35) - this.handForm) * (1 - Math.exp(-2.5 * dt));
    this.fileForm += ((presenting && this.pose > 0.6 ? 1 : 0) - this.fileForm) * (1 - Math.exp(-(presenting ? 1.6 : 4) * dt));
    const sp = this.bridge.state === "SPEAKING" ? this.bridge.speechLevel : 0;
    const p = this.pose;
    this.hands.forEach((h, i) => {
      const side = i === 0 ? -1 : 1;
      const restX = side * 1.25, restY = -1.25 + sp * 0.12 * Math.sin(t * 4 + i), restZ = 0.6;
      const preX = side * 0.62, preY = -0.55 + Math.sin(t * 1.4) * 0.03, preZ = 1.9;
      h.position.set(THREE.MathUtils.lerp(restX, preX, p), THREE.MathUtils.lerp(restY, preY, p), THREE.MathUtils.lerp(restZ, preZ, p));
      h.rotation.set(THREE.MathUtils.lerp(-0.2, 0.9, p), side * THREE.MathUtils.lerp(0.1, -0.5, p), side * THREE.MathUtils.lerp(-0.25, -0.4, p) + sp * 0.1 * side);
      const M = (h.material as THREE.ShaderMaterial).uniforms; M["uTime"]!.value = t; M["uForm"]!.value = this.handForm; M["uGlow"]!.value = 0.8 + p * 0.5;
    });
    this.file.position.set(0, -0.05 + Math.sin(t * 1.2) * 0.04, THREE.MathUtils.lerp(0.5, 2.15, this.fileForm));
    this.file.rotation.set(-0.15, Math.sin(t * 0.6) * 0.12, 0);
    this.file.visible = this.fileForm > 0.01;
    const F = (this.file.material as THREE.ShaderMaterial).uniforms; F["uTime"]!.value = t; F["uForm"]!.value = this.fileForm; F["uGlow"]!.value = 1.3;
  }
  updateSettings(s: Partial<RenderSettings>) {
    Object.assign(this.settings, s);
    if (s.bloom !== undefined) this.bloom.strength = s.bloom;
    if (s.theme) { this.applyTheme(); this.applyPropTheme(); }
    if (s.maxParticles) this.drawCount = Math.min(this.drawCount, s.maxParticles, this.geo.getAttribute("position").count);
  }
  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h); this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.position.z = w / h < 1 ? 7.2 / (w / h) * 0.75 : 7.2; this.camera.updateProjectionMatrix();
    (this.post.uniforms as unknown as PostU).uRes.value.set(w, h);
  }
  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05); const t = this.clock.elapsedTime;
    this.bridge.sampleAudio();
    const target = targetParams(this.bridge.state, this.bridge.speechLevel);
    for (const k of Object.keys(target) as (keyof Params)[]) {
      const [x, v] = spring(this.p[k], this.v[k] ?? 0, target[k], k === "flare" || k === "core" ? 120 : 18, dt);
      this.p[k] = x; this.v[k] = v;
    }
    // look/attract springs
    const tl = this.inputs.look; const kL = 25;
    for (const ax of ["x", "y"] as const) { const [x, v] = spring(this.look[ax], this.lookV[ax], tl[ax], kL, dt); this.look[ax] = x; this.lookV[ax] = v; }
    this.attract.lerp(this.inputs.attract, 1 - Math.exp(-6 * dt));
    this.attractK += (this.inputs.attractK - this.attractK) * (1 - Math.exp(-4 * dt));
    this.sweep += (this.inputs.sweep - this.sweep) * (1 - Math.exp(-3 * dt));
    if (Math.random() < this.settings.glitch * dt * 0.4) this.glitchBurst = 0.25;
    this.glitchBurst = Math.max(0, this.glitchBurst - dt);
    const U = this.mat.uniforms as unknown as Uniforms; const PU = this.post.uniforms as unknown as PostU;
    U.uTime.value = t; U.uBreath.value = this.p.breath; U.uTight.value = this.p.tight; U.uCore.value = this.p.core;
    U.uWhite.value = this.p.white; U.uContour.value = this.p.contour; U.uFlare.value = this.p.flare; U.uDrift.value = this.p.drift;
    U.uSpeech.value = this.bridge.state === "SPEAKING" ? this.bridge.speechLevel : 0;
    U.uSweep.value = this.sweep; (U.uAttract.value as THREE.Vector3).copy(this.attract); U.uAttractK.value = this.attractK;
    (U.uLook.value as THREE.Vector2).copy(this.look);
    PU.uTime.value = t;
    PU.uGlitch.value = Math.min(1, this.p.glitch + (this.glitchBurst > 0 ? this.settings.glitch : 0));
    this.updateProps(dt, t);
    this.adapt(dt);
    this.geo.setDrawRange(0, this.drawCount);
    this.composer.render(dt);
    if (!this.firstFrame) { this.firstFrame = true; this.onFrame?.({ fps: 0, particles: this.drawCount }); }
  };
  private adapt(dt: number) {
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length < 60) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length; this.frameTimes = [];
    const max = Math.min(this.settings.maxParticles, this.geo.getAttribute("position").count);
    if (avg > 20) this.drawCount = Math.max(15000, Math.floor(this.drawCount * 0.85));
    else if (avg < 15) this.drawCount = Math.min(max, Math.floor(this.drawCount * 1.08));
    this.onFrame?.({ fps: Math.round(1000 / avg), particles: this.drawCount });
  }
  dispose() {
    cancelAnimationFrame(this.raf); this.ro.disconnect(); document.removeEventListener("visibilitychange", this.onVis);
    this.geo.dispose(); this.mat.dispose();
    for (const o of [...this.hands, this.file]) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } this.bloom.dispose(); this.composer.dispose(); this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
