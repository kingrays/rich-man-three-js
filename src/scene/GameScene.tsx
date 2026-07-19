import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { MOUSE, TOUCH } from 'three'
import { BoardMesh, getBoardMetrics } from './Board'
import { CameraFocusController } from './CameraFocusController'
import { STEP_DURATION, Tokens } from './Tokens'
import { DiceTray } from './Dice'
import { useCameraStore } from '../store/cameraStore'
import { useGameStore } from '../store/gameStore'

/** 视角飞达后，再停顿多久才开始掷骰/迈步（毫秒） */
const HOLD_AFTER_FOCUS_MS = 1000

const ORBIT_MOUSE_BUTTONS = {
  LEFT: MOUSE.ROTATE,
  MIDDLE: MOUSE.DOLLY,
  RIGHT: MOUSE.PAN,
} as const

const ORBIT_TOUCHES = {
  ONE: TOUCH.ROTATE,
  TWO: TOUCH.DOLLY_PAN,
} as const

export function GameScene() {
  const players = useGameStore((s) => s.state.players)
  const phase = useGameStore((s) => s.state.phase)
  const lastDice = useGameStore((s) => s.state.lastDice)
  const logSeq = useGameStore((s) => s.state.logSeq)
  const currentPlayerIndex = useGameStore((s) => s.state.currentPlayerIndex)
  const dispatch = useGameStore((s) => s.dispatch)
  const focusDice = useCameraStore((s) => s.focusDice)
  const focusPlayer = useCameraStore((s) => s.focusPlayer)
  const arrivalSeq = useCameraStore((s) => s.arrivalSeq)
  const setFollowDice = useCameraStore((s) => s.setFollowDice)
  const setFollowToken = useCameraStore((s) => s.setFollowToken)
  const finishLock = useRef(false)
  const prevPhase = useRef(phase)
  /** 本次掷骰/走动所等待的飞往到达序号下限 */
  const expectArrivalAfter = useRef(0)
  /** 视角飞完并停顿后，才允许骰子/棋子真正开演 */
  const [actionArmed, setActionArmed] = useState(false)

  const properties = useGameStore((s) => s.state.properties)
  const board = useGameStore((s) => s.state.board)
  const boardLength = board.length

  const highlightIndex = useGameStore((s) => {
    if (s.state.phase === 'lobby' || s.state.players.length === 0) return null
    const p = s.state.players[s.state.currentPlayerIndex]
    return p && !p.bankrupt ? p.position : null
  })

  const inGame = phase !== 'lobby' && phase !== 'gameOver'
  const currentPlayer = players[currentPlayerIndex]
  const needsFocusGate = phase === 'rolling' || phase === 'moving'
  // 掷骰后逐步走动：当前玩家 + 骰子点数
  const movingPlayerId =
    phase === 'moving' && currentPlayer ? currentPlayer.id : null
  const moveSteps = phase === 'moving' ? (lastDice?.value ?? null) : null
  const rollingActive = phase === 'rolling' && actionArmed
  const moveActive = phase === 'moving' && actionArmed

  // 真正开掷后相机跟随骰子
  useEffect(() => {
    if (rollingActive) setFollowDice(true)
    else setFollowDice(false)
  }, [rollingActive, setFollowDice])

  // 真正迈步后相机跟随棋子（停止跟随时不要额外飞往，留在落点）
  useEffect(() => {
    if (moveActive) setFollowToken(true)
    else setFollowToken(false)
  }, [moveActive, setFollowToken])

  // 仅在阶段真正切换时调整视角，避免状态刷新重复飞往造成镜头跳动
  useEffect(() => {
    const prev = prevPhase.current
    if (prev === phase) return
    prevPhase.current = phase

    if (phase === 'rolling') {
      setActionArmed(false)
      expectArrivalAfter.current = useCameraStore.getState().arrivalSeq
      focusDice()
      return
    }
    if (phase === 'moving') {
      const state = useGameStore.getState().state
      const player = state.players[state.currentPlayerIndex]
      const steps = state.lastDice?.value ?? 0
      const len = state.board.length
      if (!player || player.bankrupt || steps <= 0) {
        setActionArmed(false)
        return
      }
      setActionArmed(false)
      expectArrivalAfter.current = useCameraStore.getState().arrivalSeq
      const startTile = (player.position - steps + len) % len
      focusPlayer(player.id, startTile)
      return
    }

    setActionArmed(false)
    // 掷骰后未走动（如仍在监狱）：回到当前玩家
    if (prev === 'rolling') {
      const state = useGameStore.getState().state
      const player = state.players[state.currentPlayerIndex]
      if (player && !player.bankrupt) focusPlayer(player.id)
    }
  }, [phase, focusDice, focusPlayer])

  // 飞往完成后停顿 1 秒，再解锁掷骰/迈步
  useEffect(() => {
    if (!needsFocusGate) return
    if (arrivalSeq <= expectArrivalAfter.current) return
    const t = window.setTimeout(() => setActionArmed(true), HOLD_AFTER_FOCUS_MS)
    return () => window.clearTimeout(t)
  }, [arrivalSeq, needsFocusGate, phase])

  const onMoveComplete = useCallback(() => {
    if (useGameStore.getState().state.phase !== 'moving') return
    dispatch({ type: 'FINISH_MOVE' })
  }, [dispatch])

  // 兜底：若逐格动画回调未触发，按步数超时后仍落地结算（从真正迈步起算）
  useEffect(() => {
    if (!moveActive || !moveSteps) return
    const ms = moveSteps * STEP_DURATION * 1000 + 800
    const t = window.setTimeout(onMoveComplete, ms)
    return () => window.clearTimeout(t)
  }, [moveActive, moveSteps, onMoveComplete])

  const onSettled = useCallback(
    (die: number) => {
      if (finishLock.current) return
      if (useGameStore.getState().state.phase !== 'rolling') return
      finishLock.current = true
      dispatch({ type: 'FINISH_ROLL', die })
      window.setTimeout(() => {
        finishLock.current = false
      }, 500)
    },
    [dispatch],
  )

  return (
    <Canvas
      shadows
      camera={{ position: [11, 15, 11], fov: 40, near: 0.05, far: 500 }}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      onCreated={({ gl }) => {
        // 禁止右键菜单，方便右键拖拽平移视角
        gl.domElement.addEventListener('contextmenu', (e) => e.preventDefault())
      }}
    >
      <color attach="background" args={['#1a1520']} />
      <fog attach="fog" args={['#1a1520', 40, 280]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[10, 18, 8]}
        intensity={1.35}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={40}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <pointLight position={[-6, 8, -4]} intensity={0.35} color="#ffd6a0" />
      <hemisphereLight args={['#c8d8ff', '#3a2a1a', 0.4]} />

      <BoardMesh
        board={board}
        highlightIndex={highlightIndex}
        properties={properties}
        players={players}
      />
      <Tokens
        players={players}
        boardLength={boardLength}
        movingPlayerId={movingPlayerId}
        moveSteps={moveSteps}
        moveActive={moveActive}
        onMoveComplete={onMoveComplete}
      />

      {inGame && (
        <Suspense fallback={null}>
          <DiceTray
            boardHalf={getBoardMetrics(boardLength).half}
            rollId={logSeq}
            rolling={rollingActive}
            displayValue={lastDice?.value ?? 1}
            onSettled={onSettled}
          />
        </Suspense>
      )}

      <OrbitControls
        makeDefault
        enableRotate
        enablePan
        enableZoom
        screenSpacePanning
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.85}
        panSpeed={0.8}
        zoomSpeed={0.9}
        mouseButtons={ORBIT_MOUSE_BUTTONS}
        touches={ORBIT_TOUCHES}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={0.5}
        maxDistance={200}
        // 不要每帧传入 target，否则状态更新会把镜头拽回原点
      />
      <CameraFocusController players={players} boardLength={boardLength} />
    </Canvas>
  )
}
