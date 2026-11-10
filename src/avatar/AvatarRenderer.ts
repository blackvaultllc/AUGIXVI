import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { AvatarBridge } from "./AvatarBridge";
import { proceduralBust, type ParticleSource } from "./particleSource";
import { spring, targetParams, type Params } from "./stateParams";
import { filePoints, handPoints, limbPoints, makeProp } from "./props";
import { getLegGaitAngle } from "./particleLegs";
import { ARM, armPose, flightArmPose, handDirection, solveArm, type V3 } from "./armIK";
import { getThemePalette, type ThemeChoice } from "./themes";
import { SceneManager } from "./sceneManager";
import type { MaterialKind } from "./worldCommands";
import { AvatarLocomotion, type LocomotionMode } from "./locomotion";

export type RenderSettings = {
  maxParticles: number;
  bloom: number;
  glitch: number;
  theme: ThemeChoice;
  customColor: string;
};

const vert = /* glsl */ `
attribute float aKind; attribute float aRand;
uniform float uTime, uBreath, uTight, uSpeech, uFlare, uSweep, uContour, uDrift, uPixel, uAttractK;
uniform vec3 uAttract; uniform vec2 uLook, uLegSwing;
varying float vKind; varying float vRand; varying float vLine; varying float vFace; varying float vVein;
attribute float aLegSide;
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
void main(){
  vec3 p = position; float kind = floor(aKind); vVein = fract(aKind) * step(0.5, aKind) * step(aKind, 1.99);
  vKind = kind; vRand = aRand;
  float headW = smoothstep(0.1, 0.45, p.y) * step(kind, 0.5) + step(1.5, kind) * step(0.3, p.y);
  if (kind < 0.5 || kind > 1.5) {
    p.x *= 1.0 + 0.012 * sin(uTime * 1.2) * uBreath * (1.0 - headW);
    p.y += 0.02 * sin(uTime * 1.2) * uBreath;
    vec3 pivot = vec3(0., 1.0, 0.);
    p = mix(p, rotY(uLook.x) * rotX(-uLook.y) * (p - pivot) + pivot, headW);
    // contour rotation shimmer
    vLine = fract(position.y * 42.0 - uTime * uContour);
    // mouth ripple
    vFace = smoothstep(0.35, 0.0, length(vec2(p.x, (p.y - 0.8) * 1.6))) * step(0.1, p.z);
    p.z += vFace * uSpeech * 0.08 * sin(length(p.xy - vec2(0., 0.8)) * 60.0 - uTime * 18.0);
    p += normalize(p - vec3(0., p.y, 0.) + 1e-4) * (aRand - 0.5) * 0.012 * (1.0 - uTight);
  } else {
    float side = sign(p.x);
    float ax = abs(p.x);
    p.y += (uFlare * 0.6 + uSweep * 0.5) * (ax - 0.9) * 0.25;
    p.x = side * (0.9 + (ax - 0.9) * (1.0 + uFlare * 0.15));
    p.y += sin(uTime * 0.6 + ax * 1.5) * 0.03;
    vLine = 0.0; vFace = 0.0;
  }
  if (abs(aLegSide) > 0.5) {
    float angle = aLegSide < 0.0 ? uLegSwing.x : uLegSwing.y;
    vec3 hip = vec3(aLegSide * 0.28, -1.48, 0.0);
    vec3 offset = p - hip;
    p.y = hip.y + cos(angle) * offset.y - sin(angle) * offset.z;
    p.z = hip.z + sin(angle) * offset.y + cos(angle) * offset.z;
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
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGlitch: { value: 0 },
    uAberr: { value: 0.0015 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
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
type Uniforms = Record<
  | "uTime"
  | "uBreath"
  | "uTight"
  | "uSpeech"
  | "uFlare"
  | "uSweep"
  | "uContour"
  | "uDrift"
  | "uPixel"
  | "uAttractK"
  | "uCore"
  | "uWhite",
  V<number>
> & {
  uAttract: V<THREE.Vector3>;
  uLook: V<THREE.Vector2>;
  uLegSwing: V<THREE.Vector2>;
  uColA: V<THREE.Color>;
  uColB: V<THREE.Color>;
  uColCore: V<THREE.Color>;
  uColVein: V<THREE.Color>;
};
type PostU = { uTime: V<number>; uGlitch: V<number>; uRes: V<THREE.Vector2> };
const rgb = (c: THREE.Color, v: readonly number[]) => c.setRGB(v[0]!, v[1]!, v[2]!);

export type Inputs = {
  attract: THREE.Vector3;
  attractK: number;
  look: THREE.Vector2;
  sweep: number;
};

export class AvatarRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private avatarRoot = new THREE.Group();
  private character = new THREE.Group();
  private sceneManager: SceneManager;
  private locomotion: AvatarLocomotion;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private post: ShaderPass;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private raf = 0;
  private clock = new THREE.Clock();
  private p: Params = targetParams("IDLE", 0);
  private v: Record<string, number> = {};
  private look = new THREE.Vector2();
  private lookV = new THREE.Vector2();
  private attract = new THREE.Vector3(0, 0.5, 2);
  private attractK = 0;
  private sweep = 0;
  private drawCount: number;
  private frameTimes: number[] = [];
  private firstFrame = false;
  private glitchBurst = 0;
  private ro: ResizeObserver;
  private hands: THREE.Points[] = [];
  private arms: THREE.Points[] = [];
  private forearms: THREE.Points[] = [];
  private file!: THREE.Points;
  private cape!: THREE.Points;
  private capeBasePositions = new Float32Array();
  private handForm = 0;
  private fileForm = 0;
  private pose = 0;
  private poseV = 0;
  onFrame?: (info: { fps: number; particles: number }) => void;
  inputs: Inputs = {
    attract: new THREE.Vector3(0, 0.5, 2),
    attractK: 0,
    look: new THREE.Vector2(),
    sweep: 0,
  };

  constructor(
    private host: HTMLElement,
    private bridge: AvatarBridge,
    public settings: RenderSettings,
    source: ParticleSource = proceduralBust,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x02040a, 1);
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(0, -0.75, 11);
    this.camera.lookAt(0, -0.8, 0);
    this.scene.add(this.avatarRoot);
    this.avatarRoot.add(this.character);
    this.locomotion = new AvatarLocomotion(this.avatarRoot);
    this.sceneManager = new SceneManager(this.scene);
    const data = source(settings.maxParticles);
    this.drawCount = data.count;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    this.geo.setAttribute("aKind", new THREE.BufferAttribute(data.kind, 1));
    this.geo.setAttribute("aRand", new THREE.BufferAttribute(data.rand, 1));
    this.geo.setAttribute("aLegSide", new THREE.BufferAttribute(data.legSide, 1));
    const u = (v: unknown) => ({ value: v });
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: u(0),
        uBreath: u(1),
        uTight: u(0),
        uSpeech: u(0),
        uFlare: u(0),
        uSweep: u(0),
        uContour: u(0.25),
        uDrift: u(1),
        uPixel: u(this.renderer.getPixelRatio()),
        uAttract: u(new THREE.Vector3()),
        uAttractK: u(0),
        uLook: u(new THREE.Vector2()),
        uLegSwing: u(new THREE.Vector2()),
        uCore: u(1),
        uWhite: u(0),
        uColA: u(new THREE.Color()),
        uColB: u(new THREE.Color()),
        uColCore: u(new THREE.Color()),
        uColVein: u(new THREE.Color()),
      },
    });
    this.cape = this.createCape();
    this.applyTheme();
    this.character.add(new THREE.Points(this.geo, this.mat));
    this.character.add(this.cape);
    for (const side of [-1, 1] as const) {
      const h = makeProp(handPoints(7000, side), 2.5);
      h.scale.setScalar(1.25);
      this.hands.push(h);
      this.character.add(h);
    }
    for (let i = 0; i < 2; i++) {
      const upper = makeProp(limbPoints(4500, 0.15, 0.12), 2.5);
      const forearm = makeProp(limbPoints(3500, 0.12, 0.075), 2.5);
      this.arms.push(upper);
      this.forearms.push(forearm);
      this.character.add(upper, forearm);
    }
    this.file = makeProp(filePoints(6000), 3);
    this.character.add(this.file);
    this.applyPropTheme();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), settings.bloom, 0.6, 0.05);
    this.composer.addPass(this.bloom);
    this.post = new ShaderPass(postShader);
    this.composer.addPass(this.post);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    document.addEventListener("visibilitychange", this.onVis);
    this.start();
  }
  private onVis = () => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else {
      this.clock.getDelta();
      this.start();
    }
  };
  private start() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
  }
  applyTheme() {
    const t = getThemePalette(this.settings.theme, this.settings.customColor);
    const U = this.mat.uniforms as unknown as Uniforms;
    rgb(U.uColA.value, t.a);
    rgb(U.uColB.value, t.b);
    rgb(U.uColCore.value, t.core);
    rgb(U.uColVein.value, t.vein);
    (this.cape.material as THREE.PointsMaterial).color.setRGB(t.a[0]!, t.a[1]!, t.a[2]!);
  }
  private createCape() {
    const rows = 30;
    const columns = 49;
    const count = rows * columns;
    this.capeBasePositions = new Float32Array(count * 3);
    let index = 0;
    for (let row = 0; row < rows; row += 1) {
      const progress = row / (rows - 1);
      const width = 0.18 + progress * 0.75;
      for (let column = 0; column < columns; column += 1) {
        const across = (column / (columns - 1)) * 2 - 1;
        this.capeBasePositions[index++] = across * width;
        this.capeBasePositions[index++] = 0.32 - progress * 2.45;
        this.capeBasePositions[index++] = -0.38 - Math.abs(across) * 0.06;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.capeBasePositions.slice(), 3));
    const palette = getThemePalette(this.settings.theme, this.settings.customColor);
    const cape = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: new THREE.Color(palette.a[0]!, palette.a[1]!, palette.a[2]!),
        size: 0.035,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    cape.visible = false;
    return cape;
  }
  private applyPropTheme() {
    const t = getThemePalette(this.settings.theme, this.settings.customColor);
    for (const h of [...this.hands, ...this.arms, ...this.forearms]) {
      const U = h.material as THREE.ShaderMaterial;
      rgb(U.uniforms["uColA"]!.value, t.a);
      rgb(U.uniforms["uColB"]!.value, t.b);
      U.uniforms["uPixel"]!.value = this.renderer.getPixelRatio();
    }
    const F = this.file.material as THREE.ShaderMaterial;
    rgb(F.uniforms["uColA"]!.value, t.vein);
    rgb(F.uniforms["uColB"]!.value, t.core);
    F.uniforms["uPixel"]!.value = this.renderer.getPixelRatio();
    F.uniforms["uSize"]!.value = 1.8;
  }
  /** Place fixed-length upper-arm and forearm tubes between the solved joints. */
  private updateProps(dt: number, t: number) {
    const presenting = this.bridge.presenting !== null;
    const active = presenting || this.bridge.state !== "IDLE";
    [this.pose, this.poseV] = spring(this.pose, this.poseV, presenting ? 1 : 0, 10, dt);
    this.handForm += ((active ? 1 : 0.35) - this.handForm) * (1 - Math.exp(-2.5 * dt));
    this.fileForm +=
      ((presenting && this.pose > 0.6 ? 1 : 0) - this.fileForm) *
      (1 - Math.exp(-(presenting ? 1.6 : 4) * dt));
    const sp = this.bridge.state === "SPEAKING" ? this.bridge.speechLevel : 0;
    const p = this.pose;
    this.hands.forEach((h, i) => {
      const side = i === 0 ? -1 : 1;
      const pose =
        this.locomotion.currentMode === "fly"
          ? flightArmPose(side, t, sp, i)
          : armPose(side, p, t, sp, i);
      const shoulder = ARM.shoulder(side);
      const { elbow, wrist } = solveArm(shoulder, pose.target, pose.pole);
      const vector = (point: V3) => new THREE.Vector3(...point);
      const placeLimb = (limb: THREE.Points, from: V3, to: V3) => {
        const direction = vector(to).sub(vector(from));
        limb.position.set(...from);
        limb.scale.set(1, direction.length(), 1);
        limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        const uniforms = (limb.material as THREE.ShaderMaterial).uniforms;
        uniforms["uTime"]!.value = t;
        uniforms["uForm"]!.value = this.handForm;
        uniforms["uGlow"]!.value = 1.4 + p * 0.6;
        uniforms["uSize"]!.value = 2.4;
      };
      placeLimb(this.arms[i]!, shoulder, elbow);
      placeLimb(this.forearms[i]!, elbow, wrist);

      const y = vector(handDirection(elbow, wrist, side, pose.curl));
      const palm = vector(pose.palm);
      const z = palm.sub(y.clone().multiplyScalar(palm.dot(y))).normalize();
      const x = y.clone().cross(z);
      h.position.set(...wrist);
      h.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      const uniforms = (h.material as THREE.ShaderMaterial).uniforms;
      uniforms["uTime"]!.value = t;
      uniforms["uForm"]!.value = this.handForm;
      uniforms["uGlow"]!.value = 0.8 + p * 0.5;
    });
    this.file.position.set(
      0,
      -0.05 + Math.sin(t * 1.2) * 0.04,
      THREE.MathUtils.lerp(0.5, 1.5, this.fileForm),
    );
    this.file.rotation.set(-0.15, Math.sin(t * 0.6) * 0.12, 0);
    this.file.visible = this.fileForm > 0.01;
    const F = (this.file.material as THREE.ShaderMaterial).uniforms;
    F["uTime"]!.value = t;
    F["uForm"]!.value = this.fileForm;
    F["uGlow"]!.value = 1.3;
  }
  updateSettings(s: Partial<RenderSettings>) {
    Object.assign(this.settings, s);
    if (s.bloom !== undefined) this.bloom.strength = s.bloom;
    if (s.theme || s.customColor) {
      this.applyTheme();
      this.applyPropTheme();
    }
    if (s.maxParticles)
      this.drawCount = Math.min(
        this.drawCount,
        s.maxParticles,
        this.geo.getAttribute("position").count,
      );
  }
  private resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.position.z = w / h < 1 ? (11 / (w / h)) * 0.75 : 11;
    this.camera.lookAt(0, -0.8, 0);
    this.camera.updateProjectionMatrix();
    (this.post.uniforms as unknown as PostU).uRes.value.set(w, h);
  }
  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    this.moveAvatar(dt, t);
    this.sceneManager.tick(dt);
    this.bridge.sampleAudio();
    const target = targetParams(this.bridge.state, this.bridge.speechLevel);
    for (const k of Object.keys(target) as (keyof Params)[]) {
      const [x, v] = spring(
        this.p[k],
        this.v[k] ?? 0,
        target[k],
        k === "flare" || k === "core" ? 120 : 18,
        dt,
      );
      this.p[k] = x;
      this.v[k] = v;
    }
    // look/attract springs
    const tl = this.inputs.look;
    const kL = 25;
    for (const ax of ["x", "y"] as const) {
      const [x, v] = spring(this.look[ax], this.lookV[ax], tl[ax], kL, dt);
      this.look[ax] = x;
      this.lookV[ax] = v;
    }
    this.attract.lerp(this.inputs.attract, 1 - Math.exp(-6 * dt));
    this.attractK += (this.inputs.attractK - this.attractK) * (1 - Math.exp(-4 * dt));
    this.sweep += (this.inputs.sweep - this.sweep) * (1 - Math.exp(-3 * dt));
    if (Math.random() < this.settings.glitch * dt * 0.4) this.glitchBurst = 0.25;
    this.glitchBurst = Math.max(0, this.glitchBurst - dt);
    const U = this.mat.uniforms as unknown as Uniforms;
    const PU = this.post.uniforms as unknown as PostU;
    U.uTime.value = t;
    U.uBreath.value = this.p.breath;
    U.uTight.value = this.p.tight;
    U.uCore.value = this.p.core;
    U.uWhite.value = this.p.white;
    U.uContour.value = this.p.contour;
    U.uFlare.value = this.p.flare;
    U.uDrift.value = this.p.drift;
    U.uSpeech.value = this.bridge.state === "SPEAKING" ? this.bridge.speechLevel : 0;
    U.uSweep.value = this.sweep;
    (U.uAttract.value as THREE.Vector3).copy(this.attract);
    U.uAttractK.value = this.attractK;
    (U.uLook.value as THREE.Vector2).copy(this.look);
    if (this.locomotion.isWalking || this.locomotion.isLookingAround) {
      U.uLook.value.x += Math.sin(t * 0.9) * 0.16;
      U.uLook.value.y += Math.sin(t * 0.55) * 0.06;
    }
    PU.uTime.value = t;
    PU.uGlitch.value = Math.min(
      1,
      this.p.glitch + (this.glitchBurst > 0 ? this.settings.glitch : 0),
    );
    this.updateProps(dt, t);
    this.adapt(dt);
    this.geo.setDrawRange(0, this.drawCount);
    this.composer.render(dt);
    if (!this.firstFrame) {
      this.firstFrame = true;
      this.onFrame?.({ fps: 0, particles: this.drawCount });
    }
  };
  private moveAvatar(dt: number, t: number) {
    this.locomotion.tick(dt);
    const speaking = this.bridge.state === "SPEAKING" ? this.bridge.speechLevel : 0;
    const flying = this.locomotion.currentMode === "fly";
    this.character.rotation.x += (0 - this.character.rotation.x) * (1 - Math.exp(-5 * dt));
    const flightRoll = flying ? -Math.PI / 2 : 0;
    this.character.rotation.z =
      flightRoll + Math.sin(t * 1.2) * 0.012 + Math.sin(t * 3.2) * speaking * 0.025;
    this.character.position.x = Math.sin(t * 1.4) * 0.018 + Math.sin(t * 2.7) * speaking * 0.045;
    this.cape.visible = flying;
    const capePositions = this.cape.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < this.capeBasePositions.length; i += 3) {
      const x = this.capeBasePositions[i]!;
      const y = this.capeBasePositions[i + 1]!;
      capePositions.array[i] = x + Math.sin(t * 2.3 + y * 3.2 + x * 2.4) * 0.06;
      capePositions.array[i + 1] = y;
      capePositions.array[i + 2] =
        this.capeBasePositions[i + 2]! + Math.sin(t * 2.8 + y * 2.1 + x) * 0.08;
    }
    capePositions.needsUpdate = true;
    const uniforms = this.mat.uniforms as unknown as Uniforms;
    uniforms.uLegSwing.value.set(
      getLegGaitAngle(this.locomotion.isWalking, t, 0, speaking),
      getLegGaitAngle(this.locomotion.isWalking, t, 1, speaking),
    );
  }
  shrink() {
    this.locomotion.shrink();
  }
  grow() {
    this.locomotion.grow();
  }
  walk() {
    this.locomotion.walk();
  }
  run() {
    this.locomotion.run();
  }
  fly() {
    this.locomotion.fly();
  }
  jump() {
    this.locomotion.jump();
  }
  idle() {
    this.locomotion.idle();
  }
  setLocomotionMode(mode: LocomotionMode) {
    this.locomotion.setMode(mode);
  }
  setMovementSpeed(speed: number) {
    return this.locomotion.setSpeed(speed);
  }
  walkThroughObject(target: MaterialKind) {
    const path = this.sceneManager.getWalkThroughPath(target);
    return path ? this.locomotion.followPath(path) : false;
  }
  lookAround() {
    this.locomotion.lookAround();
  }
  comeBack() {
    this.locomotion.comeBack();
  }
  stopWalking() {
    this.locomotion.stop();
  }
  makeObject(kind: MaterialKind) {
    return this.sceneManager.add(kind);
  }
  moveObject(
    target: MaterialKind,
    direction: "left" | "right" | "forward" | "back" | "up" | "down",
  ) {
    return this.sceneManager.move(target, direction);
  }
  reshapeObject(target: MaterialKind, kind: MaterialKind) {
    return this.sceneManager.reshape(target, kind);
  }
  removeObject(target: MaterialKind) {
    return this.sceneManager.remove(target);
  }
  driveObject(target: MaterialKind) {
    return this.sceneManager.drive(target);
  }
  stopDriving() {
    this.sceneManager.stopDriving();
  }
  private adapt(dt: number) {
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length < 60) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    const max = Math.min(this.settings.maxParticles, this.geo.getAttribute("position").count);
    if (avg > 20) this.drawCount = Math.max(15000, Math.floor(this.drawCount * 0.85));
    else if (avg < 15) this.drawCount = Math.min(max, Math.floor(this.drawCount * 1.08));
    this.onFrame?.({ fps: Math.round(1000 / avg), particles: this.drawCount });
  }
  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
    this.geo.dispose();
    this.mat.dispose();
    this.sceneManager.dispose();
    for (const o of [...this.hands, ...this.arms, ...this.forearms, this.file, this.cape]) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
