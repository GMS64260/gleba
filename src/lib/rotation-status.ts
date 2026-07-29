interface RotationStatusInput {
  active: boolean
  details: readonly unknown[]
  _count: { planches: number }
}

export function isRotationIncomplete(rotation: RotationStatusInput): boolean {
  return rotation.active && rotation.details.length === 0
}

export function isRotationActiveNonApplied(rotation: RotationStatusInput): boolean {
  return (
    rotation.active &&
    rotation.details.length > 0 &&
    rotation._count.planches === 0
  )
}
