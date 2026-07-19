/** 棋盘上的拟物小模型：房屋、大楼、铁路、公用事业、地契 */

export function OwnerFrame({
  w,
  d,
  y,
  color,
}: {
  w: number
  d: number
  y: number
  color: string
}) {
  const t = 0.035
  const h = 0.03
  return (
    <group>
      <mesh position={[0, y, d / 2 - t / 2]}>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[0, y, -(d / 2 - t / 2)]}>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[w / 2 - t / 2, y, 0]}>
        <boxGeometry args={[t, h, d - t * 2]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[-(w / 2 - t / 2), y, 0]}>
        <boxGeometry args={[t, h, d - t * 2]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.35} />
      </mesh>
    </group>
  )
}

/** 绿色小别墅 */
export function HouseModel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.07, 0]} castShadow>
        <boxGeometry args={[0.16, 0.14, 0.14]} />
        <meshStandardMaterial color="#eaf6ef" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.17, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.13, 0.1, 4]} />
        <meshStandardMaterial color="#2d8f55" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.04, 0.072]}>
        <boxGeometry args={[0.04, 0.07, 0.01]} />
        <meshStandardMaterial color="#6b3e26" />
      </mesh>
      <mesh position={[-0.045, 0.09, 0.072]}>
        <boxGeometry args={[0.035, 0.035, 0.01]} />
        <meshStandardMaterial color="#7ec8e3" emissive="#3a8ab0" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0.045, 0.09, 0.072]}>
        <boxGeometry args={[0.035, 0.035, 0.01]} />
        <meshStandardMaterial color="#7ec8e3" emissive="#3a8ab0" emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

/** 红色多层大楼（酒店） */
export function SkyscraperModel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <boxGeometry args={[0.34, 0.06, 0.3]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[0.28, 0.64, 0.24]} />
        <meshStandardMaterial color="#b03a2e" metalness={0.18} roughness={0.4} />
      </mesh>
      {[0.14, 0.26, 0.38, 0.5, 0.62].map((yy) => (
        <mesh key={yy} position={[0, yy, 0.125]}>
          <boxGeometry args={[0.24, 0.045, 0.012]} />
          <meshStandardMaterial
            color="#a8d8ea"
            emissive="#4a90b8"
            emissiveIntensity={0.3}
            metalness={0.45}
            roughness={0.2}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.74, 0]} castShadow>
        <boxGeometry args={[0.22, 0.1, 0.2]} />
        <meshStandardMaterial color="#7b241c" metalness={0.25} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.88, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.18, 6]} />
        <meshStandardMaterial color="#ecf0f1" metalness={0.75} roughness={0.2} />
      </mesh>
    </group>
  )
}

/** 已购买地契立牌 */
export function DeedMarker({
  color,
  position,
  yaw,
}: {
  color: string
  position: [number, number, number]
  yaw: number
}) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.16, 6]} />
        <meshStandardMaterial color="#5c4030" />
      </mesh>
      <mesh position={[0, 0.18, 0.01]} castShadow>
        <boxGeometry args={[0.14, 0.1, 0.02]} />
        <meshStandardMaterial color="#f5e6c8" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.18, 0.022]}>
        <boxGeometry args={[0.1, 0.06, 0.005]} />
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.4} />
      </mesh>
    </group>
  )
}

export function TrainModel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} scale={0.85}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[0.22, 0.1, 0.12]} />
        <meshStandardMaterial color="#2c3e50" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0.08, 0.12, 0]} castShadow>
        <boxGeometry args={[0.1, 0.08, 0.1]} />
        <meshStandardMaterial color="#34495e" metalness={0.35} roughness={0.45} />
      </mesh>
      {([-0.06, 0.08] as const).flatMap((x) =>
        ([0.07, -0.07] as const).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.04, 10]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        )),
      )}
    </group>
  )
}

export function UtilityModel({
  kind,
  position,
}: {
  kind: 'electric' | 'water'
  position: [number, number, number]
}) {
  if (kind === 'electric') {
    return (
      <group position={position}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.025, 0.2, 6]} />
          <meshStandardMaterial color="#7f8c8d" metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial color="#f1c40f" emissive="#d4a017" emissiveIntensity={0.4} />
        </mesh>
      </group>
    )
  }
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, 0.1, 10]} />
        <meshStandardMaterial color="#5dade2" metalness={0.3} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color="#3498db" metalness={0.4} roughness={0.25} />
      </mesh>
    </group>
  )
}

export function edgeIconPos(
  side: number,
  size: [number, number, number],
  lift: number,
  topY: number,
): [number, number, number] {
  const y = topY + lift + 0.02
  if (side === 0) return [0, y, size[2] * 0.28]
  if (side === 1) return [-size[0] * 0.28, y, 0]
  if (side === 2) return [0, y, -size[2] * 0.28]
  return [size[0] * 0.28, y, 0]
}

export function edgeBuildPos(
  side: number,
  size: [number, number, number],
  lift: number,
  topY: number,
): [number, number, number] {
  const y = topY + lift + 0.02
  if (side === 0) return [0, y, size[2] * 0.2]
  if (side === 1) return [-size[0] * 0.2, y, 0]
  if (side === 2) return [0, y, -size[2] * 0.2]
  return [size[0] * 0.2, y, 0]
}
