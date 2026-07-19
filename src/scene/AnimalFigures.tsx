/** 棋盘动物棋子：小猪 / 猫 / 兔 / 熊 / 青蛙 —— Q 版大头、软材质、精致五官 */

import { Euler, Quaternion, Vector3 } from 'three'
import {
  ANIMAL_KINDS,
  ANIMAL_LABELS,
  type AnimalKind,
  type Player,
} from '../game/types'

export { ANIMAL_KINDS, ANIMAL_LABELS, type AnimalKind }

/** 按座位兜底（旧逻辑）；优先使用玩家开局所选形象 */
export function animalKindForPlayer(playerId: number): AnimalKind {
  return ANIMAL_KINDS[playerId % ANIMAL_KINDS.length]!
}

export function resolveAnimalKind(player: Pick<Player, 'id' | 'animalKind'>): AnimalKind {
  return player.animalKind ?? animalKindForPlayer(player.id)
}

/** 软胶玩具感材质 */
function Soft({
  color,
  rough = 0.55,
  coat = 0.4,
}: {
  color: string
  rough?: number
  coat?: number
}) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={rough}
      metalness={0.02}
      clearcoat={coat}
      clearcoatRoughness={0.45}
    />
  )
}

/** 腮红 */
function Blush({ y, spread, z }: { y: number; spread: number; z: number }) {
  return (
    <group>
      <mesh position={[-spread, y, z]} scale={[1.2, 0.7, 0.5]}>
        <sphereGeometry args={[0.022, 10, 10]} />
        <meshStandardMaterial color="#ff8aa8" transparent opacity={0.55} roughness={0.9} />
      </mesh>
      <mesh position={[spread, y, z]} scale={[1.2, 0.7, 0.5]}>
        <sphereGeometry args={[0.022, 10, 10]} />
        <meshStandardMaterial color="#ff8aa8" transparent opacity={0.55} roughness={0.9} />
      </mesh>
    </group>
  )
}

/** 大眼睛：眼白 + 彩色虹膜 + 高光 */
function CuteEyes({
  y,
  spread,
  z,
  iris,
  size = 0.028,
}: {
  y: number
  spread: number
  z: number
  iris: string
  size?: number
}) {
  const Eye = ({ x }: { x: number }) => (
    <group position={[x, y, z]}>
      <mesh scale={[1.05, 1.15, 0.7]}>
        <sphereGeometry args={[size, 14, 14]} />
        <meshStandardMaterial color="#fffef9" roughness={0.35} />
      </mesh>
      <mesh position={[0, -size * 0.08, size * 0.45]} scale={[0.72, 0.78, 0.55]}>
        <sphereGeometry args={[size, 12, 12]} />
        <meshStandardMaterial color={iris} roughness={0.3} />
      </mesh>
      <mesh position={[0, -size * 0.08, size * 0.75]} scale={[0.4, 0.45, 0.35]}>
        <sphereGeometry args={[size, 10, 10]} />
        <meshStandardMaterial color="#1a120e" roughness={0.2} />
      </mesh>
      {/* 主高光 */}
      <mesh position={[size * 0.22, size * 0.28, size * 0.95]}>
        <sphereGeometry args={[size * 0.28, 8, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} />
      </mesh>
      {/* 副高光 */}
      <mesh position={[-size * 0.18, -size * 0.1, size * 0.9]}>
        <sphereGeometry args={[size * 0.12, 6, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} />
      </mesh>
    </group>
  )
  return (
    <group>
      <Eye x={-spread} />
      <Eye x={spread} />
    </group>
  )
}

/** 微笑小嘴 */
function Smile({ y, z, color = '#c45a70' }: { y: number; z: number; color?: string }) {
  return (
    <mesh position={[0, y, z]} rotation={[0.2, 0, 0]} scale={[1, 0.45, 0.6]}>
      <torusGeometry args={[0.018, 0.004, 6, 12, Math.PI]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  )
}

/** 玩家色小旗：原点为握点，杆只向上伸，旗面在顶端 */
function HandFlag({ accent }: { accent: string }) {
  return (
    <group scale={1.45}>
      {/* 旗杆：从握点向上，不向下延伸以免穿手 */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.009, 0.011, 0.3, 8]} />
        <meshStandardMaterial color="#a67c52" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.305, 0]} castShadow>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#f0c060" metalness={0.45} roughness={0.35} />
      </mesh>
      {/* 旗面在杆顶侧方 */}
      <mesh position={[0.11, 0.23, 0]} castShadow>
        <boxGeometry args={[0.2, 0.13, 0.014]} />
        <meshPhysicalMaterial
          color={accent}
          roughness={0.45}
          metalness={0.04}
          clearcoat={0.35}
          clearcoatRoughness={0.4}
        />
      </mesh>
    </group>
  )
}

