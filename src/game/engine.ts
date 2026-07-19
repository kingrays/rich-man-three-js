import {
  BOARD,
  GO_SALARY,
  JAIL_FINE,
  JAIL_POSITION,
  MAX_HOTELS,
  MAX_HOUSES,
  STARTING_CASH,
  getTile,
} from './board'
import { CHANCE_CARDS, CHEST_CARDS, getCard } from './cards'
import type {
  AuctionState,
  GameAction,
  GameState,
  Player,
  PropertyState,
  TradeOffer,
} from './types'
import {
  addLog,
  calcPropertyRent,
  canBuildHouse,
  canSellHouse,
  checkWinner,
  countHousesAndHotels,
  currentPlayer,
  getPlayer,
  isBuildEligible,
  nextPlayerIndex,
  ownedProperties,
  updatePlayer,
  updateProperty,
} from './rules/helpers'
import { createRng, rollDie, shuffle, type Rng } from './rng'

let rng: Rng = createRng()

/** 测试时可注入固定随机源 */
export function setRng(next: Rng) {
  rng = next
}

function initialProperties(): Record<number, PropertyState> {
  const props: Record<number, PropertyState> = {}
  for (const tile of BOARD) {
    if (
      tile.type === 'property' ||
      tile.type === 'railroad' ||
      tile.type === 'utility'
    ) {
      props[tile.id] = { ownerId: null, houses: 0, mortgaged: false }
    }
  }
  return props
}

export function createLobbyState(): GameState {
  return {
    phase: 'lobby',
    players: [],
    currentPlayerIndex: 0,
    properties: initialProperties(),
    chanceDeck: [],
    chestDeck: [],
    chanceDiscard: [],
    chestDiscard: [],
    lastDice: null,
    auction: null,
    trade: null,
    debt: null,
    pendingPurchaseTileId: null,
    landingBuildTileId: null,
    pendingRent: null,
    lastCardText: null,
    winnerId: null,
    log: [],
    logSeq: 0,
    housesRemaining: MAX_HOUSES,
    hotelsRemaining: MAX_HOTELS,
    startingCash: STARTING_CASH,
    goSalary: GO_SALARY,
  }
}

function clampMoney(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  // 开局/过起点金币至少为 0，避免负数规则
  return Math.max(0, Math.floor(value))
}

function startGame(
  state: GameState,
  action: Extract<GameAction, { type: 'START_GAME' }>,
): GameState {
  const players = action.players
  if (players.length < 2 || players.length > 4) {
    return addLog(state, '玩家人数须为 2–4 人')
  }
  const startingCash = clampMoney(action.startingCash, STARTING_CASH)
  const goSalary = clampMoney(action.goSalary, GO_SALARY)
  const gamePlayers: Player[] = players.map((p, i) => ({
    id: i,
    name: p.name || `玩家${i + 1}`,
    color: p.color,
    animalKind: p.animalKind,
    cash: startingCash,
    position: 0,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    bankrupt: false,
    consecutiveDoubles: 0,
  }))
  let next: GameState = {
    ...createLobbyState(),
    phase: 'waitingRoll',
    players: gamePlayers,
    startingCash,
    goSalary,
    chanceDeck: shuffle(
      CHANCE_CARDS.map((c) => c.id),
      rng,
    ),
    chestDeck: shuffle(
      CHEST_CARDS.map((c) => c.id),
      rng,
    ),
  }
  next = addLog(
    next,
    `游戏开始！共 ${gamePlayers.length} 名玩家。开局 $${startingCash}，过起点 $${goSalary}。`,
  )
  return next
}

function tryPay(
  state: GameState,
  playerId: number,
  amount: number,
  creditorId: number | null,
  reason: string,
): GameState {
  if (amount <= 0) return state
  const player = getPlayer(state, playerId)
  if (player.cash >= amount) {
    let next = updatePlayer(state, playerId, { cash: player.cash - amount })
    if (creditorId !== null) {
      const cred = getPlayer(next, creditorId)
      next = updatePlayer(next, creditorId, { cash: cred.cash + amount })
    }
    return addLog(next, `${player.name} 支付 $${amount}（${reason}）`)
  }
  // 进入债务阶段，需先筹集资金
  return addLog(
    {
      ...state,
      phase: 'debt',
      debt: { debtorId: playerId, creditorId, amount, reason },
    },
    `${player.name} 资金不足，需筹集 $${amount}（${reason}）`,
  )
}

function giveMoney(state: GameState, playerId: number, amount: number): GameState {
  const p = getPlayer(state, playerId)
  return updatePlayer(state, playerId, { cash: p.cash + amount })
}

