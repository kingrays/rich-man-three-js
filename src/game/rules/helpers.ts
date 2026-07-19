import {
  colorGroupTileIds,
  getTile,
} from '../board'
import type { GameState, Player, PropertyState } from '../types'

export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex]!
}

export function getPlayer(state: GameState, id: number): Player {
  const p = state.players.find((x) => x.id === id)
  if (!p) throw new Error(`玩家不存在: ${id}`)
  return p
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.bankrupt)
}

export function addLog(state: GameState, message: string): GameState {
  const id = state.logSeq + 1
  return {
    ...state,
    logSeq: id,
    log: [{ id, message }, ...state.log].slice(0, 80),
  }
}

export function updatePlayer(
  state: GameState,
  playerId: number,
  patch: Partial<Player>,
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, ...patch } : p,
    ),
  }
}

export function updateProperty(
  state: GameState,
  tileId: number,
  patch: Partial<PropertyState>,
): GameState {
  return {
    ...state,
    properties: {
      ...state.properties,
      [tileId]: { ...state.properties[tileId]!, ...patch },
    },
  }
}

/** 计算地产租金（不含公用事业需骰子的情况） */
export function calcPropertyRent(
  state: GameState,
  tileId: number,
  diceTotal?: number,
  railroadMultiplier = 1,
): number {
  const tile = getTile(state, tileId)
  const ps = state.properties[tileId]!
  if (ps.ownerId === null || ps.mortgaged) return 0

  if (tile.type === 'railroad') {
    const count = colorGroupTileIds(state.board, 'railroad').filter(
      (id) =>
        state.properties[id]?.ownerId === ps.ownerId &&
        !state.properties[id]?.mortgaged,
    ).length
    const base = tile.rent![count - 1] ?? 0
    return base * railroadMultiplier
  }

  if (tile.type === 'utility') {
    const count = colorGroupTileIds(state.board, 'utility').filter(
      (id) =>
        state.properties[id]?.ownerId === ps.ownerId &&
        !state.properties[id]?.mortgaged,
    ).length
    const mult = tile.rent![count - 1] ?? 4
    return (diceTotal ?? 0) * mult
  }

  if (tile.type === 'property') {
    const houses = ps.houses
    if (houses > 0) {
      return tile.rent![houses] ?? 0
    }
    // 空地：按基础租金（城市地产已取消色组成套双倍）
    return tile.rent![0] ?? 0
  }

  return 0
}

export function countHousesAndHotels(
  state: GameState,
  playerId: number,
): { houses: number; hotels: number } {
  let houses = 0
  let hotels = 0
  for (const tile of state.board) {
    if (tile.type !== 'property') continue
    const ps = state.properties[tile.id]
    if (!ps || ps.ownerId !== playerId) continue
    if (ps.houses === 5) hotels++
    else houses += ps.houses
  }
  return { houses, hotels }
}

/** 城市地产是否具备建房物理条件（拥有、现金、库存等，不含落地次数） */
export function isBuildEligible(
  state: GameState,
  playerId: number,
  tileId: number,
): boolean {
  const tile = getTile(state, tileId)
  if (tile.type !== 'property' || !tile.houseCost) return false
  const ps = state.properties[tileId]!
  if (ps.ownerId !== playerId || ps.mortgaged || ps.houses >= 5) return false

  const player = getPlayer(state, playerId)
  if (player.cash < tile.houseCost) return false

  if (ps.houses === 4) {
    // 建酒店：需要 1 酒店库存，并归还 4 房屋
    return state.hotelsRemaining >= 1
  }
  return state.housesRemaining >= 1
}

/** 可建造房屋：须拥有落地建房机会，且该格仍满足建房条件 */
export function canBuildHouse(state: GameState, playerId: number, tileId: number): boolean {
  // 仅停靠格的一次机会；用过后 landingBuildTileId 清空则不可再建
  if (state.landingBuildTileId !== tileId) return false
  if (state.phase !== 'manageAssets') return false
  return isBuildEligible(state, playerId, tileId)
}

export function canSellHouse(state: GameState, playerId: number, tileId: number): boolean {
  const tile = getTile(state, tileId)
  if (tile.type !== 'property') return false
  const ps = state.properties[tileId]!
  if (ps.ownerId !== playerId || ps.houses <= 0) return false

  if (ps.houses === 5) {
    // 拆酒店换 4 房屋，银行需有 4 房屋
    return state.housesRemaining >= 4
  }
  return true
}

export function nextPlayerIndex(state: GameState): number {
  const n = state.players.length
  let i = state.currentPlayerIndex
  for (let k = 0; k < n; k++) {
    i = (i + 1) % n
    if (!state.players[i]!.bankrupt) return i
  }
  return state.currentPlayerIndex
}

export function checkWinner(state: GameState): GameState {
  const alive = activePlayers(state)
  if (alive.length === 1) {
    return {
      ...state,
      phase: 'gameOver',
      winnerId: alive[0]!.id,
    }
  }
  return state
}

/** 玩家拥有的地产 id 列表 */
export function ownedProperties(state: GameState, playerId: number): number[] {
  return Object.entries(state.properties)
    .filter(([, ps]) => ps.ownerId === playerId)
    .map(([id]) => Number(id))
}
