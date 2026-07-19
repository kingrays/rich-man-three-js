import { useMemo, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { CanvasTexture, type Texture } from 'three'
import { BOARD } from '../game/board'
import type { Player, PropertyState, TileDef } from '../game/types'
import { useUiStore } from '../store/uiStore'
import {
  DeedMarker,
  edgeBuildPos,
  edgeIconPos,
  HouseModel,
  OwnerFrame,
  SkyscraperModel,
  TrainModel,
  UtilityModel,
} from './Buildings'

/** 拖拽超过此像素则视为旋转视角，不当作点击 */
const CLICK_MOVE_THRESHOLD = 6
/** 点击闪光动画时长（毫秒） */
const FLASH_MS = 280

/** 角格边长、边格宽度、边格进深 */
export const CORNER = 1.6
export const EDGE_W = 0.95
export const EDGE_D = 1.4
export const BOARD_SIDE = CORNER * 2 + EDGE_W * 9
export const BOARD_HALF = BOARD_SIDE / 2
/** 棋盘表面高度（格子顶面） */
export const BOARD_SURFACE_Y = 0.15

const SIDE = BOARD_SIDE
const HALF = BOARD_HALF
const TILE_H = 0.12

/**
 * 格子中心世界坐标。
 * 0=起点(右下角)，逆时针：底边← 左边↑ 顶边→ 右边↓
 */
export function tileWorldPosition(index: number): [number, number, number] {
  const side = Math.floor(index / 10)
  const i = index % 10
  const y = 0.08

  if (side === 0) {
    if (i === 0) return [HALF - CORNER / 2, y, HALF - CORNER / 2]
    const x = HALF - CORNER - EDGE_W * (i - 0.5)
    return [x, y, HALF - EDGE_D / 2]
  }
  if (side === 1) {
    if (i === 0) return [-(HALF - CORNER / 2), y, HALF - CORNER / 2]
    const z = HALF - CORNER - EDGE_W * (i - 0.5)
    return [-(HALF - EDGE_D / 2), y, z]
  }
  if (side === 2) {
    if (i === 0) return [-(HALF - CORNER / 2), y, -(HALF - CORNER / 2)]
    const x = -(HALF - CORNER) + EDGE_W * (i - 0.5)
    return [x, y, -(HALF - EDGE_D / 2)]
  }
  if (i === 0) return [HALF - CORNER / 2, y, -(HALF - CORNER / 2)]
  const z = -(HALF - CORNER) + EDGE_W * (i - 0.5)
  return [HALF - EDGE_D / 2, y, z]
}

function tileSize(index: number): [number, number, number] {
  if (index % 10 === 0) return [CORNER * 0.96, TILE_H, CORNER * 0.96]
  const side = Math.floor(index / 10)
  if (side === 0 || side === 2) return [EDGE_W * 0.9, TILE_H, EDGE_D * 0.94]
  return [EDGE_D * 0.94, TILE_H, EDGE_W * 0.9]
}

function createTileLabelTexture(title: string, subtitle?: string): Texture {
  const w = 512
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  // 羊皮纸底
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#f3ead6')
  g.addColorStop(0.5, '#ebe0c8')
  g.addColorStop(1, '#e2d4b5')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    ctx.fillStyle = `rgba(120,90,40,${Math.random() * 0.05})`
    ctx.fillRect(x, y, 2, 2)
  }

  ctx.strokeStyle = 'rgba(90,70,40,0.28)'
  ctx.lineWidth = 10
  ctx.strokeRect(16, 16, w - 32, h - 32)

  ctx.fillStyle = '#2c2114'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 52px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif'
  wrapText(ctx, title, w / 2, subtitle ? h * 0.4 : h * 0.5, w - 72, 58)

  if (subtitle) {
    ctx.font = '40px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif'
    ctx.fillStyle = '#6b5535'
    ctx.fillText(subtitle, w / 2, h * 0.7)
  }

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = 'srgb'
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const chars = [...text]
  let line = ''
  const lines: string[] = []
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  const startY = y - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight))
}