function sendToJail(state: GameState, playerId: number): GameState {
  let next = updatePlayer(state, playerId, {
    position: JAIL_POSITION,
    inJail: true,
    jailTurns: 0,
    consecutiveDoubles: 0,
  })
  const p = getPlayer(next, playerId)
  next = addLog(next, `${p.name} 进监狱了！`)
  next = { ...next, phase: 'manageAssets', pendingPurchaseTileId: null }
  return next
}

function movePlayer(
  state: GameState,
  playerId: number,
  steps: number,
  collectGo: boolean,
): GameState {
  const p = getPlayer(state, playerId)
  let pos = p.position + steps
  let next = state
  if (pos >= 40 && collectGo) {
    const salary = next.goSalary
    next = giveMoney(next, playerId, salary)
    next = addLog(next, `${p.name} 经过起点，领取 $${salary}`)
  }
  if (pos < 0) pos += 40
  pos = pos % 40
  next = updatePlayer(next, playerId, { position: pos })
  return next
}

function moveToPosition(
  state: GameState,
  playerId: number,
  target: number,
  collectGo: boolean,
): GameState {
  const p = getPlayer(state, playerId)
  let next = state
  if (collectGo && target < p.position) {
    const salary = next.goSalary
    next = giveMoney(next, playerId, salary)
    next = addLog(next, `${p.name} 经过起点，领取 $${salary}`)
  }
  next = updatePlayer(next, playerId, { position: target })
  return next
}

function startAuction(state: GameState, tileId: number): GameState {
  const active = state.players.filter((p) => !p.bankrupt).map((p) => p.id)
  const auction: AuctionState = {
    tileId,
    highestBid: 0,
    highestBidderId: null,
    activeBidderIds: active,
    currentBidderIndex: 0,
  }
  const tile = getTile(tileId)
  return addLog(
    {
      ...state,
      phase: 'auction',
      auction,
      pendingPurchaseTileId: null,
    },
    `${tile.name} 开始拍卖`,
  )
}

function resolveLanding(state: GameState): GameState {
  const player = currentPlayer(state)
  const tile = getTile(player.position)
  // 每次落地先清空旧机会，仅在停靠可建自家街道时再授予一次
  let next: GameState = {
    ...state,
    phase: 'tileAction',
    pendingPurchaseTileId: null,
    landingBuildTileId: null,
  }

  if (tile.type === 'gotojail') {
    return sendToJail(next, player.id)
  }

  if (tile.type === 'go' || tile.type === 'jail' || tile.type === 'parking') {
    next = addLog(next, `${player.name} 停在 ${tile.name}`)
    return { ...next, phase: 'manageAssets' }
  }

  if (tile.type === 'tax') {
    const amount = tile.taxAmount ?? 0
    next = addLog(next, `${player.name} 需缴纳 ${tile.name} $${amount}`)
    next = tryPay(next, player.id, amount, null, tile.name)
    if (next.phase !== 'debt') {
      next = { ...next, phase: 'manageAssets' }
    }
    return next
  }

  if (tile.type === 'chance' || tile.type === 'chest') {
    return drawCard(next, tile.type)
  }

  // 可购买地产
  const ps = next.properties[tile.id]!
  if (ps.ownerId === null) {
    next = {
      ...next,
      pendingPurchaseTileId: tile.id,
      phase: 'tileAction',
    }
    next = addLog(
      next,
      `${player.name} 停在无人的 ${tile.name}（$${tile.price}）`,
    )
    return next
  }

  if (ps.ownerId === player.id) {
    next = addLog(next, `${player.name} 停在自己的 ${tile.name}`)
    // 停靠自家街道：本回合仅一次建房机会
    if (isBuildEligible(next, player.id, tile.id)) {
      next = { ...next, landingBuildTileId: tile.id }
      const cost = tile.houseCost ?? 0
      const nextLevel = (ps.houses ?? 0) >= 4 ? '酒店' : '房屋'
      next = addLog(
        next,
        `★ 可在「${tile.name}」建造一次${nextLevel}（$${cost}）`,
      )
    }
    return { ...next, phase: 'manageAssets' }
  }

  // 付租金：先弹出确认，用户点确定后再扣款
  const diceTotal = next.lastDice?.value ?? 0
  const rent = calcPropertyRent(next, tile.id, diceTotal)
  if (rent <= 0) {
    next = addLog(next, `${tile.name} 已抵押，无需付租`)
    return { ...next, phase: 'manageAssets' }
  }
  const owner = getPlayer(next, ps.ownerId)
  next = addLog(
    next,
    `${player.name} 踩到 ${owner.name} 的 ${tile.name}，需支付租金 $${rent}`,
  )
  return {
    ...next,
    pendingRent: {
      tileId: tile.id,
      amount: rent,
      creditorId: ps.ownerId,
    },
    phase: 'tileAction',
  }
}

