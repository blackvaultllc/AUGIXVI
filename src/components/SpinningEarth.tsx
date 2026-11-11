import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";

/**
 * The REAL Spinning Earth from blackvaultllc/infinitycomics — three.js sphere
 * with the actual NASA-derived textures (day / night lights / clouds /
 * specular / normal), starfield, sun, moon, orbiting satellites, meteor
 * flybys with a WebAudio whoosh, and the "Earth · Realm of Mr. Infinity"
 * label. The sign-in card sits ON TOP of the Earth itself. The "Enter Live
 * Mode" CTA is retired (owner order 2026-11-11): after sign-in the flight
 * down happens automatically.
 *
 * ONE WORLD: Osiris lives in this same scene. His glowing orb orbits the
 * planet alongside the satellites, and entering the live world is one
 * continuous automatic camera flight from orbit down to the surface — the
 * particle world opens over the arriving camera. No screen jump, ever.
 */

const EARTH_TEXTURES = {
  day: "/assets/world/earth/earth_day.jpg",
  night: "/assets/world/earth/earth_lights.png",
  clouds: "/assets/world/earth/earth_clouds.png",
  specular: "/assets/world/earth/earth_specular.jpg",
  normal: "/assets/world/earth/earth_normal.jpg",
} as const;

const EARTH_RADIUS = 2.2;
/** Osiris's orbital altitude (scene units) — riding with the satellites. */
export const ORBIT_RADIUS = 3.15;
const ORBIT_CAMERA: [number, number, number] = [0, 1.4, 8.6];
const SURFACE_CAMERA: [number, number, number] = [0, EARTH_RADIUS + 0.5, 0.55];
const FLIGHT_MS = 2400;

/**
 * Cross-component flight trigger: voice commands live in AvatarStage while
 * the Canvas lives inside SpinningEarth, so fly-in/fly-out travels over a
 * tiny module-level event instead of prop drilling through the gate.
 */
type EarthFlightEvent = "fly-in" | "fly-out";
const flightListeners = new Set<(event: EarthFlightEvent) => void>();
export function dispatchEarthFlight(event: EarthFlightEvent) {
  flightListeners.forEach((listener) => listener(event));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function configureTexture(texture: THREE.Texture, color = false) {
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 8;
}

function useEarthTextures() {
  const textures = useTexture(Object.values(EARTH_TEXTURES));
  return useMemo(() => {
    const [dayMap, nightMap, cloudsMap, specularMap, normalMap] = textures as [
      THREE.Texture,
      THREE.Texture,
      THREE.Texture,
      THREE.Texture,
      THREE.Texture,
    ];
    configureTexture(dayMap, true);
    configureTexture(nightMap, true);
    configureTexture(cloudsMap, true);
    configureTexture(specularMap);
    configureTexture(normalMap);
    return { dayMap, nightMap, cloudsMap, specularMap, normalMap };
  }, [textures]);
}

function FallbackEarth() {
  const earth = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (earth.current) earth.current.rotation.y += dt * 0.038;
  });
  return (
    <group ref={earth}>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
        <meshPhysicalMaterial
          color="#174f8f"
          emissive="#08224a"
          emissiveIntensity={0.25}
          roughness={0.48}
          metalness={0.03}
          clearcoat={0.4}
          clearcoatRoughness={0.16}
        />
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
        <meshPhysicalMaterial
          color="#8bdcff"
          emissive="#4fbfff"
          emissiveIntensity={0.42}
          transparent
          opacity={0.16}
          roughness={0.28}
          metalness={0}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

class EarthTextureBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Earth() {
  const earth = useRef<THREE.Group>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const { dayMap, nightMap, cloudsMap, specularMap, normalMap } = useEarthTextures();
  useFrame((_, dt) => {
    if (earth.current) earth.current.rotation.y += dt * 0.038;
    if (clouds.current) clouds.current.rotation.y += dt * 0.052;
  });
  return (
    <group ref={earth}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
        <meshPhysicalMaterial
          map={dayMap}
          roughness={0.58}
          metalness={0.02}
          clearcoat={0.35}
          clearcoatRoughness={0.18}
          specularIntensity={1.2}
          specularColor="#9fc7ff"
          roughnessMap={specularMap}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.18, 0.18)}
          envMapIntensity={0.55}
        />
      </mesh>
      {/* Night-side city lights */}
      <mesh scale={1.002}>
        <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
        <meshStandardMaterial
          map={nightMap}
          emissiveMap={nightMap}
          emissive="#79b7ff"
          emissiveIntensity={1.35}
          transparent
          opacity={0.26}
          roughness={0.62}
          metalness={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Drifting cloud layer */}
      <mesh ref={clouds} scale={1.012}>
        <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
        <meshPhysicalMaterial
          map={cloudsMap}
          alphaMap={cloudsMap}
          transparent
          opacity={0.44}
          roughness={0.86}
          metalness={0}
          transmission={0.08}
          thickness={0.18}
          depthWrite={false}
        />
      </mesh>
      {/* Atmospheric rim glow */}
      <mesh scale={1.038}>
        <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
        <meshPhysicalMaterial
          color="#8bdcff"
          emissive="#4fbfff"
          emissiveIntensity={0.45}
          transparent
          opacity={0.16}
          roughness={0.28}
          metalness={0}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.09}>
        <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
        <meshPhysicalMaterial
          color="#2d9dff"
          emissive="#2d9dff"
          emissiveIntensity={0.38}
          transparent
          opacity={0.055}
          roughness={0.2}
          metalness={0}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

