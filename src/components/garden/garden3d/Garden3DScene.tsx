"use client"

/**
 * Scène 3D du jardin (react-three-fiber), rendu low-poly avec modèles glTF
 * (Kenney Nature Kit, CC0 — voir public/models/nature/CREDITS.md) :
 * cultures et arbres sont des modèles réels instanciés ; planches surélevées,
 * objets, sol, lumière/ombres et ciel restent procéduraux. La taille des
 * cultures/arbres et le stade de croissance suivent la date affichée
 * (barre de temps → `data`, recalculé par la page via `plan-croissance`).
 */

import * as React from "react"
import { Canvas, useLoader } from "@react-three/fiber"
import { Html, OrbitControls, Sky } from "@react-three/drei"
import * as THREE from "three"

import type { Garden3DData, Garden3DFond, Objet3D, Planche3D } from "./types"
import { computeLayout } from "./layout"
import { OBJET_COLORS, rnd, placerPlants } from "./procedural"
import { modelPourArbre, modelPourCulture } from "./gltf-map"
import { InstancedGltf, type GltfInstance } from "./GltfModels"

const BED_H = 0.28 // hauteur d'une planche surélevée (m)
const SOIL_TOP = BED_H - 0.05 // niveau du terreau (les plants y prennent racine)

function hashId(id: string | number): number {
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 100000
}

// ---- Planche surélevée + cultures glTF ------------------------------------

function Bed({ p, showLabels }: { p: Planche3D; showLabels: boolean }) {
  const L = p.largeur ?? 1
  const P = p.longueur ?? 1
  const cx = (p.posX ?? 0) + L / 2
  const cz = (p.posY ?? 0) + P / 2
  const rotY = -((p.rotation2D ?? 0) * Math.PI) / 180
  const seed = hashId(p.id)
  const cultures = p.cultures ?? []
  const n = Math.max(1, cultures.length)
  const bandLen = P / n

  const fields = cultures.map((c, k) => {
    const footprint = c.espece?.etalement || c.espacement || c.itp?.espacement || 0.3
    const bandCenterZ = -P / 2 + bandLen * (k + 0.5)
    const placed = placerPlants(L, bandLen, footprint, c.croissance, seed + k * 101)
    const instances: GltfInstance[] = placed.map((pl) => ({
      x: pl.x,
      z: pl.z + bandCenterZ,
      size: Math.max(0.1, pl.r * 2),
      rotY: pl.rotY,
    }))
    return {
      key: c.id,
      url: modelPourCulture(c.espece?.nom, c.espece?.famille?.id, c.croissance),
      instances,
    }
  })

  const noms = [...new Set(cultures.map((c) => c.espece?.nom).filter(Boolean))] as string[]
  const isSerre = p.type ? /serre|tunnel|ch[aâ]ssis/i.test(p.type) : false

  return (
    <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
      {/* Cadre bois */}
      <mesh position={[0, BED_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[L, BED_H, P]} />
        <meshStandardMaterial color="#8a5a33" roughness={0.9} metalness={0} />
      </mesh>
      {/* Terreau */}
      <mesh position={[0, SOIL_TOP - 0.03, 0]} receiveShadow>
        <boxGeometry args={[Math.max(0.1, L - 0.12), 0.06, Math.max(0.1, P - 0.12)]} />
        <meshStandardMaterial color="#4b3524" roughness={1} metalness={0} />
      </mesh>
      {/* Cultures (modèles glTF instanciés) */}
      {fields.map((f) => (
        <InstancedGltf key={f.key} url={f.url} instances={f.instances} baseY={SOIL_TOP} />
      ))}
      {/* Serre / tunnel : couvert translucide */}
      {isSerre && (
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[L + 0.1, 2, P + 0.1]} />
          <meshPhysicalMaterial color="#cfe8ff" transparent opacity={0.16} roughness={0.1} metalness={0} transmission={0.6} />
        </mesh>
      )}
      {/* Étiquette */}
      {showLabels && noms.length > 0 && (
        <Html position={[0, BED_H + 0.6, 0]} center distanceFactor={14} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              whiteSpace: "nowrap",
              background: "rgba(255,255,255,0.92)",
              color: "#1f2a24",
              font: "600 13px system-ui, sans-serif",
              padding: "3px 9px",
              borderRadius: 999,
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
            }}
          >
            {noms.slice(0, 2).join(" · ")}
            {noms.length > 2 ? ` +${noms.length - 2}` : ""}
          </div>
        </Html>
      )}
    </group>
  )
}

// ---- Objets de jardin (procéduraux) ---------------------------------------