function baseTileColor(tile: TileDef): string {
  switch (tile.type) {
    case 'go':
      return '#2d8f5a'
    case 'jail':
      return '#c5c0b4'
    case 'gotojail':
      return '#a33b35'
    case 'parking':
      return '#8a9a8e'
    case 'chance':
      return '#d4822a'
    case 'chest':
      return '#3a7ebd'
    case 'tax':
      return '#7a4fa0'
    default:
      return '#ebe2cd'
  }
}

function TileBlock({
  tile,
  highlight,
  prop,
  owner,
}: {
  tile: TileDef
  highlight: boolean
  prop?: PropertyState
  owner?: Player | null
}) {
  const size = tileSize(tile.id)
  const owned = prop?.ownerId != null
  const mortgaged = !!prop?.mortgaged
  const houses = prop?.houses ?? 0
  const inspectTile = useUiStore((s) => s.inspectTile)

  const [pressed, setPressed] = useState(false)
  const [flash, setFlash] = useState(false)
  const [hovered, setHovered] = useState(false)
  const pointerDown = useRef<{ x: number; y: number } | null>(null)
  const flashTimer = useRef<number | null>(null)

  const label = useMemo(() => {
    let sub: string | undefined
    if (tile.price) sub = `$${tile.price}`
    if (tile.type === 'tax') sub = `$${tile.taxAmount}`
    if (tile.type === 'go') sub = '领取 $200'
    return createTileLabelTexture(tile.name, sub)
  }, [tile])

  const topY = size[1] / 2

  // 买下后保持纸面可读；抵押发灰（街道已无色带）
  const bodyColor = mortgaged
    ? '#9a9388'
    : owned
      ? '#f4ede8'
      : baseTileColor(tile)
  const lift = owned ? 0.02 : 0
  // 按下略下沉；点击后短暂抬起闪光
  const pressDip = pressed ? -0.025 : flash ? 0.03 : hovered ? 0.012 : 0
  const emissive = flash
    ? '#f0d060'
    : highlight
      ? '#d4a84b'
      : hovered
        ? '#c4a35a'
        : '#000000'
  const emissiveIntensity = flash ? 0.7 : highlight ? 0.35 : hovered ? 0.18 : 0
  const side = Math.floor(tile.id / 10)
  const bodyY = lift + pressDip

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    pointerDown.current = { x: e.clientX, y: e.clientY }
    setPressed(true)
  }

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const start = pointerDown.current
    pointerDown.current = null
    setPressed(false)
    if (!start) return
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
    // 拖拽旋转视角时不触发格子点击
    if (moved > CLICK_MOVE_THRESHOLD) return

    if (flashTimer.current != null) window.clearTimeout(flashTimer.current)
    setFlash(true)
    flashTimer.current = window.setTimeout(() => setFlash(false), FLASH_MS)
    inspectTile(tile.id)
  }

  const onPointerOut = () => {
    pointerDown.current = null
    setPressed(false)
    setHovered(false)
    document.body.style.cursor = 'auto'
  }

  return (
    <group position={tileWorldPosition(tile.id)}>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[size[0] * 1.04, 0.04, size[2] * 1.04]} />
        <meshStandardMaterial color="#5c4330" roughness={0.9} />
      </mesh>

      {/* 可点击主体：按下下沉 + 悬停/点击发光 */}
      <mesh
        castShadow
        receiveShadow
        position={[0, bodyY, 0]}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={onPointerOut}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={mortgaged ? 0.95 : 0.75}
          metalness={0.02}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      <group rotation={[0, labelYaw(tile.id), 0]}>
        <mesh
          position={[0, topY + bodyY + 0.008, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={onPointerOut}
        >
          <planeGeometry args={labelPlaneSize(tile.id, size)} />
          <meshStandardMaterial
            map={label}
            roughness={0.88}
            metalness={0}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      </group>

      {owned && owner && !mortgaged && (
        <OwnerFrame w={size[0]} d={size[2]} y={topY + bodyY + 0.012} color={owner.color} />
      )}

      {tile.type === 'railroad' && (
        <TrainModel position={edgeIconPos(side, size, bodyY, topY)} />
      )}
      {tile.type === 'utility' && (
        <UtilityModel
          kind={tile.id === 12 ? 'electric' : 'water'}
          position={edgeIconPos(side, size, bodyY, topY)}
        />
      )}

      {owned && owner && houses === 0 && !mortgaged && (
        <DeedMarker
          color={owner.color}
          position={edgeIconPos(side, size, bodyY, topY)}
          yaw={labelYaw(tile.id)}
        />
      )}

      {houses > 0 && houses < 5 && (
        <group position={edgeBuildPos(side, size, bodyY, topY)}>
          {Array.from({ length: houses }).map((_, i) => {
            const spread = (i - (houses - 1) / 2) * 0.22
            return (
              <HouseModel
                key={i}
                position={side % 2 === 0 ? [spread, 0, 0] : [0, 0, spread]}
              />
            )
          })}
        </group>
      )}

      {houses === 5 && (
        <SkyscraperModel position={edgeBuildPos(side, size, bodyY, topY)} />
      )}

      {mortgaged && (
        <mesh position={[0, topY + bodyY + 0.04, 0]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[Math.min(size[0], size[2]) * 0.7, 0.03, 0.05]} />
          <meshStandardMaterial color="#5a5048" />
        </mesh>
      )}
    </group>
  )
}