useTexture.preload(Object.values(EARTH_TEXTURES));

function Satellite({
  radius,
  speed,
  tilt,
  phase,
  size = 0.05,
}: {
  radius: number;
  speed: number;
  tilt: number;
  phase: number;
  size?: number;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime * speed + phase;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    const y = Math.sin(t) * Math.sin(tilt) * radius;
    group.current.position.set(x, y * 0.4, z);
    group.current.rotation.y = -t;
  });
  return (
    <group ref={group}>
      <mesh>
        <boxGeometry args={[size, size * 0.8, size]} />
        <meshStandardMaterial color="#d8dde6" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[size * 1.4, 0, 0]}>
        <boxGeometry args={[size * 2, size * 0.05, size * 0.9]} />
        <meshStandardMaterial
          color="#1b3a6b"
          emissive="#2864c7"
          emissiveIntensity={0.5}
          metalness={0.4}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[-size * 1.4, 0, 0]}>
        <boxGeometry args={[size * 2, size * 0.05, size * 0.9]} />
        <meshStandardMaterial
          color="#1b3a6b"
          emissive="#2864c7"
          emissiveIntensity={0.5}
          metalness={0.4}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, size * 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[size * 0.6, size * 0.4, 16, 1, true]} />
        <meshStandardMaterial
          color="#f4f6fa"
          side={THREE.DoubleSide}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, -size * 0.5, 0]}>
        <sphereGeometry args={[size * 0.12, 8, 8]} />
        <meshBasicMaterial color="#ff5a5a" />
      </mesh>
    </group>
  );
}

function Satellites() {
  const configs = useMemo(
    () => [
      { radius: 2.85, speed: 0.55, tilt: 0.35, phase: 0.0 },
      { radius: 3.05, speed: -0.42, tilt: -0.6, phase: 1.7 },
      { radius: 3.25, speed: 0.32, tilt: 0.9, phase: 3.4 },
      { radius: 2.75, speed: -0.6, tilt: 0.15, phase: 5.0, size: 0.045 },
    ],
    [],
  );
  return (
    <>
      {configs.map((c, i) => (
        <Satellite key={i} {...c} />
      ))}
    </>
  );
}

function Meteor() {
  const group = useRef<THREE.Group>(null);
  const state = useRef({
    active: false,
    t: 0,
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
    next: 3,
  });
  function reset(clockTime: number) {
    const s = state.current;
    s.active = true;
    s.t = 0;
    const side = Math.random() > 0.5 ? 1 : -1;
    s.start.set(side * (8 + Math.random() * 3), 3 + Math.random() * 2.5, -2 - Math.random() * 4);
    s.end.set(-side * (6 + Math.random() * 3), -2 - Math.random() * 2, 1 + Math.random() * 3);
    s.next = clockTime + 6 + Math.random() * 8;
  }
  useFrame(({ clock }, dt) => {
    if (!group.current) return;
    const s = state.current;
    if (!s.active) {
      if (clock.elapsedTime > s.next) reset(clock.elapsedTime);
      else {
        group.current.visible = false;
        return;
      }
    }
    s.t += dt * 0.55;
    if (s.t >= 1) {
      s.active = false;
      s.next = clock.elapsedTime + 5 + Math.random() * 9;
      group.current.visible = false;
      return;
    }
    group.current.visible = true;
    const p = new THREE.Vector3().lerpVectors(s.start, s.end, s.t);
    group.current.position.copy(p);
    const dir = new THREE.Vector3().subVectors(s.end, s.start).normalize();
    group.current.lookAt(p.clone().add(dir));
  });
  return (
    <group ref={group} visible={false}>
      <mesh>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="#fff3c8" />
      </mesh>
      <pointLight color="#ffd080" intensity={2} distance={4} />
      <mesh position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.07, 1.8, 12, 1, true]} />
        <meshBasicMaterial
          color="#ffb84a"
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 1.7]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.04, 2.6, 12, 1, true]} />
        <meshBasicMaterial
          color="#ffe6a8"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** WebAudio noise-burst "whoosh" fired with each meteor flyby. */
