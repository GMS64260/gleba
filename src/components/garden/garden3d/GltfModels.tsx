"use client"

/**
 * Chargement + instanciation des modèles glTF (Kenney Nature Kit, CC0).
 *
 * `InstancedGltf` charge un .glb (mis en cache par useGLTF), en extrait tous
 * les meshes (géométrie + matériau + matrice locale), et les rend en
 * InstancedMesh : une seule passe GPU pour N plants/arbres identiques. Chaque
 * instance porte sa position, sa rotation et une taille cible (m) ; le modèle
 * est normalisé à cette taille via sa boîte englobante, base posée sur `baseY`.
 */

import * as React from "react"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"

import { MODELES } from "./gltf-map"

// Préchargement de tous les modèles (évite le "pop" au premier affichage).
MODELES.forEach((u) => useGLTF.preload(u))

export interface GltfInstance {
  /** Position (repère du parent : bed-local pour cultures, monde pour arbres). */
  x: number
  z: number
  /** Taille cible = dimension horizontale voulue en mètres. */
  size: number
  /** Rotation autour de l'axe vertical (rad). */
  rotY: number
}

interface Part {
  geometry: THREE.BufferGeometry
  material: THREE.Material | THREE.Material[]
  matrix: THREE.Matrix4
}

/** Extrait les meshes du glb + sa dimension de base (pour normaliser l'échelle). */
function useModelParts(u: string): { parts: Part[]; baseDim: number; minY: number } {
  const { scene } = useGLTF(u)
  return React.useMemo(() => {
    scene.updateWorldMatrix(true, true)
    const parts: Part[] = []
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.geometry) {
        parts.push({ geometry: m.geometry, material: m.material, matrix: m.matrixWorld.clone() })
      }
    })
    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    box.getSize(size)
    const baseDim = Math.max(size.x, size.z) || 1
    return { parts, baseDim, minY: box.min.y }
  }, [scene])
}

interface InstancedGltfProps {
  url: string
  instances: GltfInstance[]
  /** Niveau où poser la base du modèle (SOIL_TOP pour cultures, 0 pour arbres). */
  baseY?: number
}

export function InstancedGltf({ url, instances, baseY = 0 }: InstancedGltfProps) {
  const { parts, baseDim, minY } = useModelParts(url)

  const meshes = React.useMemo(() => {
    if (!instances.length) return []
    const inst = new THREE.Matrix4()
    const composed = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()
    return parts.map((part) => {
      const im = new THREE.InstancedMesh(part.geometry, part.material as THREE.Material, instances.length)
      im.castShadow = true
      im.receiveShadow = true
      im.frustumCulled = false // instances dispersées : la sphère du mesh de base ne les couvre pas
      instances.forEach((it, i) => {
        const s = (it.size || baseDim) / baseDim
        e.set(0, it.rotY, 0)
        q.setFromEuler(e)
        pos.set(it.x, baseY - minY * s, it.z)
        scl.set(s, s, s)
        inst.compose(pos, q, scl)
        composed.multiplyMatrices(inst, part.matrix)
        im.setMatrixAt(i, composed)
      })
      im.instanceMatrix.needsUpdate = true
      return im
    })
  }, [parts, instances, baseDim, minY, baseY])

  // InstancedMesh.dispose() libère les buffers d'instances, pas la géométrie /
  // le matériau partagés du glb en cache (réutilisés ailleurs) — donc sûr.
  React.useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])

  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  )
}
