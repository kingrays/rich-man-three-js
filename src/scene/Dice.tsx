import { useFrame } from '@react-three/fiber'
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CanvasTexture,
  Euler,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { syncDiceLivePosition, useCameraStore } from '../store/cameraStore'
import { BOARD_HALF, BOARD_SURFACE_Y } from './Board'

const DIE_SIZE = 0.48
const DIE_HALF = DIE_SIZE / 2
const STABLE_FRAMES_NEEDED = 28
const LIN_SLEEP = 0.12
const ANG_SLEEP = 0.35
const MAX_SIM_SEC = 6
const WALL_H = 2.2
const WALL_T = 0.2
const PLAY_HALF = BOARD_HALF - 0.15

/** 默认静置位置（棋盘中央偏前）；开局后落点会变，相机跟随真实位置 */
export const DICE_DEFAULT_REST: [number, number, number] = [
  0,
  BOARD_SURFACE_Y + DIE_HALF + 0.01,
  0.6,
]

/** 各点数朝上时的欧拉角 */
const FACE_UP_EULER: Record<number, Euler> = {
  1: new Euler(0, 0, 0),
  2: new Euler(-Math.PI / 2, 0, 0),
  3: new Euler(0, 0, Math.PI / 2),
  4: new Euler(0, 0, -Math.PI / 2),
  5: new Euler(Math.PI / 2, 0, 0),
  6: new Euler(Math.PI, 0, 0),
}

export function faceUpFromQuat(qx: number, qy: number, qz: number, qw: number): number {
  const q = new Quaternion(qx, qy, qz, qw)
  const faces: { n: Vector3; v: number }[] = [
    { n: new Vector3(0, 1, 0), v: 1 },
    { n: new Vector3(0, -1, 0), v: 6 },
    { n: new Vector3(0, 0, 1), v: 2 },
    { n: new Vector3(0, 0, -1), v: 5 },
    { n: new Vector3(1, 0, 0), v: 3 },
    { n: new Vector3(-1, 0, 0), v: 4 },
  ]
  let best = 1
  let bestY = -Infinity
  for (const f of faces) {
    const w = f.n.clone().applyQuaternion(q)
    if (w.y > bestY) {
      bestY = w.y
      best = f.v
    }
  }
  return best
}

function createPipTexture(value: number): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f7f2e8'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = '#cfc4b0'
  ctx.lineWidth = 5
  ctx.strokeRect(3, 3, size - 6, size - 6)

  const pip = (x: number, y: number) => {
    ctx.beginPath()
    ctx.fillStyle = '#1a1a1a'
    ctx.arc(x * size, y * size, size * 0.085, 0, Math.PI * 2)
    ctx.fill()
  }

  const L = 0.28
  const C = 0.5
  const R = 0.72
  const layouts: Record<number, [number, number][]> = {
    1: [[C, C]],
    2: [
      [L, L],
      [R, R],
    ],
    3: [
      [L, L],
      [C, C],
      [R, R],
    ],
    4: [
      [L, L],
      [R, L],
      [L, R],
      [R, R],
    ],
    5: [
      [L, L],
      [R, L],
      [C, C],
      [L, R],
      [R, R],
    ],
    6: [
      [L, L],
      [R, L],
      [L, C],
      [R, C],
      [L, R],
      [R, R],
    ],
  }
  for (const [x, y] of layouts[value] ?? []) pip(x, y)

  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function DieMesh() {
  const materials = useMemo(() => {
    return [3, 4, 1, 6, 2, 5].map(
      (v) =>
        new MeshStandardMaterial({
          map: createPipTexture(v),
          roughness: 0.4,
          metalness: 0.05,
        }),
    )
  }, [])

  return (
    <mesh castShadow receiveShadow material={materials}>
      <boxGeometry args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} />
    </mesh>
  )
}

/** 静置在棋盘上的骰子（无物理） */
function RestingDie({
  position,
  value,
}: {
  position: [number, number, number]
  value: number
}) {
  const euler = FACE_UP_EULER[value] ?? FACE_UP_EULER[1]!
  return (
    <group position={position} rotation={[euler.x, euler.y, euler.z]}>
      <DieMesh />
    </group>
  )
}