function playWhoosh() {
  try {
    if (typeof window === "undefined") return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    if (ctx.state === "suspended") return; // requires user gesture; skip silently
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2200, t);
    bp.frequency.exponentialRampToValueAtTime(400, t + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    noise.connect(bp).connect(g).connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 1.2);
  } catch {
    /* noop */
  }
}

/**
 * Osiris IN THE SCENE: a glowing orb riding his own orbit among the
 * satellites. While the camera flies down he falls with it, shrinking as
 * the particle world takes over.
 */
function OsirisOrbiter({ paused, descending }: { paused: boolean; descending: boolean }) {
  const group = useRef<THREE.Group>(null);
  const angle = useRef(Math.PI * 0.35);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (descending) {
      g.scale.multiplyScalar(Math.max(0.01, 1 - dt * 1.1));
      return;
    }
    if (!paused) angle.current += dt * 0.24;
    const wobble = Math.sin(angle.current * 2.2) * 0.12;
    g.position.set(
      Math.cos(angle.current) * ORBIT_RADIUS,
      wobble,
      Math.sin(angle.current) * ORBIT_RADIUS,
    );
    g.scale.setScalar(1);
  });
  return (
    <group
      ref={group}
      position={[
        ORBIT_RADIUS * Math.cos(Math.PI * 0.35),
        0,
        ORBIT_RADIUS * Math.sin(Math.PI * 0.35),
      ]}
    >
      <mesh>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshBasicMaterial color="#7ef0ff" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.24, 24, 24]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight color="#7ef0ff" intensity={1.5} distance={2.2} />
    </group>
  );
}

/** The flight controller: drives the camera from orbit to the surface. */
function FlightRig({ progress }: { progress: React.RefObject<number> }) {
  const { camera } = useThree();
  const orbit = useMemo(() => new THREE.Vector3(...ORBIT_CAMERA), []);
  const surface = useMemo(() => new THREE.Vector3(...SURFACE_CAMERA), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = easeInOutCubic(THREE.MathUtils.clamp(progress.current ?? 0, 0, 1));
    camera.position.lerpVectors(orbit, surface, t);
    if (t === 0) {
      // Gentle idle drift while parked in orbit.
      camera.position.x += Math.sin(clock.elapsedTime * 0.16) * 0.2;
      camera.position.y += Math.sin(clock.elapsedTime * 0.11) * 0.1;
    } else {
      // Arrival tremor — the air thickening as the ground comes up.
      camera.position.x += Math.sin(clock.elapsedTime * 2) * 0.02 * t;
    }
    target.set(0, THREE.MathUtils.lerp(0, EARTH_RADIUS * 0.2, t), 0);
    camera.lookAt(target);
  });
  return null;
}

type SpinningEarthProps = {
  /** Height of the scene container in px. */
  height?: number;
  /** Optional overlay (e.g. the sign-in card) that sits ON the Earth. */
  children?: ReactNode;
  /** Called the instant the fly-in lands (progress reaches 1). */
  onFlightComplete?: () => void;
  /** Hide the CTA / label (used while the particle world takes over). */
  chromeVisible?: boolean;
};