function drawCard(state: GameState, deck: 'chance' | 'chest'): GameState {
  const isChance = deck === 'chance'
  let cards = isChance ? [...state.chanceDeck] : [...state.chestDeck]
  let discard = isChance ? [...state.chanceDiscard] : [...state.chestDiscard]

  if (cards.length === 0) {
    cards = shuffle(discard, rng)
    discard = []
  }
  const cardId = cards.shift()!
  const card = getCard(cardId)
  // 出狱卡不进入弃牌堆，直到使用
  if (card.effect.kind !== 'getOutOfJail') {
    discard.push(cardId)
  }

  let next: GameState = isChance
    ? { ...state, chanceDeck: cards, chanceDiscard: discard, lastCardText: card.text }
    : { ...state, chestDeck: cards, chestDiscard: discard, lastCardText: card.text }

  const player = currentPlayer(next)
  next = addLog(next, `${player.name} 抽到：${card.text}`)
  next = applyCardEffect(next, card.id)
  return next
}

function applyCardEffect(state: GameState, cardId: string): GameState {
  const card = getCard(cardId)
  const player = currentPlayer(state)
  let next = state
  const effect = card.effect

  switch (effect.kind) {
    case 'money': {
      if (effect.amount >= 0) {
        next = giveMoney(next, player.id, effect.amount)
        next = addLog(next, `${player.name} 获得 $${effect.amount}`)
        next = { ...next, phase: 'tileAction' } // 等 dismiss
      } else {
        next = tryPay(next, player.id, -effect.amount, null, card.text)
        if (next.phase !== 'debt') next = { ...next, phase: 'tileAction' }
      }
      return next
    }
    case 'getOutOfJail': {
      next = updatePlayer(next, player.id, {
        getOutOfJailCards: player.getOutOfJailCards + 1,
      })
      next = { ...next, phase: 'tileAction' }
      return next
    }
    case 'gotoJail':
      return sendToJail(next, player.id)
    case 'moveTo': {
      next = moveToPosition(next, player.id, effect.position, effect.collectGo !== false)
      next = { ...next, lastCardText: card.text, phase: 'tileAction' }
      // 落地结算在 dismiss 后
      return next
    }
    case 'moveSteps': {
      next = movePlayer(next, player.id, effect.steps, effect.steps > 0)
      next = { ...next, lastCardText: card.text, phase: 'tileAction' }
      return next
    }
    case 'perPlayer': {
      const others = next.players.filter((p) => !p.bankrupt && p.id !== player.id)
      for (const o of others) {
        if (effect.amount > 0) {
          // 他人付给当前玩家
          next = tryPay(next, o.id, effect.amount, player.id, card.text)
          if (next.phase === 'debt') return next
        } else {
          next = tryPay(next, player.id, -effect.amount, o.id, card.text)
          if (next.phase === 'debt') return next
        }
      }
      next = { ...next, phase: 'tileAction' }
      return next
    }
    case 'repairs': {
      const { houses, hotels } = countHousesAndHotels(next, player.id)
      const cost = houses * effect.house + hotels * effect.hotel
      next = tryPay(next, player.id, cost, null, card.text)
      if (next.phase !== 'debt') next = { ...next, phase: 'tileAction' }
      return next
    }
    case 'nearestRailroad': {
      const railroads = [5, 15, 25, 35]
      const pos = player.position
      const target =
        railroads.find((r) => r > pos) ?? railroads[0]!
      next = moveToPosition(next, player.id, target, true)
      const ps = next.properties[target]!
      if (ps.ownerId !== null && ps.ownerId !== player.id && !ps.mortgaged) {
        const rent = calcPropertyRent(next, target, undefined, 2)
        next = tryPay(next, player.id, rent, ps.ownerId, '铁路双倍租金')
        if (next.phase !== 'debt') next = { ...next, phase: 'tileAction' }
      } else if (ps.ownerId === null) {
        next = { ...next, pendingPurchaseTileId: target, phase: 'tileAction' }
      } else {
        next = { ...next, phase: 'tileAction' }
      }
      return next
    }
    case 'nearestUtility': {
      const utils = [12, 28]
      const pos = player.position
      const target = utils.find((u) => u > pos) ?? utils[0]!
      next = moveToPosition(next, player.id, target, true)
      const ps = next.properties[target]!
      if (ps.ownerId !== null && ps.ownerId !== player.id && !ps.mortgaged) {
        const d = rollDie(rng)
        next = { ...next, lastDice: { value: d } }
        const rent = d * 10
        next = addLog(next, `公用事业骰点 ${d}，租金 $${rent}`)
        next = tryPay(next, player.id, rent, ps.ownerId, '公用事业×10')
        if (next.phase !== 'debt') next = { ...next, phase: 'tileAction' }
      } else if (ps.ownerId === null) {
        next = { ...next, pendingPurchaseTileId: target, phase: 'tileAction' }
      } else {
        next = { ...next, phase: 'tileAction' }
      }
      return next
    }
    default:
      return { ...next, phase: 'tileAction' }
  }
}