interface PhysicsDieProps {
  start: [number, number, number]
  impulse: [number, number, number]
  torque: [number, number, number]
  active: boolean
  onSettled: (value: number, pos: [number, number, number]) => void
  /** 每帧上报位置，供相机跟随 */
  onMove?: (pos: [number, number, number]) => void
}

function PhysicsDie({ start, impulse, torque, active, onSettled, onMove }: PhysicsDieProps) {
  const body = useRef<RapierRigidBody>(null)
  const stable = useRef(0)
  const done = useRef(false)
  const t0 = useRef(0)
  const thrown = useRef(false)

  useEffect(() => {
    if (!active) return
    done.current = false
    stable.current = 0
    thrown.current = false
    t0.current = performance.now() / 1000
  }, [start, impulse, torque, active])

  useFrame(() => {
    const rb = body.current
    if (!rb || !active || done.current) return

    if (!thrown.current) {
      rb.setTranslation({ x: start[0], y: start[1], z: start[2] }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
      const u1 = Math.random()
      const u2 = Math.random()
      const u3 = Math.random()
      const sq1 = Math.sqrt(1 - u1)
      const sq2 = Math.sqrt(u1)
      rb.setRotation(
        {
          x: sq1 * Math.sin(2 * Math.PI * u2),
          y: sq1 * Math.cos(2 * Math.PI * u2),
          z: sq2 * Math.sin(2 * Math.PI * u3),
          w: sq2 * Math.cos(2 * Math.PI * u3),
        },
        true,
      )
      rb.applyImpulse({ x: impulse[0], y: impulse[1], z: impulse[2] }, true)
      rb.applyTorqueImpulse({ x: torque[0], y: torque[1], z: torque[2] }, true)
      thrown.current = true
      t0.current = performance.now() / 1000
      onMove?.([start[0], start[1], start[2]])
      return
    }

    const lv = rb.linvel()
    const av = rb.angvel()
    const speed = Math.hypot(lv.x, lv.y, lv.z)
    const spin = Math.hypot(av.x, av.y, av.z)
    const pos = rb.translation()
    const elapsed = performance.now() / 1000 - t0.current
    onMove?.([pos.x, pos.y, pos.z])

    const nearlyStill =
      speed < LIN_SLEEP && spin < ANG_SLEEP && pos.y < BOARD_SURFACE_Y + 1.0
    if (nearlyStill) stable.current += 1
    else stable.current = 0

    const clampedX = Math.max(-PLAY_HALF, Math.min(PLAY_HALF, pos.x))
    const clampedZ = Math.max(-PLAY_HALF, Math.min(PLAY_HALF, pos.z))
    if (clampedX !== pos.x || clampedZ !== pos.z) {
      rb.setTranslation(
        { x: clampedX, y: Math.max(pos.y, BOARD_SURFACE_Y + DIE_HALF), z: clampedZ },
        true,
      )
      const v = rb.linvel()
      rb.setLinvel(
        {
          x: clampedX !== pos.x ? -v.x * 0.35 : v.x * 0.98,
          y: v.y,
          z: clampedZ !== pos.z ? -v.z * 0.35 : v.z * 0.98,
        },
        true,
      )
    }

    if (stable.current >= STABLE_FRAMES_NEEDED || elapsed > MAX_SIM_SEC) {
      done.current = true
      const rot = rb.rotation()
      const value = faceUpFromQuat(rot.x, rot.y, rot.z, rot.w)
      const p = rb.translation()
      const restY = BOARD_SURFACE_Y + DIE_HALF + 0.01
      rb.setTranslation({ x: p.x, y: restY, z: p.z }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
      rb.sleep()
      onMove?.([p.x, restY, p.z])
      onSettled(value, [p.x, restY, p.z])
    }
  })

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={start}
      mass={0.85}
      restitution={0.28}
      friction={0.65}
      linearDamping={0.35}
      angularDamping={0.28}
      ccd
    >
      <CuboidCollider args={[DIE_HALF, DIE_HALF, DIE_HALF]} restitution={0.28} friction={0.65} />
      <DieMesh />
    </RigidBody>
  )
}

function BoardArena() {
  const floorHalfH = 0.08
  const floorY = BOARD_SURFACE_Y - floorHalfH

  return (
    <>
      <RigidBody type="fixed" colliders={false} position={[0, floorY, 0]}>
        <CuboidCollider
          args={[BOARD_HALF, floorHalfH, BOARD_HALF]}
          friction={0.85}
          restitution={0.18}
        />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[0, WALL_H / 2, BOARD_HALF + WALL_T / 2]}>
        <CuboidCollider args={[BOARD_HALF + WALL_T, WALL_H / 2, WALL_T / 2]} friction={0.4} restitution={0.4} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[0, WALL_H / 2, -(BOARD_HALF + WALL_T / 2)]}>
        <CuboidCollider args={[BOARD_HALF + WALL_T, WALL_H / 2, WALL_T / 2]} friction={0.4} restitution={0.4} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[BOARD_HALF + WALL_T / 2, WALL_H / 2, 0]}>
        <CuboidCollider args={[WALL_T / 2, WALL_H / 2, BOARD_HALF + WALL_T]} friction={0.4} restitution={0.4} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[-(BOARD_HALF + WALL_T / 2), WALL_H / 2, 0]}>
        <CuboidCollider args={[WALL_T / 2, WALL_H / 2, BOARD_HALF + WALL_T]} friction={0.4} restitution={0.4} />
      </RigidBody>
    </>
  )
}