export function SpinningEarth({
  height = 480,
  children,
  onFlightComplete,
  chromeVisible = true,
}: SpinningEarthProps) {
  const [meteorKey, setMeteorKey] = useState(0);
  const progressRef = useRef(0);
  const [flying, setFlying] = useState(false);
  const [descending, setDescending] = useState(false);
  const flightRaf = useRef(0);

  const animateFlight = useCallback(
    (from: number, to: number, durationMs: number) => {
      cancelAnimationFrame(flightRaf.current);
      const start = performance.now();
      setFlying(true);
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        progressRef.current = from + (to - from) * easeInOutCubic(t);
        if (t < 1) {
          flightRaf.current = requestAnimationFrame(step);
        } else {
          progressRef.current = to;
          setFlying(false);
          if (to > from) {
            setDescending(true);
            onFlightComplete?.();
          } else {
            setDescending(false);
          }
        }
      };
      flightRaf.current = requestAnimationFrame(step);
    },
    [onFlightComplete],
  );

  const flyIn = useCallback(() => {
    if (flying) return;
    setDescending(false);
    animateFlight(progressRef.current, 1, FLIGHT_MS);
  }, [animateFlight, flying]);

  const flyOut = useCallback(() => {
    if (flying) return;
    setDescending(false);
    animateFlight(progressRef.current, 0, FLIGHT_MS);
  }, [animateFlight, flying]);

  useEarthFlightSubscription(flyIn, flyOut);

  useEffect(() => () => cancelAnimationFrame(flightRaf.current), []);

  // Random meteor flyby every 8–15s with a WebAudio whoosh
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function loop() {
      const wait = 8000 + Math.random() * 7000;
      timer = setTimeout(() => {
        if (cancelled) return;
        setMeteorKey((k) => k + 1);
        playWhoosh();
        loop();
      }, wait);
    }
    loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  void meteorKey;

  return (
    <div
      className="spinning-earth relative w-full overflow-hidden"
      style={{ height, background: "#02040d" }}
    >
      <Canvas
        shadows
        camera={{ position: ORBIT_CAMERA, fov: 45 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#02040d"]} />
        <Stars radius={120} depth={70} count={7000} factor={4} fade speed={0.22} />
        <ambientLight intensity={0.32} color="#b7d8ff" />
        <directionalLight position={[8, 5, 8]} intensity={2.8} color="#fff2cc" castShadow />
        <group position={[12, 4.2, -10]}>
          <pointLight intensity={4.5} color="#ffd080" distance={42} />
          <mesh>
            <sphereGeometry args={[0.85, 48, 48]} />
            <meshBasicMaterial color="#fff6c8" toneMapped={false} />
          </mesh>
          <mesh scale={1.35}>
            <sphereGeometry args={[0.85, 32, 32]} />
            <meshBasicMaterial
              color="#ffd27a"
              transparent
              opacity={0.45}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh scale={1.9}>
            <sphereGeometry args={[0.85, 32, 32]} />
            <meshBasicMaterial
              color="#ffb14a"
              transparent
              opacity={0.18}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh scale={2.8}>
            <sphereGeometry args={[0.85, 24, 24]} />
            <meshBasicMaterial
              color="#ff8a2a"
              transparent
              opacity={0.08}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
        <group position={[-5.2, 2.1, -2.6]}>
          <mesh>
            <sphereGeometry args={[0.46, 48, 48]} />
            <meshStandardMaterial
              color="#e9e4d2"
              emissive="#5b4a2a"
              emissiveIntensity={0.22}
              roughness={0.95}
              metalness={0}
            />
          </mesh>
          <mesh scale={1.25}>
            <sphereGeometry args={[0.46, 24, 24]} />
            <meshBasicMaterial
              color="#ffd9a0"
              transparent
              opacity={0.12}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
        <Satellites />
        <Meteor />
        <OsirisOrbiter paused={flying} descending={descending} />
        <FlightRig progress={progressRef} />
        <EarthTextureBoundary fallback={<FallbackEarth />}>
          <Suspense fallback={<FallbackEarth />}>
            <Earth />
          </Suspense>
        </EarthTextureBoundary>
      </Canvas>
      {chromeVisible && children}
      {chromeVisible && (
        <div className="pointer-events-none absolute left-4 top-3 z-20 font-mono text-[0.55rem] uppercase tracking-[0.35em] text-[oklch(0.78_0.14_82/0.7)]">
          Earth · Realm of Mr. Infinity
        </div>
      )}
    </div>
  );
}

function useEarthFlightSubscription(flyIn: () => void, flyOut: () => void) {
  useEffect(() => {
    const listener = (event: EarthFlightEvent) => {
      if (event === "fly-in") flyIn();
      else flyOut();
    };
    flightListeners.add(listener);
    return () => {
      flightListeners.delete(listener);
    };
  }, [flyIn, flyOut]);
}

export default SpinningEarth;
