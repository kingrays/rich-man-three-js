import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Group } from 'three'
import { AnimalFigure, resolveAnimalKind } from './AnimalFigures'
import { tileWorldPosition } from './Board'
import { syncTokenLivePosition } from '../store/cameraStore'
import type { Player } from '../game/types'

/** 每格走动时长（秒） */
export const STEP_DURATION = 0.28
/** 跳动高度 */
const HOP_HEIGHT = 0.35
/** 棋子贴地高度（脚底略高于棋盘） */
const TOKEN_Y = 0.02
/** 相机跟随棋子时的目标高度 */
const FOLLOW_Y = 0.15

/** 从 from 顺时针走到 to 的中间格序列（含终点，不含起点） */
function buildForwardPath(from: number, to: number): number[] {
  const path: number[] = []
  let p = from
  // 最多一圈，避免异常死循环
  for (let i = 0; i < 40; i++) {
    p = (p + 1) % 40
    path.push(p)
    if (p === to) break
  }
  return path
}

function TokenMesh({
  player,
  slot,
  /** 当前是否处于掷骰后的移动阶段，且为本棋子 */
  stepping,
  /** 逻辑已跳到终点时，视觉应从哪一格开始走 */
  stepFrom,
  /** 视角未就绪：停在起点，先不迈步 */
  holdAtStart,
  /** 为本回合走动棋子时，上报实时坐标供相机跟随 */
  reportLive,
  onArrive,
}: {
  player: Player
  slot: number
  stepping: boolean
  stepFrom: number | null
  holdAtStart: boolean
  reportLive: boolean
  onArrive?: () => void
}) {
  const ref = useRef<Group>(null)
  /** 视觉所在格索引 */
  const visualIndex = useRef(player.position)
  /** 待走格子队列 */
  const queue = useRef<number[]>([])
  /** 当前这一格的插值进度 0→1 */
  const progress = useRef(1)
  const fromXZ = useRef({ x: 0, z: 0 })
  const toXZ = useRef({ x: 0, z: 0 })
  const arrived = useRef(false)
  /** 防止 stepping 重复触发同一段路径 */
  const steppingKey = useRef<string | null>(null)
  const onArriveRef = useRef(onArrive)
  onArriveRef.current = onArrive

  // 同格多棋子错开
  const ox = ((slot % 2) - 0.5) * 0.35
  const oz = (Math.floor(slot / 2) - 0.5) * 0.35
  const animal = resolveAnimalKind(player)

  const syncWorld = (index: number) => {
    const [x, , z] = tileWorldPosition(index)
    fromXZ.current = { x, z }
    toXZ.current = { x, z }
    progress.current = 1
    if (ref.current) {
      ref.current.position.x = x + ox
      ref.current.position.z = z + oz
      ref.current.position.y = TOKEN_Y
    }
  }

  const startNextStep = () => {
    const next = queue.current.shift()
    if (next === undefined) {
      // 路径走完
      if (stepping && !arrived.current) {
        arrived.current = true
        onArriveRef.current?.()
      }
      return
    }
    const [fx, , fz] = tileWorldPosition(visualIndex.current)
    const [tx, , tz] = tileWorldPosition(next)
    fromXZ.current = { x: fx, z: fz }
    toXZ.current = { x: tx, z: tz }
    progress.current = 0
    visualIndex.current = next
  }

  // 掷骰移动：从 stepFrom 逐格走到逻辑 position
  useEffect(() => {
    // 视角飞行等待中：先停在起点，避免瞬移到终点
    if (holdAtStart && stepFrom !== null) {
      steppingKey.current = null
      queue.current = []
      progress.current = 1
      arrived.current = false
      visualIndex.current = stepFrom
      syncWorld(stepFrom)
      if (reportLive && ref.current) {
        syncTokenLivePosition([
          ref.current.position.x,
          FOLLOW_Y,
          ref.current.position.z,
        ])
      }
      return
    }

    if (stepping && stepFrom !== null) {
      const key = `${stepFrom}->${player.position}`
      if (steppingKey.current === key) return
      steppingKey.current = key
      arrived.current = false
      visualIndex.current = stepFrom
      syncWorld(stepFrom)
      queue.current = buildForwardPath(stepFrom, player.position)
      startNextStep()
      return
    }

    // 非逐步阶段：瞬移对齐逻辑位置（卡牌传送、开局等）
    steppingKey.current = null
    queue.current = []
    progress.current = 1
    if (visualIndex.current !== player.position) {
      visualIndex.current = player.position
      syncWorld(player.position)
    }
  }, [stepping, stepFrom, holdAtStart, player.position, ox, oz])

  useFrame((_, dt) => {
    if (!ref.current) return
    const g = ref.current

    if (progress.current < 1) {
      progress.current = Math.min(1, progress.current + dt / STEP_DURATION)
      // 轻微缓出，读起来更跟手
      const t = 1 - (1 - progress.current) ** 2
      const { x: fx, z: fz } = fromXZ.current
      const { x: tx, z: tz } = toXZ.current
      g.position.x = fx + (tx - fx) * t + ox
      g.position.z = fz + (tz - fz) * t + oz
      // 抛物线小跳
      g.position.y = TOKEN_Y + Math.sin(t * Math.PI) * HOP_HEIGHT

      if (reportLive) {
        syncTokenLivePosition([g.position.x, FOLLOW_Y, g.position.z])
      }

      if (progress.current >= 1) {
        g.position.y = TOKEN_Y
        startNextStep()
      }
      return
    }

    // 静止时仍跟随 slot 偏移（同格人数变化）
    const [x, , z] = tileWorldPosition(visualIndex.current)
    g.position.x += (x + ox - g.position.x) * Math.min(1, dt * 8)
    g.position.z += (z + oz - g.position.z) * Math.min(1, dt * 8)
    g.position.y = TOKEN_Y

    if (reportLive) {
      syncTokenLivePosition([g.position.x, FOLLOW_Y, g.position.z])
    }
  })

  const spawn = tileWorldPosition(player.position)
  return (
    <group ref={ref} position={[spawn[0] + ox, TOKEN_Y, spawn[2] + oz]}>
      <AnimalFigure kind={animal} accent={player.color} />
    </group>
  )
}

