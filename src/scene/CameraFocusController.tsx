import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Player } from '../game/types'
import { diceLiveRef, tokenLiveRef, useCameraStore } from '../store/cameraStore'
import { tileWorldPosition } from './Board'

/** 飞往动画时长（秒） */
export const FOCUS_DURATION = 0.65
const FOCUS_HEIGHT = 0.15
/** 相对骰子落点的观察偏移（更近，方便看清点数） */
const DICE_OFFSET = new Vector3(3.2, 5.8, 3.2)

type FocusAnim = {
  t: number
  duration: number
  startPos: Vector3
  endPos: Vector3
  startTarget: Vector3
  endTarget: Vector3
  signaled: boolean
}

function playerFocusPoint(
  players: Player[],
  playerId: number,
  tileIndex?: number,
): Vector3 | null {
  const player = players.find((p) => p.id === playerId)
  if (!player || player.bankrupt) return null

  const index = tileIndex ?? player.position
  const [tx, , tz] = tileWorldPosition(index)
  const aliveOnTile = players.filter((p) => !p.bankrupt && p.position === index)
  const slot = aliveOnTile.findIndex((p) => p.id === playerId)
  const ox = slot >= 0 ? ((slot % 2) - 0.5) * 0.35 : 0
  const oz = slot >= 0 ? (Math.floor(slot / 2) - 0.5) * 0.35 : 0
  return new Vector3(tx + ox, FOCUS_HEIGHT, tz + oz)
}

/** 监听飞往请求，平滑移动 OrbitControls；投掷/走动时持续跟随 */
export function CameraFocusController({ players }: { players: Player[] }) {
  const focusSeq = useCameraStore((s) => s.focusSeq)
  const request = useCameraStore((s) => s.request)
  const followDice = useCameraStore((s) => s.followDice)
  const followToken = useCameraStore((s) => s.followToken)
  const signalArrival = useCameraStore((s) => s.signalArrival)
  const { camera, controls } = useThree()
  const anim = useRef<FocusAnim | null>(null)
  const followTarget = useRef(new Vector3())
  const followCam = useRef(new Vector3())
  /** 跟随棋子时保持飞往结束后的机位偏移 */
  const tokenFollowOffset = useRef(new Vector3(8, 10, 8))
  // 飞往只跟 focusSeq 走；players 用 ref，避免落地结算改 players 时重放旧起步格飞往
  const playersRef = useRef(players)
  playersRef.current = players

  useEffect(() => {
    if (!request || focusSeq <= 0) return
    const ctrl = controls as OrbitControlsImpl | null
    if (!ctrl) {
      signalArrival()
      return
    }

    let endTarget: Vector3 | null = null
    let endPos: Vector3 | null = null

    if (request.kind === 'dice') {
      const [dx, dy, dz] = request.position
      endTarget = new Vector3(dx, dy, dz)
      endPos = endTarget.clone().add(DICE_OFFSET)
    } else {
      endTarget = playerFocusPoint(
        playersRef.current,
        request.playerId,
        request.tileIndex,
      )
      if (!endTarget) {
        signalArrival()
        return
      }
      const startTarget = ctrl.target.clone()
      const startPos = camera.position.clone()
      const offset = startPos.clone().sub(startTarget)
      const len = offset.length()
      if (len < 9) offset.setLength(11)
      else if (len > 20) offset.setLength(14)
      if (offset.y < 5) offset.y = 8
      endPos = endTarget.clone().add(offset)
    }

    if (!endTarget || !endPos) {
      signalArrival()
      return
    }

    const alreadyClose =
      camera.position.distanceTo(endPos) < 0.35 &&
      ctrl.target.distanceTo(endTarget) < 0.35
    if (alreadyClose) {
      camera.position.copy(endPos)
      ctrl.target.copy(endTarget)
      ctrl.update()
      tokenFollowOffset.current.copy(endPos).sub(endTarget)
      signalArrival()
      anim.current = null
      return
    }

    anim.current = {
      t: 0,
      duration: FOCUS_DURATION,
      startPos: camera.position.clone(),
      endPos,
      startTarget: ctrl.target.clone(),
      endTarget,
      signaled: false,
    }
    // 故意不依赖 players：走动结束 resolveLanding 会更新 players，
    // 若重跑 effect 会带着仍含起步格的旧 request 再次飞往，把镜头拉回起点
  }, [focusSeq, request, camera, controls, signalArrival])

  useFrame((_, dt) => {
    const ctrl = controls as OrbitControlsImpl | null
    if (!ctrl) return

    // 优先播完飞往动画
    const a = anim.current
    if (a) {
      a.t = Math.min(1, a.t + dt / a.duration)
      const k = 1 - (1 - a.t) ** 3
      camera.position.lerpVectors(a.startPos, a.endPos, k)
      ctrl.target.lerpVectors(a.startTarget, a.endTarget, k)
      ctrl.update()
      if (a.t >= 1 && !a.signaled) {
        a.signaled = true
        tokenFollowOffset.current.copy(a.endPos).sub(a.endTarget)
        anim.current = null
        signalArrival()
      }
      return
    }

    const k = Math.min(1, dt * 7)

    // 投掷过程：跟随骰子
    if (followDice) {
      const [dx, dy, dz] = diceLiveRef.current
      followTarget.current.set(dx, dy, dz)
      followCam.current.copy(followTarget.current).add(DICE_OFFSET)
      ctrl.target.lerp(followTarget.current, k)
      camera.position.lerp(followCam.current, k)
      ctrl.update()
      return
    }

    // 走动过程：跟随棋子，保持当前观察偏移
    if (followToken) {
      const [tx, ty, tz] = tokenLiveRef.current
      followTarget.current.set(tx, ty, tz)
      followCam.current.copy(followTarget.current).add(tokenFollowOffset.current)
      ctrl.target.lerp(followTarget.current, k)
      camera.position.lerp(followCam.current, k)
      ctrl.update()
    }
  })

  return null
}
