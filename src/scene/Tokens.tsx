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
function buildForwardPath(from: number, to: number, boardLength: number): number[] {
  const path: number[] = []
  let p = from
  // 最多一圈，避免异常死循环
  for (let i = 0; i < boardLength; i++) {
    p = (p + 1) % boardLength
    path.push(p)
    if (p === to) break
  }
  return path
}

function TokenMesh({
  player,
  slot,
  boardLength,
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
  boardLength: number
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
  const boardLenRef = useRef(boardLength)
  boardLenRef.current = boardLength

  // 同格多棋子错开
  const ox = ((slot % 2) - 0.5) * 0.35
  const oz = (Math.floor(slot / 2) - 0.5) * 0.35
  const animal = resolveAnimalKind(player)

  const syncWorld = (index: number) => {
    const [x, , z] = tileWorldPosition(index, boardLenRef.current)
    fromXZ.current = { x, z }
    toXZ.current = { x, z }
    progress.current = 1
    if (ref.current) {
      ref.current.position.x = x + ox
      ref.current.position.z = z + oz
      ref.current.position.y = TOKEN_Y
    }
  }

  // 非走动时：逻辑位置变化则瞬移对齐
  useEffect(() => {
    if (stepping || holdAtStart) return
    visualIndex.current = player.position
    queue.current = []
    syncWorld(player.position)
    steppingKey.current = null
    arrived.current = false
  }, [player.position, stepping, holdAtStart, ox, oz, boardLength])

  // 开局 / 棋盘尺寸变化时对齐一次
  useEffect(() => {
    syncWorld(visualIndex.current)
  }, [ox, oz, boardLength])

  // 开始走动：从 stepFrom 走到逻辑终点
  useEffect(() => {
    if (!stepping || stepFrom === null) return
    const key = `${player.id}:${stepFrom}->${player.position}`
    if (steppingKey.current === key) return
    steppingKey.current = key
    arrived.current = false
    visualIndex.current = stepFrom
    // 立刻对齐起步格并上报，避免相机还停在上一位置
    syncWorld(stepFrom)
    syncTokenLivePosition([
      fromXZ.current.x + ox,
      FOLLOW_Y,
      fromXZ.current.z + oz,
    ])
    queue.current = buildForwardPath(stepFrom, player.position, boardLength)
    if (queue.current.length === 0) {
      syncWorld(player.position)
      onArriveRef.current?.()
      return
    }
    const next = queue.current[0]!
    const [fx, , fz] = tileWorldPosition(visualIndex.current, boardLength)
    const [tx, , tz] = tileWorldPosition(next, boardLength)
    fromXZ.current = { x: fx, z: fz }
    toXZ.current = { x: tx, z: tz }
    progress.current = 0
  }, [stepping, stepFrom, player.id, player.position, boardLength, ox, oz])

  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return

    if (queue.current.length > 0) {
      progress.current = Math.min(1, progress.current + dt / STEP_DURATION)
      const t = progress.current
      // 平滑插值 + 小跳
      const hop = Math.sin(t * Math.PI) * HOP_HEIGHT
      g.position.x = fromXZ.current.x + (toXZ.current.x - fromXZ.current.x) * t + ox
      g.position.z = fromXZ.current.z + (toXZ.current.z - fromXZ.current.z) * t + oz
      g.position.y = TOKEN_Y + hop

      if (reportLive) {
        syncTokenLivePosition([g.position.x, FOLLOW_Y, g.position.z])
      }

      if (t >= 1) {
        const landed = queue.current.shift()!
        visualIndex.current = landed
        if (queue.current.length === 0) {
          syncWorld(landed)
          if (!arrived.current) {
            arrived.current = true
            onArriveRef.current?.()
          }
        } else {
          const next = queue.current[0]!
          const [fx, , fz] = tileWorldPosition(visualIndex.current, boardLenRef.current)
          const [tx, , tz] = tileWorldPosition(next, boardLenRef.current)
          fromXZ.current = { x: fx, z: fz }
          toXZ.current = { x: tx, z: tz }
          progress.current = 0
        }
      }
      return
    }

    // 静止时也上报，便于相机落稳
    if (reportLive) {
      syncTokenLivePosition([g.position.x, FOLLOW_Y, g.position.z])
    }
  }, -1) // 优先于相机跟随，先写入棋子坐标

  const spawn = tileWorldPosition(player.position, boardLength)
  return (
    <group ref={ref} position={[spawn[0] + ox, TOKEN_Y, spawn[2] + oz]}>
      <AnimalFigure kind={animal} accent={player.color} />
    </group>
  )
}

export function Tokens({
  players,
  boardLength,
  movingPlayerId,
  moveSteps,
  moveActive,
  onMoveComplete,
}: {
  players: Player[]
  boardLength: number
  movingPlayerId: number | null
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
        const stepFrom = isMover
          ? (p.position - moveSteps! + boardLength) % boardLength
          : null
        const holdAtStart = isMover && !moveActive
        const stepping = isMover && moveActive
        return (
          <TokenMesh
            key={p.id}
            player={p}
            slot={n}
            boardLength={boardLength}
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