function dismissCard(state: GameState): GameState {
  // 卡牌展示关闭后：若有待购买则停留；若位置因卡牌改变则再次落地结算
  let next: GameState = { ...state, lastCardText: null }
  if (next.pendingPurchaseTileId !== null) {
    next = { ...next, phase: 'tileAction' }
    return next
  }
  if (next.phase === 'debt') return next
  if (next.phase === 'manageAssets') return next

  // 移动类卡牌落地结算
  const player = currentPlayer(next)
  const tile = getTile(player.position)
  if (
    tile.type === 'property' ||
    tile.type === 'railroad' ||
    tile.type === 'utility' ||
    tile.type === 'tax' ||
    tile.type === 'chance' ||
    tile.type === 'chest' ||
    tile.type === 'gotojail'
  ) {
    // 避免机会格连环抽：若仍在 chance/chest 且刚抽过，直接 manage
    if (tile.type === 'chance' || tile.type === 'chest') {
      return { ...next, phase: 'manageAssets' }
    }
    return resolveLanding(next)
  }
  return { ...next, phase: 'manageAssets' }
}

/** 进入 rolling，等待物理骰子结算点数 */
function rollDice(state: GameState): GameState {
  if (state.phase !== 'waitingRoll') return state
  const player = currentPlayer(state)
  let next: GameState = {
    ...state,
    lastDice: null,
    phase: 'rolling',
  }
  next = addLog(next, `${player.name} 掷出骰子…`)
  return next
}

/** 物理骰子停稳后，写入点数并结算移动 / 监狱 */
function finishRoll(state: GameState, die: number): GameState {
  if (state.phase !== 'rolling') return state
  if (die < 1 || die > 6) return state

  const player = currentPlayer(state)
  let next: GameState = {
    ...state,
    lastDice: { value: die },
    phase: 'moving',
  }
  next = addLog(next, `${player.name} 掷出 ${die}`)

  if (player.inJail) {
    // 单骰规则：掷出 6 视为出狱
    if (die === 6) {
      next = updatePlayer(next, player.id, {
        inJail: false,
        jailTurns: 0,
        consecutiveDoubles: 0,
      })
      next = addLog(next, `${player.name} 掷出 6，出狱！`)
      next = movePlayer(next, player.id, die, true)
      return next
    }
    const turns = player.jailTurns + 1
    if (turns >= 3) {
      next = tryPay(next, player.id, JAIL_FINE, null, '出狱罚金')
      if (next.phase === 'debt') {
        next = updatePlayer(next, player.id, { jailTurns: turns })
        return next
      }
      next = updatePlayer(next, player.id, {
        inJail: false,
        jailTurns: 0,
      })
      next = addLog(next, `${player.name} 第三回合强制交保出狱`)
      next = movePlayer(next, player.id, die, true)
      return next
    }
    next = updatePlayer(next, player.id, { jailTurns: turns })
    next = addLog(next, `${player.name} 仍在监狱（第 ${turns} 回合）`)
    next = { ...next, phase: 'manageAssets' }
    return next
  }

  next = updatePlayer(next, player.id, { consecutiveDoubles: 0 })
  next = movePlayer(next, player.id, die, true)
  return next
}

function finishMove(state: GameState): GameState {
  if (state.phase !== 'moving') return state
  return resolveLanding(state)
}

function buyProperty(state: GameState): GameState {
  if (state.pendingPurchaseTileId === null) return state
  const tileId = state.pendingPurchaseTileId
  const tile = getTile(tileId)
  const player = currentPlayer(state)
  const price = tile.price ?? 0
  if (player.cash < price) {
    return addLog(state, `${player.name} 现金不足，无法购买`)
  }
  let next = updatePlayer(state, player.id, { cash: player.cash - price })
  next = updateProperty(next, tileId, { ownerId: player.id })
  next = {
    ...next,
    pendingPurchaseTileId: null,
    landingBuildTileId: null, // 刚买下不可立即建房，须下次停靠
    phase: 'manageAssets',
  }
  next = addLog(next, `${player.name} 购买了 ${tile.name}，花费 $${price}`)
  return next
}

