import { CITY_POOL, PERMANENT_CITIES } from './cities'
import type { Rng } from './rng'
import { shuffle } from './rng'
import type { GameState, TileDef, TileType } from './types'

/** 可选棋盘规格：边格数（不含角格）→ 总格数 = 4 + 4×边格 */
export type BoardSizeId = 'mini' | 'small' | 'medium' | 'large' | 'xlarge'

export interface BoardSizeOption {
  id: BoardSizeId
  /** 展示名 */
  label: string
  /** 每边中间格数（不含四角） */
  edgeCount: number
  /** 总格数 */
  tileCount: number
}

export const BOARD_SIZE_OPTIONS: BoardSizeOption[] = [
  { id: 'mini', label: '迷你 · 24 格', edgeCount: 5, tileCount: 24 },
  { id: 'small', label: '小号 · 32 格', edgeCount: 7, tileCount: 32 },
  { id: 'medium', label: '中号 · 40 格', edgeCount: 9, tileCount: 40 },
  { id: 'large', label: '大号 · 48 格', edgeCount: 11, tileCount: 48 },
  { id: 'xlarge', label: '超大 · 56 格', edgeCount: 13, tileCount: 56 },
]

/** 默认中号（经典 40 格） */
export const DEFAULT_BOARD_SIZE: BoardSizeId = 'medium'

export const GO_SALARY = 200
export const JAIL_FINE = 50
export const STARTING_CASH = 1500
/** 房屋/酒店库存随最大棋盘略增 */
export const MAX_HOUSES = 48
export const MAX_HOTELS = 16

/** 经典价格曲线，用于按地产数量插值 */
const CLASSIC_PRICES = [
  60, 60, 100, 100, 120, 140, 140, 160, 180, 180, 200, 220, 220, 240, 260, 260,
  280, 300, 300, 320, 350, 400,
]

const RAILROAD_NAMES = ['京沪铁路', '京广铁路', '陇海铁路', '青藏铁路']

/**
 * 各规格格类型布局。
 * G起点 J监狱 F免费停车 X进监狱 P城市 R铁路 U公用事业 C机会 H社区基金 T税
 */
const LAYOUTS: Record<BoardSizeId, string> = {
  // 11 城市 + 2 铁路 + 1 公用
  mini: 'GPHPTRJPUCPPFPCRPPXPHPTP',
  // 15 城市 + 4 铁路 + 2 公用
  small: 'GPHPTRCPJPUPPRPHFPCPPRPUXPPHPRTP',
  // 经典 22 城市
  medium: 'GPHPTRPCPPJPUPPRPHPPFPCPPRPPUPXPPHPRCPTP',
  // 30 城市
  large: 'GPHPTRPCPPPPJPUPPRPHPPPPFPCPPRPPUPPPXPPHPRCPPPTP',
  // 38 城市
  xlarge: 'GPHPTRPCPPPPPPJPUPPRPHPPPPPPFPCPPRPPUPPPPPXPPHPRCPPPPPTP',
}

const CHAR_TO_TYPE: Record<string, TileType> = {
  G: 'go',
  J: 'jail',
  F: 'parking',
  X: 'gotojail',
  P: 'property',
  R: 'railroad',
  U: 'utility',
  C: 'chance',
  H: 'chest',
  T: 'tax',
}

export function getBoardSizeOption(id: BoardSizeId): BoardSizeOption {
  return (
    BOARD_SIZE_OPTIONS.find((o) => o.id === id) ??
    BOARD_SIZE_OPTIONS.find((o) => o.id === DEFAULT_BOARD_SIZE)!
  )
}

/** 由总格数反推每边中间格数 */
export function edgeCountOf(boardLength: number): number {
  return boardLength / 4 - 1
}

/** 每边格数（含该边起点角格） */
export function sideLengthOf(boardLength: number): number {
  return boardLength / 4
}

function pricesForCount(n: number): number[] {
  if (n <= 1) return [400]
  if (n <= CLASSIC_PRICES.length) {
    return Array.from({ length: n }, (_, i) => {
      const idx = Math.round((i * (CLASSIC_PRICES.length - 1)) / (n - 1))
      return CLASSIC_PRICES[idx]!
    })
  }
  // 超出经典数量时线性延伸（超大盘最高可到 $500）
  return Array.from({ length: n }, (_, i) =>
    Math.round(60 + (i / (n - 1)) * 440),
  )
}

/** 由售价推导租金、建房费、抵押价 */
function propertyEconomics(price: number): Pick<
  TileDef,
  'price' | 'rent' | 'houseCost' | 'mortgage'
> {
  const houseCost =
    price <= 120 ? 50 : price <= 200 ? 100 : price <= 280 ? 150 : 200
  const mortgage = Math.floor(price / 2)
  const base = Math.max(2, Math.round(price / 30))
  // 近似经典倍率：空地 → 1～4 房 → 酒店
  const rent = [
    base,
    base * 5,
    base * 15,
    base * 45,
    Math.round(base * 62.5),
    base * 100,
  ]
  return { price, rent, houseCost, mortgage }
}