/**
 * 右臂握旗：肩点 → 手臂胶囊 → 手球 → 旗杆，中心线共线对准球心
 * 旋转用欧拉角数字元组，避免每帧 new Quaternion 作为 prop 搞崩 R3F
 */
function rotationAlignYToDir(
  from: [number, number, number],
  to: [number, number, number],
): [number, number, number] {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const len = Math.hypot(dx, dy, dz)
  if (len < 1e-5) return [0, 0, 0]
  const q = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    new Vector3(dx / len, dy / len, dz / len),
  )
  const e = new Euler().setFromQuaternion(q)
  return [e.x, e.y, e.z]
}

function FlagArm({
  from,
  to,
  fur,
  pad,
  flagColor,
  armR,
}: {
  from: [number, number, number]
  to: [number, number, number]
  fur: string
  pad: string
  flagColor: string
  armR: number
}) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  // 胶囊总长约等于肩到手心，末端埋进手球
  const cylLen = Math.max(0.02, len - armR * 2)
  const rotation = rotationAlignYToDir(from, to)

  return (
    <group>
      <group position={from} rotation={rotation}>
        <mesh position={[0, len / 2, 0]} castShadow>
          <capsuleGeometry args={[armR, cylLen, 6, 12]} />
          <Soft color={fur} />
        </mesh>
      </group>
      {/* 手球在目标点，手臂中心线指向其球心 */}
      <group position={to}>
        <mesh castShadow>
          <sphereGeometry args={[armR * 1.35, 12, 12]} />
          <Soft color={fur} />
        </mesh>
        <mesh position={[0.012, 0, 0.012]} scale={[0.75, 0.55, 0.5]}>
          <sphereGeometry args={[armR * 1.05, 10, 10]} />
          <Soft color={pad} rough={0.7} coat={0.15} />
        </mesh>
        <HandFlag accent={flagColor} />
      </group>
    </group>
  )
}

/**
 * Q 版四肢：短粗、带掌垫；右手举起握旗（肩到手心共线）
 */
function CuteLimbs({
  fur,
  pad,
  flagColor,
  thick = false,
  hoof = false,
}: {
  fur: string
  pad: string
  /** 右手所握小旗颜色（玩家座位色） */
  flagColor: string
  thick?: boolean
  hoof?: boolean
}) {
  const armR = thick ? 0.032 : 0.028
  const legR = thick ? 0.038 : 0.032
  return (
    <group>
      {/* 左臂自然下垂略前 */}
      <group position={[-0.125, 0.22, 0.03]} rotation={[0.35, 0.15, 0.65]}>
        <mesh castShadow>
          <capsuleGeometry args={[armR, 0.07, 6, 12]} />
          <Soft color={fur} />
        </mesh>
        <mesh position={[0, -0.06, 0.01]} castShadow>
          <sphereGeometry args={[armR * 1.25, 12, 12]} />
          <Soft color={fur} />
        </mesh>
        <mesh position={[0, -0.06, 0.02]} scale={[0.7, 0.55, 0.45]}>
          <sphereGeometry args={[armR * 1.1, 10, 10]} />
          <Soft color={pad} rough={0.7} coat={0.15} />
        </mesh>
      </group>

      <FlagArm
        from={[0.1, 0.26, 0.03]}
        to={[0.22, 0.36, 0.07]}
        fur={fur}
        pad={pad}
        flagColor={flagColor}
        armR={armR}
      />

      {/* 短腿 + 圆脚 */}
      <group position={[-0.055, 0.08, 0.01]} rotation={[0.12, 0, 0.06]}>
        <mesh castShadow>
          <capsuleGeometry args={[legR, 0.055, 6, 12]} />
          <Soft color={fur} />
        </mesh>
        {hoof ? (
          <mesh position={[0, -0.055, 0.02]} rotation={[1.1, 0, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.034, 0.032, 10]} />
            <Soft color={pad} rough={0.65} coat={0.2} />
          </mesh>
        ) : (
          <mesh position={[0, -0.05, 0.025]} scale={[1.15, 0.65, 1.35]} castShadow>
            <sphereGeometry args={[0.036, 12, 12]} />
            <Soft color={fur} />
          </mesh>
        )}
        {!hoof && (
          <mesh position={[0, -0.048, 0.045]} scale={[0.8, 0.4, 0.7]}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <Soft color={pad} rough={0.7} coat={0.15} />
          </mesh>
        )}
      </group>
      <group position={[0.055, 0.08, 0.01]} rotation={[0.12, 0, -0.06]}>
        <mesh castShadow>
          <capsuleGeometry args={[legR, 0.055, 6, 12]} />
          <Soft color={fur} />
        </mesh>
        {hoof ? (
          <mesh position={[0, -0.055, 0.02]} rotation={[1.1, 0, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.034, 0.032, 10]} />
            <Soft color={pad} rough={0.65} coat={0.2} />
          </mesh>
        ) : (
          <mesh position={[0, -0.05, 0.025]} scale={[1.15, 0.65, 1.35]} castShadow>
            <sphereGeometry args={[0.036, 12, 12]} />
            <Soft color={fur} />
          </mesh>
        )}
        {!hoof && (
          <mesh position={[0, -0.048, 0.045]} scale={[0.8, 0.4, 0.7]}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <Soft color={pad} rough={0.7} coat={0.15} />
          </mesh>
        )}
      </group>
    </group>
  )
}