function declineProperty(state: GameState): GameState {
  if (state.pendingPurchaseTileId === null) return state
  return startAuction(state, state.pendingPurchaseTileId)
}

/** 用户确认后支付待付租金 */
function confirmPayRent(state: GameState): GameState {
  if (!state.pendingRent || state.phase !== 'tileAction') return state
  const { tileId, amount, creditorId } = state.pendingRent
  const tile = getTile(tileId)
  const player = currentPlayer(state)
  let next: GameState = { ...state, pendingRent: null }
  next = tryPay(next, player.id, amount, creditorId, `${tile.name} 租金`)
  if (next.phase !== 'debt') {
    next = { ...next, phase: 'manageAssets' }
  }
  return next
}

function auctionBid(state: GameState, amount: number): GameState {
  if (!state.auction || state.phase !== 'auction') return state
  const auction = state.auction
  const bidderId = auction.activeBidderIds[auction.currentBidderIndex]!
  const bidder = getPlayer(state, bidderId)
  if (amount <= auction.highestBid) {
    return addLog(state, '出价必须高于当前最高价')
  }
  if (amount > bidder.cash) {
    return addLog(state, '现金不足')
  }
  const nextAuction: AuctionState = {
    ...auction,
    highestBid: amount,
    highestBidderId: bidderId,
    currentBidderIndex:
      (auction.currentBidderIndex + 1) % auction.activeBidderIds.length,
  }
  return addLog(
    { ...state, auction: nextAuction },
    `${bidder.name} 出价 $${amount}`,
  )
}

function auctionPass(state: GameState): GameState {
  if (!state.auction || state.phase !== 'auction') return state
  const auction = state.auction
  const passerId = auction.activeBidderIds[auction.currentBidderIndex]!
  const passer = getPlayer(state, passerId)
  let active = auction.activeBidderIds.filter((id) => id !== passerId)

  // 若只剩一人且已有出价，成交；若无人出价且全退出，流拍
  if (active.length === 0) {
    return finishAuction(
      { ...state, auction: { ...auction, activeBidderIds: [] } },
      null,
      0,
    )
  }

  // 只剩最高出价者
  if (
    active.length === 1 &&
    auction.highestBidderId !== null &&
    active[0] === auction.highestBidderId
  ) {
    return finishAuction(state, auction.highestBidderId, auction.highestBid)
  }

  // 移除后调整 index
  let idx = auction.currentBidderIndex
  if (idx >= active.length) idx = 0
  // 当前人已移除，下一个保持在原位置的人
  const removedIndex = auction.currentBidderIndex
  active = auction.activeBidderIds.filter((id) => id !== passerId)
  idx = removedIndex % active.length

  let next: GameState = {
    ...state,
    auction: {
      ...auction,
      activeBidderIds: active,
      currentBidderIndex: idx,
    },
  }
  next = addLog(next, `${passer.name} 放弃竞拍`)

  if (
    active.length === 1 &&
    auction.highestBidderId !== null &&
    active[0] === auction.highestBidderId
  ) {
    return finishAuction(next, auction.highestBidderId, auction.highestBid)
  }
  if (active.length === 0) {
    return finishAuction(next, null, 0)
  }
  return next
}

function finishAuction(
  state: GameState,
  winnerId: number | null,
  bid: number,
): GameState {
  const tileId = state.auction!.tileId
  const tile = getTile(tileId)
  let next: GameState = { ...state, auction: null, phase: 'manageAssets' }
  if (winnerId === null || bid <= 0) {
    next = addLog(next, `${tile.name} 流拍，仍归银行`)
    return next
  }
  const winner = getPlayer(next, winnerId)
  if (winner.cash < bid) {
    next = addLog(next, `${winner.name} 无法支付竞拍价，流拍`)
    return next
  }
  next = updatePlayer(next, winnerId, { cash: winner.cash - bid })
  next = updateProperty(next, tileId, { ownerId: winnerId })
  next = addLog(next, `${winner.name} 以 $${bid} 拍得 ${tile.name}`)
  return next
}

function buildHouse(state: GameState, tileId: number): GameState {
  const actorId =
    state.phase === 'debt' && state.debt ? state.debt.debtorId : currentPlayer(state).id
  const player = getPlayer(state, actorId)
  if (!canBuildHouse(state, player.id, tileId)) {
    return addLog(state, '无法在此处建房')
  }
  const tile = getTile(tileId)
  const ps = state.properties[tileId]!
  let next = updatePlayer(state, player.id, {
    cash: player.cash - (tile.houseCost ?? 0),
  })
  if (ps.houses === 4) {
    next = {
      ...next,
      housesRemaining: next.housesRemaining + 4,
      hotelsRemaining: next.hotelsRemaining - 1,
    }
    next = updateProperty(next, tileId, { houses: 5 })
    next = addLog(next, `${player.name} 在 ${tile.name} 建造酒店`)
  } else {
    next = { ...next, housesRemaining: next.housesRemaining - 1 }
    next = updateProperty(next, tileId, { houses: ps.houses + 1 })
    next = addLog(next, `${player.name} 在 ${tile.name} 建造房屋`)
  }
  // 用掉本回合落地建房机会，防止连建
  return { ...next, landingBuildTileId: null }
}