export function Tokens({
  players,
  movingPlayerId,
  moveSteps,
  moveActive,
  onMoveComplete,
}: {
  players: Player[]
  /** 正在逐步走动的玩家；null 表示无 */
  movingPlayerId: number | null
  /** 本次应走的格数（来自骰子） */
  moveSteps: number | null
  /** 视角飞完并停顿后才为 true，此时才真正迈步 */
  moveActive: boolean
  onMoveComplete?: () => void
}) {
  const alive = players.filter((p) => !p.bankrupt)
  // 按「逻辑位置」分组算 slot（结算仍以终点为准）
  const slots = new Map<number, number>()
  const arrivedLock = useRef(false)

  useEffect(() => {
    if (movingPlayerId === null) arrivedLock.current = false
  }, [movingPlayerId])

  const handleArrive = () => {
    if (arrivedLock.current) return
    arrivedLock.current = true
    onMoveComplete?.()
  }

  return (
    <group>
      {alive.map((p) => {
        const n = slots.get(p.position) ?? 0
        slots.set(p.position, n + 1)
        const isMover =
          movingPlayerId === p.id && moveSteps !== null && moveSteps > 0
        const stepFrom = isMover ? (p.position - moveSteps! + 40) % 40 : null
        const holdAtStart = isMover && !moveActive
        const stepping = isMover && moveActive
        return (
          <TokenMesh
            key={p.id}
            player={p}
            slot={n}
            stepping={stepping}
            stepFrom={stepFrom}
            holdAtStart={holdAtStart}
            reportLive={isMover}
            onArrive={stepping ? handleArrive : undefined}
          />
        )
      })}
    </group>
  )
}
