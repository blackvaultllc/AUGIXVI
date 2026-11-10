import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";

/**
 * The REAL Spinning Earth from blackvaultllc/infinitycomics — three.js sphere
 * with the actual NASA-derived textures (day / night lights / clouds /
 * specular / normal), orbiting satellites, meteor flybys every 8–15 s with a
 * WebAudio whoosh, starfield, atmosphere glow and the "Earth · Realm of
 * Mr. Infinity" label with an "Enter Live Mode" CTA. The sign-in card sits
 * ON TOP of the Earth itself.
 */

const EARTH_TEXTURES = {
  day: "/assets/world/earth/earth_day.jpg",
  night: "/assets/world/earth/earth_lights.png",
  clouds: "/assets/world/earth/earth_clouds.png",
  specular: "/assets/world/earth/earth_specular.jpg",
  normal: "/assets/world/earth/earth_normal.jpg",
} as const;

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
        <sphereGeometry args={[2.2, 96, 96]} />
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
        <sphereGeometry args={[2.2, 96, 96]} />
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
        <sphereGeometry args={[2.2, 128, 128]} />
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
        <sphereGeometry args={[2.2, 128, 128]} />
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
        <sphereGeometry args={[2.2, 128, 128]} />
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
        <sphereGeometry args={[2.2, 128, 128]} />
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
        <sphereGeometry args={[2.2, 96, 96]} />
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

type SpinningEarthProps = {
  /** Height of the scene container in px. */
  height?: number;
  onEnter?: () => void;
  ctaLabel?: string;
  /** Optional overlay (e.g. the sign-in card) that sits ON the Earth. */
  children?: ReactNode;
};

export function SpinningEarth(props: SpinningEarthProps) {
  return <SpinningEarthScene {...props} />;
}

function SpinningEarthScene({ height, onEnter, ctaLabel, children }: SpinningEarthProps) {
  // Random meteor flyby every 8–15s with a WebAudio whoosh
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function loop() {
      const wait = 8000 + Math.random() * 7000;
      timer = setTimeout(() => {
        if (cancelled) return;
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

  return (
    <div
      className="spinning-earth relative w-full overflow-hidden"
      style={{ height, background: "#02040d" }}
    >
      <SceneWithMeteors />
      {children}
      {onEnter && (
        <button
          onClick={onEnter}
          className="spinning-earth__cta absolute bottom-6 left-1/2 z-20 -translate-x-1/2 border border-[oklch(0.78_0.14_82/0.7)] bg-black/80 px-6 py-3 font-mono text-[0.65rem] uppercase tracking-[0.3em] text-[oklch(0.78_0.14_82)] backdrop-blur transition hover:bg-[oklch(0.78_0.14_82)] hover:text-black"
        >
          {ctaLabel}
        </button>
      )}
      <div className="pointer-events-none absolute left-4 top-3 z-20 font-mono text-[0.55rem] uppercase tracking-[0.35em] text-[oklch(0.78_0.14_82/0.7)]">
        Earth · Realm of Mr. Infinity
      </div>
    </div>
  );
}

function SceneWithMeteors() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.7, 8.2], fov: 45 }}
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
      <EarthTextureBoundary fallback={<FallbackEarth />}>
        <Suspense fallback={<FallbackEarth />}>
          <Earth />
        </Suspense>
      </EarthTextureBoundary>
    </Canvas>
  );
}

export default SpinningEarth;