function sellHouse(state: GameState, tileId: number): GameState {
  const actorId =
    state.phase === 'debt' && state.debt ? state.debt.debtorId : currentPlayer(state).id
  const player = getPlayer(state, actorId)
  if (!canSellHouse(state, player.id, tileId)) {
    return addLog(state, '无法出售房屋')
  }
  const tile = getTile(tileId)
  const ps = state.properties[tileId]!
  const refund = Math.floor((tile.houseCost ?? 0) / 2)
  let next = giveMoney(state, player.id, refund)
  if (ps.houses === 5) {
    next = {
      ...next,
      hotelsRemaining: next.hotelsRemaining + 1,
      housesRemaining: next.housesRemaining - 4,
    }
    next = updateProperty(next, tileId, { houses: 4 })
    next = addLog(next, `${player.name} 出售 ${tile.name} 的酒店，得 $${refund}`)
  } else {
    next = { ...next, housesRemaining: next.housesRemaining + 1 }
    next = updateProperty(next, tileId, { houses: ps.houses - 1 })
    next = addLog(next, `${player.name} 出售 ${tile.name} 的房屋，得 $${refund}`)
  }
  return tryResolveDebt(next)
}

function mortgage(state: GameState, tileId: number): GameState {
  const actorId =
    state.phase === 'debt' && state.debt ? state.debt.debtorId : currentPlayer(state).id
  const player = getPlayer(state, actorId)
  const tile = getTile(tileId)
  const ps = state.properties[tileId]!
  if (ps.ownerId !== player.id || ps.mortgaged) {
    return addLog(state, '无法抵押')
  }
  if (ps.houses > 0) {
    return addLog(state, '请先出售所有房屋再抵押')
  }
  const amount = tile.mortgage ?? Math.floor((tile.price ?? 0) / 2)
  let next = giveMoney(state, player.id, amount)
  next = updateProperty(next, tileId, { mortgaged: true })
  next = addLog(next, `${player.name} 抵押 ${tile.name}，获得 $${amount}`)
  return tryResolveDebt(next)
}

function unmortgage(state: GameState, tileId: number): GameState {
  const actorId =
    state.phase === 'debt' && state.debt ? state.debt.debtorId : currentPlayer(state).id
  const player = getPlayer(state, actorId)
  const tile = getTile(tileId)
  const ps = state.properties[tileId]!
  if (ps.ownerId !== player.id || !ps.mortgaged) {
    return addLog(state, '无法赎回')
  }
  const base = tile.mortgage ?? Math.floor((tile.price ?? 0) / 2)
  const cost = Math.ceil(base * 1.1)
  if (player.cash < cost) {
    return addLog(state, '现金不足，无法赎回')
  }
  let next = updatePlayer(state, player.id, { cash: player.cash - cost })
  next = updateProperty(next, tileId, { mortgaged: false })
  next = addLog(next, `${player.name} 赎回 ${tile.name}，花费 $${cost}`)
  return next
}

function tryResolveDebt(state: GameState): GameState {
  if (state.phase !== 'debt' || !state.debt) return state
  const { debtorId, creditorId, amount, reason } = state.debt
  const debtor = getPlayer(state, debtorId)
  if (debtor.cash >= amount) {
    let next = updatePlayer(state, debtorId, { cash: debtor.cash - amount })
    if (creditorId !== null) {
      const cred = getPlayer(next, creditorId)
      next = updatePlayer(next, creditorId, { cash: cred.cash + amount })
    }
    next = addLog(next, `${debtor.name} 已付清 $${amount}（${reason}）`)
    next = { ...next, debt: null, phase: 'manageAssets' }
    return next
  }
  return state
}

