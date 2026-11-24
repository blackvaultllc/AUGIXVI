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
import { ANUBIS_PORTRAIT_SRC } from "../avatar/medallionPortraits";

/**
 * The REAL Spinning Earth from blackvaultllc/infinitycomics — three.js sphere
 * with the actual NASA-derived textures (day / night lights / clouds /
 * specular / normal) over a starfield, and the "Earth · Realm of Mr.
 * Infinity" label. The sign-in card sits ON TOP of the Earth itself. The
 * "Enter Live Mode" CTA is retired (owner order 2026-11-11): after sign-in
 * the flight down happens automatically.
 *
 * SCENE DRESSING (owner order 2026-11-24): the Earth spins ALONE. The
 * decorative sun, moon, orbiting satellites, meteor flybys and the moving
 * orb are REMOVED — they did not look real to him. In their place ANUBIS'S
 * FACE stands on the LEFT side of the scene in a still circular medallion
 * (the circle does not move) while the world spins. Entering the live
 * world stays one continuous automatic camera flight from orbit down to
 * the surface — the particle world opens over the arriving camera. No
 * screen jump, ever.
 */

const EARTH_TEXTURES = {
  day: "/assets/world/earth/earth_day.jpg",
  night: "/assets/world/earth/earth_lights.png",
  clouds: "/assets/world/earth/earth_clouds.png",
  specular: "/assets/world/earth/earth_specular.jpg",
  normal: "/assets/world/earth/earth_normal.jpg",
} as const;

const EARTH_RADIUS = 2.2;
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
  const progressRef = useRef(0);
  const [flying, setFlying] = useState(false);
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
            onFlightComplete?.();
          }
        }
      };
      flightRaf.current = requestAnimationFrame(step);
    },
    [onFlightComplete],
  );

  const flyIn = useCallback(() => {
    if (flying) return;
    animateFlight(progressRef.current, 1, FLIGHT_MS);
  }, [animateFlight, flying]);

  const flyOut = useCallback(() => {
    if (flying) return;
    animateFlight(progressRef.current, 0, FLIGHT_MS);
  }, [animateFlight, flying]);

  useEarthFlightSubscription(flyIn, flyOut);

  useEffect(() => () => cancelAnimationFrame(flightRaf.current), []);

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
      {chromeVisible && (
        /* ANUBIS ON THE LEFT (owner order 2026-11-24): his face in a still
           circular medallion on the LEFT side of the scene — never the
           middle — while the Earth spins. The circle does not move.
           Placement lives in styles.css (.spinning-earth__anubis-medallion);
           on phone widths it steps up to the upper left so the centered
           sign-in card never covers the face. */
        <div className="spinning-earth__anubis-medallion" aria-hidden="true">
          <img src={ANUBIS_PORTRAIT_SRC} alt="" />
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