interface DiceTrayProps {
  rollId: number
  /** 正在物理投掷 */
  rolling: boolean
  /** 展示朝上的点数（静置时） */
  displayValue: number
  onSettled: (die: number) => void
}

/**
 * 对局中骰子常驻棋盘：
 * - 未投掷：静置在盘面
 * - 投掷中：从静置位置弹起并做物理翻滚
 * - 停稳后：继续留在落点
 */
export function DiceTray({ rollId, rolling, displayValue, onSettled }: DiceTrayProps) {
  const reported = useRef(false)
  const setDicePosition = useCameraStore((s) => s.setDicePosition)
  const [restPos, setRestPos] = useState<[number, number, number]>(DICE_DEFAULT_REST)
  const [restValue, setRestValue] = useState(displayValue)

  // 把真实落点同步给相机，飞往骰子时才对准
  useEffect(() => {
    setDicePosition(restPos)
  }, [restPos, setDicePosition])

  // 外部 displayValue 变化时（如新开局），同步静置朝向
  useEffect(() => {
    if (!rolling) setRestValue(displayValue)
  }, [displayValue, rolling])

  const throwCfg = useMemo(() => {
    const s = rollId * 9973
    const rnd = (i: number) => {
      const x = Math.sin(s * 12.9898 + i * 78.233) * 43758.5453
      return x - Math.floor(x)
    }
  // 从当前静置点略抬起再抛出；冲量略收敛，减少滚出镜头
    return {
      start: [
        restPos[0],
        restPos[1] + 0.28 + rnd(2) * 0.18,
        restPos[2],
      ] as [number, number, number],
      impulse: [
        (rnd(4) - 0.5) * 0.75,
        0.85 + rnd(5) * 0.35,
        (rnd(6) - 0.5) * 0.75,
      ] as [number, number, number],
      torque: [
        (rnd(7) - 0.5) * 0.45,
        (rnd(8) - 0.5) * 0.45,
        (rnd(9) - 0.5) * 0.45,
      ] as [number, number, number],
    }
  }, [rollId, restPos])

  useEffect(() => {
    if (rolling) reported.current = false
  }, [rolling, rollId])

  const handleSettled = (value: number, pos: [number, number, number]) => {
    if (reported.current) return
    reported.current = true
    setRestPos(pos)
    setRestValue(value)
    // 立刻同步落点，避免等下一帧 useEffect
    setDicePosition(pos)
    onSettled(value)
  }

  // 投掷中：物理世界；否则静置网格
  if (rolling) {
    return (
      <Physics gravity={[0, -18, 0]} timeStep="vary">
        <BoardArena />
        <PhysicsDie
          key={`die-${rollId}`}
          start={throwCfg.start}
          impulse={throwCfg.impulse}
          torque={throwCfg.torque}
          active
          onMove={syncDiceLivePosition}
          onSettled={handleSettled}
        />
      </Physics>
    )
  }

  return <RestingDie position={restPos} value={restValue} />
}