/**
 * 父级 group 绕世界 Y 旋转，使子平面「字顶」(平铺后指向 group -Z) 朝向盘心。
 * - 底边(0)：盘心 -Z → yaw 0
 * - 左边(1)：盘心 +X → yaw -π/2
 * - 顶边(2)：盘心 +Z → yaw π
 * - 右边(3)：盘心 -X → yaw π/2
 */
function labelYaw(index: number): number {
  const side = Math.floor(index / 10)
  if (side === 0) return 0
  if (side === 1) return -Math.PI / 2
  if (side === 2) return Math.PI
  return Math.PI / 2
}

/**
 * 平面尺寸写在「yaw=0 的 group 局部」：宽沿 group X（底边的世界 X），
 * 高沿 group Y（平铺后指向盘心方向的径向）。
 * 左右边的 size 轴向与底顶不同，需互换。
 */
function labelPlaneSize(
  index: number,
  size: [number, number, number],
): [number, number] {
  const side = Math.floor(index / 10)
  if (side === 0 || side === 2) {
    // size: [沿边, 高, 径向]
    return [size[0] * 0.84, size[2] * 0.48]
  }
  // size: [径向, 高, 沿边] — 旋转后 groupX↔沿边, 径向↔原 size[0]
  return [size[2] * 0.84, size[0] * 0.48]
}

interface BoardMeshProps {
  highlightIndex: number | null
  properties: Record<number, PropertyState>
  players: Player[]
}

export function BoardMesh({ highlightIndex, properties, players }: BoardMeshProps) {
  const playerById = useMemo(() => {
    const m = new Map<number, Player>()
    for (const p of players) m.set(p.id, p)
    return m
  }, [players])

  const inner = SIDE - CORNER * 2 + 0.15
  const frame = SIDE + 0.55

  return (
    <group>
      {/* 厚实木底板 */}
      <mesh position={[0, -0.12, 0]} receiveShadow castShadow>
        <boxGeometry args={[frame, 0.22, frame]} />
        <meshStandardMaterial color="#4a3222" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* 木框内沿 */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[SIDE + 0.2, 0.06, SIDE + 0.2]} />
        <meshStandardMaterial color="#6b4a32" roughness={0.8} />
      </mesh>

      {/* 中心绒面草坪 */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[inner, 0.05, inner]} />
        <meshStandardMaterial color="#1f5c38" roughness={0.95} />
      </mesh>
      {/* 中心铭牌 */}
      <mesh position={[0, 0.055, 0]} castShadow>
        <boxGeometry args={[4.2, 0.06, 1.8]} />
        <meshStandardMaterial color="#2a1c10" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[3.6, 0.03, 1.2]} />
        <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.3} />
      </mesh>

      {BOARD.map((tile) => {
        const prop = properties[tile.id]
        const owner =
          prop?.ownerId != null ? playerById.get(prop.ownerId) ?? null : null
        return (
          <TileBlock
            key={tile.id}
            tile={tile}
            highlight={highlightIndex === tile.id}
            prop={prop}
            owner={owner}
          />
        )
      })}
    </group>
  )
}