/** 圆润身体：单颗主球 + 肚皮，避免「两段胶囊」难看 */
function CuteBody({
  fur,
  belly,
  accent,
  pad = '#f0b0a0',
  fat = false,
}: {
  fur: string
  belly: string
  accent: string
  pad?: string
  fat?: boolean
}) {
  const r = fat ? 0.135 : 0.118
  return (
    <group>
      <mesh position={[0, 0.2, 0]} scale={[1.05, 1.1, 0.95]} castShadow>
        <sphereGeometry args={[r, 20, 20]} />
        <Soft color={fur} />
      </mesh>
      <mesh position={[0, 0.2, r * 0.55]} scale={[0.85, 0.9, 0.55]}>
        <sphereGeometry args={[r * 0.72, 16, 16]} />
        <Soft color={belly} rough={0.6} coat={0.25} />
      </mesh>
      <CuteLimbs fur={fur} pad={pad} flagColor={accent} thick={fat} />
    </group>
  )
}

function PigFigure({ accent }: { accent: string }) {
  const fur = '#ffb3c1'
  const deep = '#ff8fab'
  return (
    <group scale={1.12}>
      {/* 圆滚身体 */}
      <mesh position={[0, 0.2, 0]} scale={[1.1, 1.05, 1]} castShadow>
        <sphereGeometry args={[0.14, 20, 20]} />
        <Soft color={fur} />
      </mesh>
      <mesh position={[0, 0.2, 0.08]} scale={[0.85, 0.85, 0.5]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <Soft color="#ffe0e8" rough={0.6} coat={0.2} />
      </mesh>
      <CuteLimbs fur={fur} pad="#e07088" flagColor={accent} thick hoof />

      {/* 大头 */}
      <mesh position={[0, 0.42, 0.02]} castShadow>
        <sphereGeometry args={[0.13, 20, 20]} />
        <Soft color={fur} />
      </mesh>

      {/* 垂耳 */}
      <mesh position={[-0.11, 0.46, 0.02]} rotation={[0.5, 0.6, -1.1]} castShadow>
        <capsuleGeometry args={[0.04, 0.015, 6, 12]} />
        <Soft color={deep} />
      </mesh>
      <mesh position={[0.11, 0.46, 0.02]} rotation={[0.5, -0.6, 1.1]} castShadow>
        <capsuleGeometry args={[0.04, 0.015, 6, 12]} />
        <Soft color={deep} />
      </mesh>
      <mesh position={[-0.115, 0.45, 0.03]} rotation={[0.5, 0.6, -1.1]}>
        <capsuleGeometry args={[0.02, 0.008, 4, 8]} />
        <Soft color="#ffc2d1" rough={0.7} coat={0.15} />
      </mesh>
      <mesh position={[0.115, 0.45, 0.03]} rotation={[0.5, -0.6, 1.1]}>
        <capsuleGeometry args={[0.02, 0.008, 4, 8]} />
        <Soft color="#ffc2d1" rough={0.7} coat={0.15} />
      </mesh>

      <CuteEyes y={0.45} spread={0.048} z={0.11} iris="#5b3a2e" size={0.03} />
      <Blush y={0.4} spread={0.08} z={0.1} />

      {/* 招牌圆鼻 */}
      <mesh position={[0, 0.395, 0.13]} rotation={[1.35, 0, 0]} castShadow>
        <cylinderGeometry args={[0.042, 0.048, 0.045, 16]} />
        <Soft color="#ff8fab" rough={0.5} coat={0.35} />
      </mesh>
      <mesh position={[-0.014, 0.395, 0.155]}>
        <sphereGeometry args={[0.009, 8, 8]} />
        <meshStandardMaterial color="#c45a70" roughness={0.55} />
      </mesh>
      <mesh position={[0.014, 0.395, 0.155]}>
        <sphereGeometry args={[0.009, 8, 8]} />
        <meshStandardMaterial color="#c45a70" roughness={0.55} />
      </mesh>
      <Smile y={0.37} z={0.12} />

      {/* 卷尾 */}
      <mesh position={[0.03, 0.18, -0.13]} rotation={[0.5, 0.5, 1]} castShadow>
        <torusGeometry args={[0.032, 0.011, 8, 16, Math.PI * 1.7]} />
        <Soft color={deep} />
      </mesh>
    </group>
  )
}

function CatFigure({ accent }: { accent: string }) {
  const fur = '#e0b07a'
  return (
    <group scale={1.12}>
      <CuteBody fur={fur} belly="#fff4e6" accent={accent} pad="#e8a090" />
      <mesh position={[0, 0.43, 0]} castShadow>
        <sphereGeometry args={[0.122, 20, 20]} />
        <Soft color={fur} />
      </mesh>

      {/* 尖耳 */}
      <mesh position={[-0.075, 0.54, 0]} rotation={[0.05, 0, -0.25]} castShadow>
        <coneGeometry args={[0.042, 0.1, 5]} />
        <Soft color={fur} />
      </mesh>
      <mesh position={[0.075, 0.54, 0]} rotation={[0.05, 0, 0.25]} castShadow>
        <coneGeometry args={[0.042, 0.1, 5]} />
        <Soft color={fur} />
      </mesh>
      <mesh position={[-0.075, 0.525, 0.015]} rotation={[0.05, 0, -0.25]}>
        <coneGeometry args={[0.02, 0.055, 5]} />
        <Soft color="#f5a9bc" rough={0.7} coat={0.15} />
      </mesh>
      <mesh position={[0.075, 0.525, 0.015]} rotation={[0.05, 0, 0.25]}>
        <coneGeometry args={[0.02, 0.055, 5]} />
        <Soft color="#f5a9bc" rough={0.7} coat={0.15} />
      </mesh>

      {/* 面颊蓬松 */}
      <mesh position={[-0.1, 0.4, 0.05]} scale={[0.7, 0.55, 0.5]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <Soft color={fur} />
      </mesh>
      <mesh position={[0.1, 0.4, 0.05]} scale={[0.7, 0.55, 0.5]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <Soft color={fur} />
      </mesh>

      <CuteEyes y={0.45} spread={0.05} z={0.105} iris="#3d6b2e" size={0.029} />
      <Blush y={0.395} spread={0.085} z={0.095} />

      <mesh position={[0, 0.395, 0.11]} castShadow>
        <sphereGeometry args={[0.038, 14, 14]} />
        <Soft color="#ffe8d6" rough={0.6} coat={0.2} />
      </mesh>
      <mesh position={[0, 0.4, 0.14]}>
        <sphereGeometry args={[0.011, 8, 8]} />
        <meshStandardMaterial color="#3a2218" roughness={0.4} />
      </mesh>
      <Smile y={0.375} z={0.125} />

      {/* 优雅弯尾 */}
      <group position={[0.05, 0.14, -0.1]} rotation={[1.0, 0.4, 0.3]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.024, 0.1, 6, 12]} />
          <Soft color={fur} />
        </mesh>
        <mesh position={[0.02, 0.09, -0.02]} rotation={[-0.7, 0.3, 0.5]} castShadow>
          <capsuleGeometry args={[0.02, 0.08, 6, 12]} />
          <Soft color={fur} />
        </mesh>
        <mesh position={[0.05, 0.13, -0.05]} castShadow>
          <sphereGeometry args={[0.022, 10, 10]} />
          <Soft color={fur} />
        </mesh>
      </group>
    </group>
  )
}

function RabbitFigure({ accent }: { accent: string }) {
  const fur = '#f0eaf8'
  return (
    <group scale={1.12}>
      <CuteBody fur={fur} belly="#ffffff" accent={accent} pad="#f0b0c0" />

      <mesh position={[0, 0.43, 0]} castShadow>
        <sphereGeometry args={[0.118, 20, 20]} />
        <Soft color={fur} />
      </mesh>

      {/* 一高一低长耳，更生动 */}
      <group position={[-0.055, 0.52, -0.01]} rotation={[0.25, 0.08, -0.1]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.032, 0.16, 6, 12]} />
          <Soft color={fur} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <capsuleGeometry args={[0.016, 0.12, 5, 10]} />
          <Soft color="#f9c5d5" rough={0.7} coat={0.15} />
        </mesh>
      </group>
      <group position={[0.055, 0.52, -0.01]} rotation={[0.1, -0.05, 0.22]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.032, 0.15, 6, 12]} />
          <Soft color={fur} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <capsuleGeometry args={[0.016, 0.11, 5, 10]} />
          <Soft color="#f9c5d5" rough={0.7} coat={0.15} />
        </mesh>
      </group>

      <CuteEyes y={0.45} spread={0.045} z={0.105} iris="#6b4a8a" size={0.03} />
      <Blush y={0.395} spread={0.08} z={0.095} />

      <mesh position={[0, 0.4, 0.11]} castShadow>
        <sphereGeometry args={[0.034, 14, 14]} />
        <Soft color="#fff5f8" rough={0.6} coat={0.2} />
      </mesh>
      <mesh position={[0, 0.402, 0.135]}>
        <sphereGeometry args={[0.01, 8, 8]} />
        <meshStandardMaterial color="#6a3848" roughness={0.45} />
      </mesh>
      <Smile y={0.38} z={0.12} color="#d07090" />

      {/* 蓬松棉尾 */}
      <mesh position={[0, 0.14, -0.125]} castShadow>
        <sphereGeometry args={[0.055, 14, 14]} />
        <Soft color="#ffffff" rough={0.75} coat={0.1} />
      </mesh>
      <mesh position={[0.015, 0.16, -0.145]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <Soft color="#faf6ff" rough={0.8} coat={0.1} />
      </mesh>
    </group>
  )
}

function BearFigure({ accent }: { accent: string }) {
  const fur = '#9a643f'
  const snout = '#e8c49a'
  return (
    <group scale={1.12}>
      <CuteBody fur={fur} belly="#f5e0c4" accent={accent} pad="#c48a6a" fat />

      <mesh position={[0, 0.44, 0]} castShadow>
        <sphereGeometry args={[0.135, 20, 20]} />
        <Soft color={fur} />
      </mesh>

      {/* 圆耳 */}
      <mesh position={[-0.1, 0.55, 0]} castShadow>
        <sphereGeometry args={[0.045, 14, 14]} />
        <Soft color={fur} />
      </mesh>
      <mesh position={[0.1, 0.55, 0]} castShadow>
        <sphereGeometry args={[0.045, 14, 14]} />
        <Soft color={fur} />
      </mesh>
      <mesh position={[-0.1, 0.55, 0.015]}>
        <sphereGeometry args={[0.024, 12, 12]} />
        <Soft color="#c48a6a" rough={0.7} coat={0.15} />
      </mesh>
      <mesh position={[0.1, 0.55, 0.015]}>
        <sphereGeometry args={[0.024, 12, 12]} />
        <Soft color="#c48a6a" rough={0.7} coat={0.15} />
      </mesh>

      <CuteEyes y={0.46} spread={0.052} z={0.11} iris="#4a3020" size={0.028} />
      <Blush y={0.405} spread={0.09} z={0.1} />

      <mesh position={[0, 0.405, 0.12]} castShadow>
        <sphereGeometry args={[0.05, 14, 14]} />
        <Soft color={snout} rough={0.6} coat={0.2} />
      </mesh>
      <mesh position={[0, 0.412, 0.16]}>
        <sphereGeometry args={[0.015, 10, 10]} />
        <meshStandardMaterial color="#2b1a14" roughness={0.45} />
      </mesh>
      <Smile y={0.385} z={0.145} color="#8a5040" />

      <mesh position={[0, 0.15, -0.13]} castShadow>
        <sphereGeometry args={[0.038, 12, 12]} />
        <Soft color={fur} />
      </mesh>
    </group>
  )
}

/** Q 版青蛙：鼓眼、宽嘴、短蹼腿 */
function FrogFigure({ accent }: { accent: string }) {
  const skin = '#6bcb77'
  const belly = '#d4f5c8'
  const pad = '#4aa35a'
  return (
    <group scale={1.12}>
      {/* 圆润蛙身 */}
      <mesh position={[0, 0.18, 0]} scale={[1.15, 0.95, 1.05]} castShadow>
        <sphereGeometry args={[0.125, 20, 20]} />
        <Soft color={skin} />
      </mesh>
      <mesh position={[0, 0.175, 0.07]} scale={[0.9, 0.85, 0.55]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <Soft color={belly} rough={0.6} coat={0.25} />
      </mesh>

      {/* 左前肢自然下垂 */}
      <group position={[-0.12, 0.18, 0.04]} rotation={[0.4, 0.2, 0.7]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.028, 0.05, 6, 12]} />
          <Soft color={skin} />
        </mesh>
        <mesh position={[0, -0.05, 0.015]} scale={[1.4, 0.55, 1.1]} castShadow>
          <sphereGeometry args={[0.032, 12, 12]} />
          <Soft color={pad} rough={0.65} coat={0.2} />
        </mesh>
      </group>
      <FlagArm
        from={[0.09, 0.22, 0.03]}
        to={[0.2, 0.32, 0.07]}
        fur={skin}
        pad={pad}
        flagColor={accent}
        armR={0.028}
      />

      {/* 粗短后腿 + 大蹼脚 */}
      <group position={[-0.07, 0.07, 0.01]} rotation={[0.15, 0, 0.12]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.04, 0.04, 6, 12]} />
          <Soft color={skin} />
        </mesh>
        <mesh position={[0, -0.05, 0.03]} scale={[1.5, 0.5, 1.35]} castShadow>
          <sphereGeometry args={[0.038, 12, 12]} />
          <Soft color={pad} rough={0.65} coat={0.2} />
        </mesh>
      </group>
      <group position={[0.07, 0.07, 0.01]} rotation={[0.15, 0, -0.12]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.04, 0.04, 6, 12]} />
          <Soft color={skin} />
        </mesh>
        <mesh position={[0, -0.05, 0.03]} scale={[1.5, 0.5, 1.35]} castShadow>
          <sphereGeometry args={[0.038, 12, 12]} />
          <Soft color={pad} rough={0.65} coat={0.2} />
        </mesh>
      </group>

      {/* 大头 */}
      <mesh position={[0, 0.38, 0.02]} castShadow>
        <sphereGeometry args={[0.125, 20, 20]} />
        <Soft color={skin} />
      </mesh>

      {/* 鼓起的眼泡 */}
      <mesh position={[-0.055, 0.48, 0.04]} castShadow>
        <sphereGeometry args={[0.048, 14, 14]} />
        <Soft color={skin} />
      </mesh>
      <mesh position={[0.055, 0.48, 0.04]} castShadow>
        <sphereGeometry args={[0.048, 14, 14]} />
        <Soft color={skin} />
      </mesh>
      <CuteEyes y={0.485} spread={0.055} z={0.08} iris="#2d5a1e" size={0.032} />
      <Blush y={0.36} spread={0.085} z={0.1} />

      {/* 宽嘴 */}
      <mesh position={[0, 0.355, 0.11]} scale={[1.6, 0.55, 0.7]} castShadow>
        <sphereGeometry args={[0.045, 14, 14]} />
        <Soft color="#5ab86a" rough={0.55} coat={0.3} />
      </mesh>
      <mesh position={[0, 0.345, 0.13]} rotation={[0.15, 0, 0]} scale={[1.35, 0.35, 0.5]}>
        <torusGeometry args={[0.028, 0.005, 6, 16, Math.PI]} />
        <meshStandardMaterial color="#3d7a48" roughness={0.55} />
      </mesh>

      {/* 小鼻孔 */}
      <mesh position={[-0.012, 0.39, 0.135]}>
        <sphereGeometry args={[0.006, 6, 6]} />
        <meshStandardMaterial color="#3d7a48" roughness={0.5} />
      </mesh>
      <mesh position={[0.012, 0.39, 0.135]}>
        <sphereGeometry args={[0.006, 6, 6]} />
        <meshStandardMaterial color="#3d7a48" roughness={0.5} />
      </mesh>
    </group>
  )
}

export function AnimalFigure({ kind, accent }: { kind: AnimalKind; accent: string }) {
  switch (kind) {
    case 'pig':
      return <PigFigure accent={accent} />
    case 'cat':
      return <CatFigure accent={accent} />
    case 'rabbit':
      return <RabbitFigure accent={accent} />
    case 'bear':
      return <BearFigure accent={accent} />
    case 'frog':
      return <FrogFigure accent={accent} />
  }
}
