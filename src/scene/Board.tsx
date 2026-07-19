import { useMemo, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { CanvasTexture, type Texture } from 'three'
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
/** 棋盘表面高度（格子顶面） */
export const BOARD_SURFACE_Y = 0.15

const TILE_H = 0.12

/** 由总格数计算棋盘几何参数 */
export function getBoardMetrics(boardLength: number) {
  const edgeCount = boardLength / 4 - 1
  const side = CORNER * 2 + EDGE_W * edgeCount
  const half = side / 2
  /** 每边格数（含该边起点角格） */
  const sideLen = boardLength / 4
  return { edgeCount, side, half, sideLen }
}

/** 默认大号棋盘尺寸（兼容骰子等未传参场景） */
export const BOARD_SIDE = getBoardMetrics(40).side
export const BOARD_HALF = getBoardMetrics(40).half

/**
 * 格子中心世界坐标。
 * 0=起点(右下角)，逆时针：底边← 左边↑ 顶边→ 右边↓
 */
export function tileWorldPosition(
  index: number,
  boardLength = 40,
): [number, number, number] {
  const { half, sideLen } = getBoardMetrics(boardLength)
  const side = Math.floor(index / sideLen)
  const i = index % sideLen
  const y = 0.08

  if (side === 0) {
    if (i === 0) return [half - CORNER / 2, y, half - CORNER / 2]
    const x = half - CORNER - EDGE_W * (i - 0.5)
    return [x, y, half - EDGE_D / 2]
  }
  if (side === 1) {
    if (i === 0) return [-(half - CORNER / 2), y, half - CORNER / 2]
    const z = half - CORNER - EDGE_W * (i - 0.5)
    return [-(half - EDGE_D / 2), y, z]
  }
  if (side === 2) {
    if (i === 0) return [-(half - CORNER / 2), y, -(half - CORNER / 2)]
    const x = -(half - CORNER) + EDGE_W * (i - 0.5)
    return [x, y, -(half - EDGE_D / 2)]
  }
  if (i === 0) return [half - CORNER / 2, y, -(half - CORNER / 2)]
  const z = -(half - CORNER) + EDGE_W * (i - 0.5)
  return [half - EDGE_D / 2, y, z]
}

function tileSize(index: number, boardLength: number): [number, number, number] {
  const { sideLen } = getBoardMetrics(boardLength)
  if (index % sideLen === 0) return [CORNER * 0.96, TILE_H, CORNER * 0.96]
  const side = Math.floor(index / sideLen)
  if (side === 0 || side === 2) return [EDGE_W * 0.9, TILE_H, EDGE_D * 0.94]
  return [EDGE_D * 0.94, TILE_H, EDGE_W * 0.9]
}

/** 城市等地产：暖色羊皮纸标签 */
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

/**
 * 公用事业专用标签：冷色钢板 + 网格，与城市羊皮纸明显区分
 * @param accent 电力偏琥珀 / 水务偏青蓝
 */
function createUtilityLabelTexture(
  title: string,
  subtitle: string | undefined,
  accent: 'electric' | 'water',
): Texture {
  const w = 512
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const accentHi = accent === 'electric' ? '#e8b84a' : '#4ec4d9'
  const accentMid = accent === 'electric' ? '#c9922a' : '#2a9bb0'

  // 冷灰钢板底
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#3a4550')
  g.addColorStop(0.45, '#2c353e')
  g.addColorStop(1, '#232a32')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // 细网格：工业设施感
  ctx.strokeStyle = 'rgba(120,160,180,0.12)'
  ctx.lineWidth = 1
  for (let x = 32; x < w; x += 28) {
    ctx.beginPath()
    ctx.moveTo(x, 24)
    ctx.lineTo(x, h - 24)
    ctx.stroke()
  }
  for (let y = 32; y < h; y += 28) {
    ctx.beginPath()
    ctx.moveTo(24, y)
    ctx.lineTo(w - 24, y)
    ctx.stroke()
  }

  // 顶部色带
  const band = ctx.createLinearGradient(0, 0, w, 0)
  band.addColorStop(0, accentMid)
  band.addColorStop(0.5, accentHi)
  band.addColorStop(1, accentMid)
  ctx.fillStyle = band
  ctx.fillRect(28, 28, w - 56, 36)

  // 金属外框
  ctx.strokeStyle = 'rgba(180,210,220,0.45)'
  ctx.lineWidth = 8
  ctx.strokeRect(18, 18, w - 36, h - 36)
  ctx.strokeStyle = accentHi
  ctx.lineWidth = 3
  ctx.strokeRect(28, 28, w - 56, h - 56)

  ctx.fillStyle = '#e8f0f4'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 50px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif'
  wrapText(ctx, title, w / 2, subtitle ? h * 0.48 : h * 0.55, w - 80, 56)

  if (subtitle) {
    ctx.font = '38px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif'
    ctx.fillStyle = accentHi
    ctx.fillText(subtitle, w / 2, h * 0.72)
  }

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = 'srgb'
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/** 铁路专用标签：深炭底 + 轨枕条纹 + 黄铜点缀 */
function createRailroadLabelTexture(title: string, subtitle?: string): Texture {
  const w = 512
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const brassHi = '#d4a84b'
  const brassMid = '#a87e2e'

  // 深炭黑底（偏暖，有别于公用事业冷钢）
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#2a2420')
  g.addColorStop(0.5, '#1c1916')
  g.addColorStop(1, '#141210')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // 轨枕横纹
  ctx.fillStyle = 'rgba(90,70,45,0.35)'
  for (let y = 48; y < h - 40; y += 36) {
    ctx.fillRect(40, y, w - 80, 14)
  }
  // 双轨纵线
  ctx.strokeStyle = 'rgba(200,170,100,0.35)'
  ctx.lineWidth = 5
  for (const x of [w * 0.38, w * 0.62]) {
    ctx.beginPath()
    ctx.moveTo(x, 70)
    ctx.lineTo(x, h - 50)
    ctx.stroke()
  }

  // 顶部黄铜色带
  const band = ctx.createLinearGradient(0, 0, w, 0)
  band.addColorStop(0, brassMid)
  band.addColorStop(0.5, brassHi)
  band.addColorStop(1, brassMid)
  ctx.fillStyle = band
  ctx.fillRect(28, 28, w - 56, 36)

  ctx.strokeStyle = 'rgba(200,170,100,0.4)'
  ctx.lineWidth = 8
  ctx.strokeRect(18, 18, w - 36, h - 36)
  ctx.strokeStyle = brassHi
  ctx.lineWidth = 3
  ctx.strokeRect(28, 28, w - 56, h - 56)

  ctx.fillStyle = '#f0e6d0'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 48px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif'
  wrapText(ctx, title, w / 2, subtitle ? h * 0.48 : h * 0.55, w - 80, 54)

  if (subtitle) {
    ctx.font = '38px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif'
    ctx.fillStyle = brassHi
    ctx.fillText(subtitle, w / 2, h * 0.72)
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
    // 公用事业：冷钢色，与城市羊皮纸区分
    case 'utility':
      return tile.id === 12 ? '#4a5560' : '#3d5a68'
    // 铁路：深炭暖灰，有别于公用事业冷钢
    case 'railroad':
      return '#3a322c'
    default:
      return '#ebe2cd'
  }
}

function TileBlock({
  tile,
  highlight,
  prop,
  owner,
  boardLength,
}: {
  tile: TileDef
  highlight: boolean
  prop?: PropertyState
  owner?: Player | null
  /** 本局总格数，用于坐标与朝向 */
  boardLength: number
}) {
  const size = tileSize(tile.id, boardLength)
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
    // 公用事业 / 铁路用专属标签，与城市羊皮纸区分
    if (tile.type === 'utility') {
      return createUtilityLabelTexture(
        tile.name,
        sub,
        tile.name.includes('电') ? 'electric' : 'water',
      )
    }
    if (tile.type === 'railroad') {
      return createRailroadLabelTexture(tile.name, sub)
    }
    return createTileLabelTexture(tile.name, sub)
  }, [tile])

  const topY = size[1] / 2
  const isUtility = tile.type === 'utility'
  const isRailroad = tile.type === 'railroad'
  // 特殊地产格：材质与边框走工业风
  const isSpecialLot = isUtility || isRailroad
  const accentColor = isRailroad
    ? '#d4a84b'
    : tile.name.includes('电')
      ? '#e8b84a'
      : '#4ec4d9'

  // 买下后保持纸面可读；抵押发灰；特殊格购入后仍偏工业色
  const bodyColor = mortgaged
    ? '#9a9388'
    : owned
      ? isUtility
        ? '#5a6a78'
        : isRailroad
          ? '#4a4038'
          : '#f4ede8'
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
  const side = Math.floor(tile.id / (boardLength / 4))
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
    <group position={tileWorldPosition(tile.id, boardLength)}>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[size[0] * 1.04, 0.04, size[2] * 1.04]} />
        <meshStandardMaterial
          color={isSpecialLot ? (isRailroad ? '#2a221c' : '#3a454e') : '#5c4330'}
          roughness={0.9}
          metalness={isSpecialLot ? 0.35 : 0}
        />
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
          roughness={mortgaged ? 0.95 : isSpecialLot ? 0.45 : 0.75}
          metalness={isSpecialLot ? 0.28 : 0.02}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      {/* 铁路 / 公用事业：顶面金属色框 */}
      {isSpecialLot && !mortgaged && (
        <SpecialLotAccentFrame
          w={size[0]}
          d={size[2]}
          y={topY + bodyY + 0.01}
          color={accentColor}
        />
      )}

      <group rotation={[0, labelYaw(tile.id, boardLength), 0]}>
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
          <planeGeometry args={labelPlaneSize(tile.id, size, boardLength)} />
          <meshStandardMaterial
            map={label}
            roughness={isSpecialLot ? 0.55 : 0.88}
            metalness={isSpecialLot ? 0.15 : 0}
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
          kind={tile.name.includes('电') ? 'electric' : 'water'}
          position={edgeIconPos(side, size, bodyY, topY)}
        />
      )}

      {/* 城市空地契立牌；铁路/公用事业已有专属模型，不再叠立牌 */}
      {owned &&
        owner &&
        houses === 0 &&
        !mortgaged &&
        tile.type === 'property' && (
        <DeedMarker
          color={owner.color}
          position={edgeIconPos(side, size, bodyY, topY)}
          yaw={labelYaw(tile.id, boardLength)}
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

/** 特殊地产格顶面细色框（铁路黄铜 / 电力琥珀 / 水务青蓝） */
function SpecialLotAccentFrame({
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
  const t = 0.028
  const h = 0.018
  return (
    <group>
      <mesh position={[0, y, d / 2 - t / 2]}>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color={color} metalness={0.65} roughness={0.28} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, y, -(d / 2 - t / 2)]}>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color={color} metalness={0.65} roughness={0.28} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[w / 2 - t / 2, y, 0]}>
        <boxGeometry args={[t, h, d - t * 2]} />
        <meshStandardMaterial color={color} metalness={0.65} roughness={0.28} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[-(w / 2 - t / 2), y, 0]}>
        <boxGeometry args={[t, h, d - t * 2]} />
        <meshStandardMaterial color={color} metalness={0.65} roughness={0.28} emissive={color} emissiveIntensity={0.15} />
      </mesh>
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
function labelYaw(index: number, boardLength: number): number {
  const side = Math.floor(index / (boardLength / 4))
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
  boardLength: number,
): [number, number] {
  const side = Math.floor(index / (boardLength / 4))
  if (side === 0 || side === 2) {
    // size: [沿边, 高, 径向]
    return [size[0] * 0.84, size[2] * 0.48]
  }
  // size: [径向, 高, 沿边] — 旋转后 groupX↔沿边, 径向↔原 size[0]
  return [size[2] * 0.84, size[0] * 0.48]
}

interface BoardMeshProps {
  board: TileDef[]
  highlightIndex: number | null
  properties: Record<number, PropertyState>
  players: Player[]
}

/** 中心绒面：深绿底 + 细密织纹 */
function createCenterFeltTexture(): Texture {
  const w = 512
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.72)
  g.addColorStop(0, '#2a7a48')
  g.addColorStop(0.55, '#1f5c38')
  g.addColorStop(1, '#16452a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // 细密绒毛噪点
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    ctx.fillStyle = `rgba(${20 + Math.random() * 40},${80 + Math.random() * 60},${30 + Math.random() * 30},${0.04 + Math.random() * 0.06})`
    ctx.fillRect(x, y, 1.5, 1.5)
  }

  // 淡菱形织纹
  ctx.strokeStyle = 'rgba(255,255,220,0.04)'
  ctx.lineWidth = 1
  for (let i = -h; i < w + h; i += 28) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + h, h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(i, h)
    ctx.lineTo(i + h, 0)
    ctx.stroke()
  }

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = 'srgb'
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/** 中心品牌铭牌：大富翁 + 副标题 */
function createBrandPlaqueTexture(): Texture {
  const w = 1024
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  // 深木漆底
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#3a2818')
  g.addColorStop(0.4, '#2a1c10')
  g.addColorStop(1, '#1a120a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // 木纹细线
  for (let i = 0; i < 40; i++) {
    const y = (i / 40) * h
    ctx.strokeStyle = `rgba(90,60,30,${0.08 + Math.random() * 0.1})`
    ctx.lineWidth = 1 + Math.random() * 2
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(w * 0.3, y + 8, w * 0.7, y - 6, w, y + 4)
    ctx.stroke()
  }

  // 外金框
  ctx.strokeStyle = '#c9a227'
  ctx.lineWidth = 14
  ctx.strokeRect(28, 28, w - 56, h - 56)
  ctx.strokeStyle = '#e8c84a'
  ctx.lineWidth = 3
  ctx.strokeRect(48, 48, w - 96, h - 96)

  // 四角装饰短线
  ctx.strokeStyle = '#d4af37'
  ctx.lineWidth = 4
  const corner = 72
  for (const [cx, cy, sx, sy] of [
    [corner, corner, 1, 1],
    [w - corner, corner, -1, 1],
    [corner, h - corner, 1, -1],
    [w - corner, h - corner, -1, -1],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(cx, cy + sy * 36)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + sx * 36, cy)
    ctx.stroke()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // 品牌主标题阴影 + 金字
  ctx.font = 'bold 148px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif'
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillText('大富翁', w / 2 + 4, h * 0.42 + 4)
  const tg = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.55)
  tg.addColorStop(0, '#f5e6a8')
  tg.addColorStop(0.45, '#d4af37')
  tg.addColorStop(1, '#a67c1a')
  ctx.fillStyle = tg
  ctx.fillText('大富翁', w / 2, h * 0.42)

  // 分隔短线
  ctx.strokeStyle = 'rgba(212,175,55,0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(w * 0.28, h * 0.62)
  ctx.lineTo(w * 0.72, h * 0.62)
  ctx.stroke()

  ctx.font = '36px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif'
  ctx.fillStyle = '#c4b896'
  ctx.fillText('经典规则 · 本机对战', w / 2, h * 0.74)

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = 'srgb'
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/** 棋盘中心广场：绒面、木框、品牌铭牌与角饰 */
function BoardCenterPlaza({ size }: { size: number }) {
  const felt = useMemo(() => createCenterFeltTexture(), [])
  const plaque = useMemo(() => createBrandPlaqueTexture(), [])

  const moldIn = size - 0.28
  const moldT = 0.14
  const rail = size - 0.95
  const plaqueW = 4.4
  const plaqueD = 2.0
  const cornerPad = size * 0.32

  return (
    <group>
      {/* 绒面草坪 */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[size, 0.05, size]} />
        <meshStandardMaterial map={felt} roughness={0.92} metalness={0} />
      </mesh>

      {/* 内沿木框镶边（四边条，不盖住中央绒面） */}
      <mesh position={[0, 0.055, moldIn / 2 - moldT / 2]} receiveShadow castShadow>
        <boxGeometry args={[moldIn, 0.045, moldT]} />
        <meshStandardMaterial color="#5a3c28" roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.055, -(moldIn / 2 - moldT / 2)]} receiveShadow castShadow>
        <boxGeometry args={[moldIn, 0.045, moldT]} />
        <meshStandardMaterial color="#5a3c28" roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh position={[moldIn / 2 - moldT / 2, 0.055, 0]} receiveShadow castShadow>
        <boxGeometry args={[moldT, 0.045, moldIn - moldT * 2]} />
        <meshStandardMaterial color="#5a3c28" roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh position={[-(moldIn / 2 - moldT / 2), 0.055, 0]} receiveShadow castShadow>
        <boxGeometry args={[moldT, 0.045, moldIn - moldT * 2]} />
        <meshStandardMaterial color="#5a3c28" roughness={0.72} metalness={0.08} />
      </mesh>
      {/* 木框内侧金线 */}
      <mesh position={[0, 0.07, moldIn / 2 - moldT - 0.02]} castShadow>
        <boxGeometry args={[moldIn - moldT * 2, 0.015, 0.03]} />
        <meshStandardMaterial color="#c9a227" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.07, -(moldIn / 2 - moldT - 0.02)]} castShadow>
        <boxGeometry args={[moldIn - moldT * 2, 0.015, 0.03]} />
        <meshStandardMaterial color="#c9a227" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[moldIn / 2 - moldT - 0.02, 0.07, 0]} castShadow>
        <boxGeometry args={[0.03, 0.015, moldIn - moldT * 2 - 0.04]} />
        <meshStandardMaterial color="#c9a227" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[-(moldIn / 2 - moldT - 0.02), 0.07, 0]} castShadow>
        <boxGeometry args={[0.03, 0.015, moldIn - moldT * 2 - 0.04]} />
        <meshStandardMaterial color="#c9a227" metalness={0.65} roughness={0.3} />
      </mesh>

      {/* 黄铜细轨装饰矩形（更靠内） */}
      <mesh position={[0, 0.068, rail / 2]} castShadow>
        <boxGeometry args={[rail, 0.018, 0.035]} />
        <meshStandardMaterial color="#b8922e" metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.068, -rail / 2]} castShadow>
        <boxGeometry args={[rail, 0.018, 0.035]} />
        <meshStandardMaterial color="#b8922e" metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[rail / 2, 0.068, 0]} castShadow>
        <boxGeometry args={[0.035, 0.018, rail]} />
        <meshStandardMaterial color="#b8922e" metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[-rail / 2, 0.068, 0]} castShadow>
        <boxGeometry args={[0.035, 0.018, rail]} />
        <meshStandardMaterial color="#b8922e" metalness={0.7} roughness={0.28} />
      </mesh>

      {/* 四角黄铜菱形饰 */}
      {(
        [
          [cornerPad, cornerPad],
          [cornerPad, -cornerPad],
          [-cornerPad, cornerPad],
          [-cornerPad, -cornerPad],
        ] as const
      ).map(([x, z], i) => (
        <group key={i} position={[x, 0.075, z]} rotation={[0, Math.PI / 4, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.03, 0.42]} />
            <meshStandardMaterial color="#2a1c10" metalness={0.35} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.02, 0]} castShadow>
            <boxGeometry args={[0.28, 0.025, 0.28]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.75}
              roughness={0.25}
              emissive="#a67c1a"
              emissiveIntensity={0.12}
            />
          </mesh>
        </group>
      ))}

      {/* 铭牌底座（深木） */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[plaqueW + 0.35, 0.06, plaqueD + 0.35]} />
        <meshStandardMaterial color="#2a1c10" metalness={0.3} roughness={0.48} />
      </mesh>
      {/* 铭牌金边托 */}
      <mesh position={[0, 0.095, 0]} castShadow>
        <boxGeometry args={[plaqueW + 0.12, 0.035, plaqueD + 0.12]} />
        <meshStandardMaterial color="#c9a227" metalness={0.65} roughness={0.28} />
      </mesh>
      {/* 铭牌贴面（带文字） */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[plaqueW, 0.04, plaqueD]} />
        <meshStandardMaterial color="#2a1c10" metalness={0.25} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.145, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[plaqueW * 0.94, plaqueD * 0.88]} />
        <meshStandardMaterial
          map={plaque}
          roughness={0.55}
          metalness={0.2}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* 铭牌两侧小立柱装饰 */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * (plaqueW / 2 + 0.28), 0.06, 0]}>
          <mesh position={[0, 0.08, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, 0.16, 8]} />
            <meshStandardMaterial color="#3a2818" roughness={0.6} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.18, 0]} castShadow>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial
              color="#d4af37"
              metalness={0.7}
              roughness={0.25}
              emissive="#a67c1a"
              emissiveIntensity={0.15}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function BoardMesh({ board, highlightIndex, properties, players }: BoardMeshProps) {
  const playerById = useMemo(() => {
    const m = new Map<number, Player>()
    for (const p of players) m.set(p.id, p)
    return m
  }, [players])

  const boardLength = board.length
  const { side: boardSide } = getBoardMetrics(boardLength)
  const inner = boardSide - CORNER * 2 + 0.15
  const frame = boardSide + 0.55

  return (
    <group>
      {/* 厚实木底板 */}
      <mesh position={[0, -0.12, 0]} receiveShadow castShadow>
        <boxGeometry args={[frame, 0.22, frame]} />
        <meshStandardMaterial color="#4a3222" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* 木框内沿 */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[boardSide + 0.2, 0.06, boardSide + 0.2]} />
        <meshStandardMaterial color="#6b4a32" roughness={0.8} />
      </mesh>

      <BoardCenterPlaza size={inner} />

      {board.map((tile) => {
        const prop = properties[tile.id]
        const owner =
          prop?.ownerId != null ? playerById.get(prop.ownerId) ?? null : null
        return (
          <TileBlock
            key={tile.id}
            tile={tile}
            boardLength={boardLength}
            highlight={highlightIndex === tile.id}
            prop={prop}
            owner={owner}
          />
        )
      })}
    </group>
  )
}