function declareBankruptcy(state: GameState): GameState {
  if (!state.debt) return state
  const { debtorId, creditorId, amount } = state.debt
  const debtor = getPlayer(state, debtorId)
  let next = state

  if (creditorId === null) {
    // 欠银行：地产归还银行，拆除房屋
    for (const tileId of ownedProperties(next, debtorId)) {
      const ps = next.properties[tileId]!
      if (ps.houses === 5) {
        next = { ...next, hotelsRemaining: next.hotelsRemaining + 1 }
      } else if (ps.houses > 0) {
        next = { ...next, housesRemaining: next.housesRemaining + ps.houses }
      }
      next = updateProperty(next, tileId, {
        ownerId: null,
        houses: 0,
        mortgaged: false,
      })
    }
    // 出狱卡回弃牌堆（简化：直接丢弃）
    next = updatePlayer(next, debtorId, {
      bankrupt: true,
      cash: 0,
      getOutOfJailCards: 0,
    })
  } else {
    // 欠玩家：资产与现金转给债权人
    const cred = getPlayer(next, creditorId)
    next = updatePlayer(next, creditorId, {
      cash: cred.cash + debtor.cash,
      getOutOfJailCards: cred.getOutOfJailCards + debtor.getOutOfJailCards,
    })
    for (const tileId of ownedProperties(next, debtorId)) {
      const ps = next.properties[tileId]!
      // 有房屋先半价卖给银行
      if (ps.houses > 0) {
        const tile = getTile(tileId)
        const refund =
          ps.houses === 5
            ? Math.floor((tile.houseCost ?? 0) / 2) * 5
            : Math.floor((tile.houseCost ?? 0) / 2) * ps.houses
        next = updatePlayer(next, creditorId, {
          cash: getPlayer(next, creditorId).cash + refund,
        })
        if (ps.houses === 5) {
          next = { ...next, hotelsRemaining: next.hotelsRemaining + 1 }
        } else {
          next = { ...next, housesRemaining: next.housesRemaining + ps.houses }
        }
      }
      next = updateProperty(next, tileId, {
        ownerId: creditorId,
        houses: 0,
        mortgaged: ps.mortgaged,
      })
    }
    next = updatePlayer(next, debtorId, {
      bankrupt: true,
      cash: 0,
      getOutOfJailCards: 0,
    })
    void amount
  }

  next = addLog(next, `${debtor.name} 宣布破产！`)
  next = {
    ...next,
    debt: null,
    pendingPurchaseTileId: null,
    landingBuildTileId: null,
    pendingRent: null,
    auction: null,
  }
  next = checkWinner(next)
  if (next.phase === 'gameOver') return next

  // 若破产的是当前玩家，结束其回合
  if (debtorId === currentPlayer(next).id || getPlayer(next, debtorId).bankrupt) {
    next = advanceTurn(next)
  } else {
    next = { ...next, phase: 'manageAssets' }
  }
  return next
}

function advanceTurn(state: GameState): GameState {
  const player = currentPlayer(state)
  const nextIdx = nextPlayerIndex(state)
  let next: GameState = {
    ...state,
    currentPlayerIndex: nextIdx,
    phase: 'waitingRoll',
    pendingPurchaseTileId: null,
    landingBuildTileId: null,
    pendingRent: null,
    lastCardText: null,
    trade: null,
  }
  if (!player.bankrupt) {
    next = updatePlayer(next, player.id, { consecutiveDoubles: 0 })
  }
  const np = next.players[nextIdx]!
  next = addLog(next, `轮到 ${np.name}`)
  return next
}

function endTurn(state: GameState): GameState {
  if (state.phase !== 'manageAssets') {
    return addLog(state, '当前无法结束回合')
  }
  return advanceTurn(state)
}

function payJailFine(state: GameState): GameState {
  const player = currentPlayer(state)
  if (!player.inJail || state.phase !== 'waitingRoll') return state
  let next = tryPay(state, player.id, JAIL_FINE, null, '出狱罚金')
  if (next.phase === 'debt') return next
  next = updatePlayer(next, player.id, { inJail: false, jailTurns: 0 })
  next = addLog(next, `${player.name} 支付 $${JAIL_FINE} 出狱`)
  next = { ...next, phase: 'waitingRoll' }
  return next
}

function useJailCard(state: GameState): GameState {
  const player = currentPlayer(state)
  if (!player.inJail || player.getOutOfJailCards <= 0 || state.phase !== 'waitingRoll') {
    return state
  }
  let next = updatePlayer(state, player.id, {
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: player.getOutOfJailCards - 1,
  })
  // 卡牌回到弃牌（简化进 chance discard）
  next = {
    ...next,
    chanceDiscard: [...next.chanceDiscard, 'ch7'],
  }
  next = addLog(next, `${player.name} 使用出狱卡`)
  return next
}

function startTrade(state: GameState, toId: number): GameState {
  const from = currentPlayer(state)
  if (from.id === toId) return state
  const offer: TradeOffer = {
    fromId: from.id,
    toId,
    cashFrom: 0,
    cashTo: 0,
    propertiesFrom: [],
    propertiesTo: [],
    jailCardsFrom: 0,
    jailCardsTo: 0,
    status: 'draft',
  }
  return { ...state, phase: 'trade', trade: offer }
}