function taxAmountForIndex(index: number, total: number): number {
  // 前半圈所得税更高，后半圈奢侈税较低（对齐经典）
  return index < total / 2 ? 200 : 100
}

/**
 * 随机生成一局棋盘：北上广深常驻且占最高四档价格，其余城市从池中抽取。
 */
export function generateBoard(sizeId: BoardSizeId, rng: Rng): TileDef[] {
  const layout = LAYOUTS[sizeId]
  const propertySlots: number[] = []
  for (let i = 0; i < layout.length; i++) {
    if (layout[i] === 'P') propertySlots.push(i)
  }

  const propCount = propertySlots.length
  if (propCount < PERMANENT_CITIES.length) {
    throw new Error(`棋盘城市格不足 ${PERMANENT_CITIES.length} 个，无法放入北上广深`)
  }

  const prices = pricesForCount(propCount)
  // 强制最高四档价格给北上广深（价格已升序）
  const topPrices = prices.slice(-PERMANENT_CITIES.length)
  const otherPrices = prices.slice(0, propCount - PERMANENT_CITIES.length)

  const otherNeeded = propCount - PERMANENT_CITIES.length
  const uniquePool = [...new Set(CITY_POOL)].filter(
    (c) => !(PERMANENT_CITIES as readonly string[]).includes(c),
  )
  const pickedOthers = shuffle(uniquePool, rng).slice(0, otherNeeded)
  // 其余城市打乱后配较低价格
  const otherCities = shuffle(pickedOthers, rng)

  // 城市格：前段随机城市（低价），末四格固定北上广深（高价）
  const cityBySlot = new Map<number, { name: string; price: number }>()
  propertySlots.forEach((slot, i) => {
    if (i < otherNeeded) {
      cityBySlot.set(slot, {
        name: otherCities[i]!,
        price: otherPrices[i]!,
      })
    } else {
      const topIdx = i - otherNeeded
      cityBySlot.set(slot, {
        name: PERMANENT_CITIES[topIdx]!,
        price: topPrices[topIdx]!,
      })
    }
  })

  let railroadIdx = 0
  let utilityIdx = 0
  const board: TileDef[] = []

  for (let id = 0; id < layout.length; id++) {
    const ch = layout[id]!
    const type = CHAR_TO_TYPE[ch]
    if (!type) throw new Error(`未知布局字符: ${ch}`)

    if (type === 'property') {
      const city = cityBySlot.get(id)!
      board.push({
        id,
        name: city.name,
        type: 'property',
        ...propertyEconomics(city.price),
      })
      continue
    }

    if (type === 'railroad') {
      board.push({
        id,
        name: RAILROAD_NAMES[railroadIdx % RAILROAD_NAMES.length]!,
        type: 'railroad',
        colorGroup: 'railroad',
        price: 200,
        rent: [25, 50, 100, 200],
        mortgage: 100,
      })
      railroadIdx++
      continue
    }

    if (type === 'utility') {
      board.push({
        id,
        name: utilityIdx === 0 ? '电力公司' : '自来水公司',
        type: 'utility',
        colorGroup: 'utility',
        price: 150,
        rent: [4, 10],
        mortgage: 75,
      })
      utilityIdx++
      continue
    }

    if (type === 'tax') {
      board.push({
        id,
        name: id < layout.length / 2 ? '所得税' : '奢侈税',
        type: 'tax',
        taxAmount: taxAmountForIndex(id, layout.length),
      })
      continue
    }

    const names: Partial<Record<TileType, string>> = {
      go: '起点',
      jail: '监狱 / 只是参观',
      parking: '免费停车',
      gotojail: '进监狱',
      chance: '机会',
      chest: '社区基金',
    }
    board.push({ id, name: names[type] ?? type, type })
  }

  return board
}

/** 默认棋盘（大厅 / 兼容旧逻辑）：大号固定种子，保证可预测 */
export const BOARD: TileDef[] = generateBoard('medium', () => 0.42)

export function getTileFromBoard(board: TileDef[], id: number): TileDef {
  const tile = board[id]
  if (!tile) throw new Error(`格子不存在: ${id}`)
  return tile
}

/** 从本局状态取格定义 */
export function getTile(state: GameState, id: number): TileDef {
  return getTileFromBoard(state.board, id)
}

/** 某色组在本局棋盘上的格子 id */
export function colorGroupTileIds(
  board: TileDef[],
  group: 'railroad' | 'utility',
): number[] {
  return board.filter((t) => t.colorGroup === group).map((t) => t.id)
}

export function findJailPosition(board: TileDef[]): number {
  const t = board.find((x) => x.type === 'jail')
  return t?.id ?? Math.floor(board.length / 4)
}

/** @deprecated 兼容旧引用；请用 findJailPosition(state.board) */
export const JAIL_POSITION = findJailPosition(BOARD)

/** @deprecated 请用 colorGroupTileIds(state.board, group) */
export const COLOR_GROUP_TILES: Record<string, number[]> = {
  railroad: colorGroupTileIds(BOARD, 'railroad'),
  utility: colorGroupTileIds(BOARD, 'utility'),
}