function Objet({ o }: { o: Objet3D }) {
  const cx = o.posX + o.largeur / 2
  const cz = o.posY + o.longueur / 2
  const rotY = -(o.rotation2D * Math.PI) / 180
  const color = o.couleur || OBJET_COLORS[o.type] || OBJET_COLORS.autre

  let node: React.ReactNode
  if (o.type === "allee" || o.type === "passage") {
    node = (
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[o.largeur, 0.04, o.longueur]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
    )
  } else if (o.type === "bordure") {
    node = (
      <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
        <boxGeometry args={[o.largeur, 0.14, o.longueur]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    )
  } else if (o.type === "eau") {
    node = (
      <>
        <mesh position={[0, 0.06, 0]} receiveShadow>
          <boxGeometry args={[o.largeur, 0.12, o.longueur]} />
          <meshStandardMaterial color="#3f2f22" roughness={1} />
        </mesh>
        <mesh position={[0, 0.13, 0]}>
          <boxGeometry args={[o.largeur - 0.1, 0.02, o.longueur - 0.1]} />
          <meshStandardMaterial color="#3f8fd6" roughness={0.08} metalness={0.35} transparent opacity={0.9} />
        </mesh>
      </>
    )
  } else if (o.type === "serre") {
    node = (
      <>
        <mesh position={[0, 0.05, 0]} receiveShadow>
          <boxGeometry args={[o.largeur, 0.1, o.longueur]} />
          <meshStandardMaterial color="#9aa0a6" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.05, 0]} castShadow>
          <boxGeometry args={[o.largeur, 2, o.longueur]} />
          <meshPhysicalMaterial color="#cfe8ff" transparent opacity={0.18} roughness={0.08} metalness={0} transmission={0.7} />
        </mesh>
      </>
    )
  } else if (o.type === "compost") {
    node = (
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[o.largeur, 0.5, o.longueur]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    )
  } else {
    node = (
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[o.largeur, 0.4, o.longueur]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    )
  }
  return (
    <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
      {node}
    </group>
  )
}

// ---- Sol -------------------------------------------------------------------

function makeGrassTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#6a8451"
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 1600; i++) {
    const x = rnd(i * 1.3) * 128
    const y = rnd(i * 2.7 + 5) * 128
    const l = rnd(i * 0.7) * 30 - 15
    const greens = ["#5f7a48", "#748d57", "#556f42", "#7f9862"]
    ctx.fillStyle = greens[i % greens.length]
    ctx.fillRect(x, y, 1.4, 1.4 + Math.abs(l) * 0.05)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function Ground({ size }: { size: number }) {
  const texture = React.useMemo(() => makeGrassTexture(), [])
  React.useEffect(() => () => texture.dispose(), [texture])
  const rep = Math.max(4, Math.round(size / 2))
  texture.repeat.set(rep, rep)
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[size * 2.4, size * 2.4]} />
      <meshStandardMaterial map={texture} color="#6a8451" roughness={1} metalness={0} />
    </mesh>
  )
}

// ---- Fond (image satellite / plan géoréférencé, partagé avec la 2D) --------

function Fond({ fond }: { fond: Garden3DFond }) {
  const texture = useLoader(THREE.TextureLoader, fond.image)
  texture.colorSpace = THREE.SRGBColorSpace
  const w = fond.imageWidth * fond.scale
  const h = fond.imageHeight * fond.scale
  const fx = fond.offsetX + w / 2
  const fz = fond.offsetY + h / 2
  const rot = (fond.rotation * Math.PI) / 180
  return (
    <group position={[fx, 0.015, fz]} rotation={[0, -rot, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={texture} transparent opacity={fond.opacity} roughness={1} metalness={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ---- Scène -----------------------------------------------------------------

export interface Garden3DSceneProps {
  data: Garden3DData
  fond?: Garden3DFond | null
  autoRotate?: boolean
  showLabels?: boolean
}

export default function Garden3DScene({ data, fond, autoRotate = false, showLabels = false }: Garden3DSceneProps) {
  const { cx, cz, size } = React.useMemo(() => computeLayout(data, fond), [data, fond])
  const sun: [number, number, number] = [size * 0.55, size * 0.6, size * 0.62]
  const half = size * 0.7

  // Arbres regroupés par modèle glTF (une passe d'instances par modèle)
  const treeGroups = React.useMemo(() => {
    const map = new Map<string, GltfInstance[]>()
    data.arbres.forEach((a) => {
      const u = modelPourArbre(a.type, hashId(a.id))
      const arr = map.get(u) ?? []
      arr.push({ x: a.posX, z: a.posY, size: Math.max(0.6, a.envergure), rotY: rnd(a.id + 5) * Math.PI * 2 })
      map.set(u, arr)
    })
    return [...map.entries()]
  }, [data.arbres])

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ position: [size * 0.6, size * 0.5, size * 0.72], fov: 42, near: 0.1, far: size * 12 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color("#cfe1ef")
        scene.fog = new THREE.Fog("#d8e6f1", size * 1.5, size * 4.5)
      }}
    >
      <hemisphereLight args={["#eaf4ff", "#69804d", 0.6]} />
      <ambientLight intensity={0.16} />
      <directionalLight
        castShadow
        position={sun}
        intensity={2.7}
        color="#fff1d4"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={size * 4}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <Sky sunPosition={sun} turbidity={8} rayleigh={0.9} mieCoefficient={0.004} mieDirectionalG={0.85} />

      <Ground size={size} />

      <React.Suspense fallback={null}>
        <group position={[-cx, 0, -cz]}>
          {fond && <Fond fond={fond} />}
          {data.planches.map((p) => (
            <Bed key={`b-${p.id}`} p={p} showLabels={showLabels} />
          ))}
          {data.objets.map((o) => (
            <Objet key={`o-${o.id}`} o={o} />
          ))}
          {treeGroups.map(([u, instances]) => (
            <InstancedGltf key={u} url={u} instances={instances} baseY={0} />
          ))}
        </group>
      </React.Suspense>

      <OrbitControls
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2 - 0.04}
        minDistance={size * 0.18}
        maxDistance={size * 2.2}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
      />
    </Canvas>
  )
}
