/** 铁路 / 公用事业分组（城市地产已取消色组） */
export type ColorGroup = 'railroad' | 'utility'

export type TileType =
  | 'go'
  | 'property'
  | 'railroad'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'chest'
  | 'jail'
  | 'gotojail'
  | 'parking'

/** 静态棋盘格定义 */
export interface TileDef {
  id: number
  name: string
  type: TileType
  colorGroup?: ColorGroup
  price?: number
  rent?: number[]
  houseCost?: number
  mortgage?: number
  taxAmount?: number
}

/** 机会卡「前进到…」的语义目标（随本局棋盘解析） */
export type MoveSlot =
  | 'go'
  | 'earlyProperty'
  | 'midProperty'
  | 'topProperty'
  | 'firstRailroad'

/** 卡牌效果 */
export type CardEffect =
  | { kind: 'money'; amount: number }
  | { kind: 'moveTo'; position: number; collectGo?: boolean }
  | { kind: 'moveToSlot'; slot: MoveSlot; collectGo?: boolean }
  | { kind: 'moveSteps'; steps: number }
  | { kind: 'gotoJail' }
  | { kind: 'getOutOfJail' }
  | { kind: 'repairs'; house: number; hotel: number }
  | { kind: 'perPlayer'; amount: number }
  | { kind: 'nearestRailroad' }
  | { kind: 'nearestUtility' }

export interface CardDef {
  id: string
  deck: 'chance' | 'chest'
  text: string
  effect: CardEffect
}

export type Phase =
  | 'lobby'
  | 'waitingRoll'
  | 'rolling' // 3D 骰子动画中
  | 'moving'
  | 'tileAction'
  | 'auction'
  | 'manageAssets'
  | 'trade'
  | 'debt'
  | 'gameOver'

export interface PropertyState {
  ownerId: number | null
  houses: number // 0-4, 5 = hotel
  mortgaged: boolean
}

/** 棋子动物角色（开局可选） */
export const ANIMAL_KINDS = ['pig', 'cat', 'rabbit', 'bear'] as const
export type AnimalKind = (typeof ANIMAL_KINDS)[number]

export const ANIMAL_LABELS: Record<AnimalKind, string> = {
  pig: '小猪',
  cat: '猫咪',
  rabbit: '兔子',
  bear: '小熊',
}

export interface Player {
  id: number
  name: string
  color: string
  /** 棋子形象 */
  animalKind: AnimalKind
  cash: number
  position: number
  inJail: boolean
  jailTurns: number
  getOutOfJailCards: number
  bankrupt: boolean
  consecutiveDoubles: number
}

export interface AuctionState {
  tileId: number
  highestBid: number
  highestBidderId: number | null
  /** 仍在竞拍的玩家 id（按出价顺序轮转） */
  activeBidderIds: number[]
  currentBidderIndex: number
}

export interface TradeOffer {
  fromId: number
  toId: number
  /** 发起方给出的现金 */
  cashFrom: number
  /** 接收方给出的现金 */
  cashTo: number
  propertiesFrom: number[]
  propertiesTo: number[]
  jailCardsFrom: number
  jailCardsTo: number
  /** pending = 等待对方确认 */
  status: 'draft' | 'pending' | 'accepted' | 'rejected'
}

export interface DebtState {
  debtorId: number
  creditorId: number | null // null = 银行
  amount: number
  reason: string
}

/** 待确认支付的租金 */
export interface PendingRent {
  tileId: number
  amount: number
  creditorId: number
}

export interface DiceResult {
  /** 单骰点数 1–6 */
  value: number
}

export interface GameLogEntry {
  id: number
  message: string
}

export interface GameState {
  phase: Phase
  /** 本局棋盘（含随机城市名） */
  board: TileDef[]
  /** 开局所选棋盘规格 */
  boardSize: 'mini' | 'small' | 'medium' | 'large' | 'xlarge'
  players: Player[]
  currentPlayerIndex: number
  properties: Record<number, PropertyState>
  chanceDeck: string[]
  chestDeck: string[]
  chanceDiscard: string[]
  chestDiscard: string[]
  lastDice: DiceResult | null
  auction: AuctionState | null
  trade: TradeOffer | null
  debt: DebtState | null
  /** 待处理的地产购买（当前格） */
  pendingPurchaseTileId: number | null
  /**
   * 本回合停靠自家城市后的一次性建房机会（格 id）。
   * 建完或结束回合后清空，防止同一回合连建多级。
   */
  landingBuildTileId: number | null
  /** 待确认支付的租金（踩到别人地产） */
  pendingRent: PendingRent | null
  /** 抽到的卡牌文案（展示用） */
  lastCardText: string | null
  winnerId: number | null
  log: GameLogEntry[]
  logSeq: number
  housesRemaining: number
  hotelsRemaining: number
  /** 开局现金（本局规则） */
  startingCash: number
  /** 经过起点领取金额（本局规则） */
  goSalary: number
}

/** 开局玩家配置 */
export interface StartPlayerConfig {
  name: string
  color: string
  animalKind: AnimalKind
}

export type GameAction =
  | {
      type: 'START_GAME'
      players: StartPlayerConfig[]
      /** 开局金币；缺省用默认值 */
      startingCash?: number
      /** 过起点金币；缺省用默认值 */
      goSalary?: number
      /** 棋盘大小；缺省中号 40 格 */
      boardSize?: 'mini' | 'small' | 'medium' | 'large' | 'xlarge'
    }
  | { type: 'ROLL_DICE' }
  | { type: 'FINISH_ROLL'; die: number } // 物理结算后的单骰点数
  | { type: 'FINISH_MOVE' }
  | { type: 'BUY_PROPERTY' }
  | { type: 'DECLINE_PROPERTY' }
  | { type: 'CONFIRM_PAY_RENT' }
  | { type: 'AUCTION_BID'; amount: number }
  | { type: 'AUCTION_PASS' }
  | { type: 'PAY_TAX' }
  | { type: 'DRAW_CARD_DONE' }
  | { type: 'PAY_JAIL_FINE' }
  | { type: 'USE_JAIL_CARD' }
  | { type: 'BUILD_HOUSE'; tileId: number }
  | { type: 'SELL_HOUSE'; tileId: number }
  | { type: 'MORTGAGE'; tileId: number }
  | { type: 'UNMORTGAGE'; tileId: number }
  | { type: 'START_TRADE'; toId: number }
  | { type: 'UPDATE_TRADE'; offer: Partial<TradeOffer> }
  | { type: 'PROPOSE_TRADE' }
  | { type: 'ACCEPT_TRADE' }
  | { type: 'REJECT_TRADE' }
  | { type: 'CANCEL_TRADE' }
  | { type: 'END_TURN' }
  | { type: 'DECLARE_BANKRUPTCY' }
  | { type: 'RESOLVE_DEBT_DONE' }
  | { type: 'DISMISS_CARD' }