function updateTrade(state: GameState, patch: Partial<TradeOffer>): GameState {
  if (!state.trade) return state
  return { ...state, trade: { ...state.trade, ...patch, status: 'draft' } }
}

function proposeTrade(state: GameState): GameState {
  if (!state.trade) return state
  return {
    ...state,
    trade: { ...state.trade, status: 'pending' },
  }
}

function acceptTrade(state: GameState): GameState {
  if (!state.trade || state.trade.status !== 'pending') return state
  const t = state.trade
  const from = getPlayer(state, t.fromId)
  const to = getPlayer(state, t.toId)

  if (from.cash < t.cashFrom || to.cash < t.cashTo) {
    return addLog(state, '交易双方现金不足')
  }
  if (from.getOutOfJailCards < t.jailCardsFrom || to.getOutOfJailCards < t.jailCardsTo) {
    return addLog(state, '出狱卡数量不足')
  }
  for (const id of t.propertiesFrom) {
    if (state.properties[id]?.ownerId !== from.id) return addLog(state, '地产归属无效')
    if ((state.properties[id]?.houses ?? 0) > 0) return addLog(state, '请先拆除房屋再交易')
  }
  for (const id of t.propertiesTo) {
    if (state.properties[id]?.ownerId !== to.id) return addLog(state, '地产归属无效')
    if ((state.properties[id]?.houses ?? 0) > 0) return addLog(state, '请先拆除房屋再交易')
  }

  let next = state
  next = updatePlayer(next, from.id, {
    cash: from.cash - t.cashFrom + t.cashTo,
    getOutOfJailCards:
      from.getOutOfJailCards - t.jailCardsFrom + t.jailCardsTo,
  })
  next = updatePlayer(next, to.id, {
    cash: getPlayer(next, to.id).cash - t.cashTo + t.cashFrom,
    getOutOfJailCards:
      getPlayer(next, to.id).getOutOfJailCards - t.jailCardsTo + t.jailCardsFrom,
  })
  for (const id of t.propertiesFrom) {
    next = updateProperty(next, id, { ownerId: to.id })
  }
  for (const id of t.propertiesTo) {
    next = updateProperty(next, id, { ownerId: from.id })
  }
  next = addLog(next, `${from.name} 与 ${to.name} 完成交易`)
  next = { ...next, trade: null, phase: 'manageAssets' }
  return next
}

function rejectTrade(state: GameState): GameState {
  if (!state.trade) return state
  const next = addLog(state, '交易被拒绝')
  return { ...next, trade: null, phase: 'manageAssets' }
}

function cancelTrade(state: GameState): GameState {
  return { ...state, trade: null, phase: 'manageAssets' }
}

export function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return startGame(state, action)
    case 'ROLL_DICE':
      return rollDice(state)
    case 'FINISH_ROLL':
      return finishRoll(state, action.die)
    case 'FINISH_MOVE':
      return finishMove(state)
    case 'BUY_PROPERTY':
      return buyProperty(state)
    case 'DECLINE_PROPERTY':
      return declineProperty(state)
    case 'CONFIRM_PAY_RENT':
      return confirmPayRent(state)
    case 'AUCTION_BID':
      return auctionBid(state, action.amount)
    case 'AUCTION_PASS':
      return auctionPass(state)
    case 'DISMISS_CARD':
      return dismissCard(state)
    case 'PAY_JAIL_FINE':
      return payJailFine(state)
    case 'USE_JAIL_CARD':
      return useJailCard(state)
    case 'BUILD_HOUSE':
      return buildHouse(state, action.tileId)
    case 'SELL_HOUSE':
      return sellHouse(state, action.tileId)
    case 'MORTGAGE':
      return mortgage(state, action.tileId)
    case 'UNMORTGAGE':
      return unmortgage(state, action.tileId)
    case 'START_TRADE':
      return startTrade(state, action.toId)
    case 'UPDATE_TRADE':
      return updateTrade(state, action.offer)
    case 'PROPOSE_TRADE':
      return proposeTrade(state)
    case 'ACCEPT_TRADE':
      return acceptTrade(state)
    case 'REJECT_TRADE':
      return rejectTrade(state)
    case 'CANCEL_TRADE':
      return cancelTrade(state)
    case 'END_TURN':
      return endTurn(state)
    case 'DECLARE_BANKRUPTCY':
      return declareBankruptcy(state)
    case 'RESOLVE_DEBT_DONE':
      return tryResolveDebt(state)
    case 'PAY_TAX':
      return state
    case 'DRAW_CARD_DONE':
      return dismissCard(state)
    default:
      return state
  }
}
