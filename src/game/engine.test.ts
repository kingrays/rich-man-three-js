import { describe, it, expect, beforeEach } from 'vitest'
import { createLobbyState, reduce, setRng } from '../game/engine'
import { createRng } from '../game/rng'
import {
  calcPropertyRent,
  canBuildHouse,
} from '../game/rules/helpers'
import type { GameState } from '../game/types'

function startTwoPlayer(): GameState {
  return reduce(createLobbyState(), {
    type: 'START_GAME',
    players: [
      { name: '甲', color: '#e74c3c', animalKind: 'pig' },
      { name: '乙', color: '#3498db', animalKind: 'cat' },
    ],
  })
}

describe('游戏引擎', () => {
  beforeEach(() => {
    setRng(createRng(42))
  })

  it('开始游戏：2 人各 $1500，在起点', () => {
    const s = startTwoPlayer()
    expect(s.phase).toBe('waitingRoll')
    expect(s.players).toHaveLength(2)
    expect(s.players[0]!.cash).toBe(1500)
    expect(s.players[0]!.position).toBe(0)
    expect(s.players[0]!.animalKind).toBe('pig')
    expect(s.players[1]!.animalKind).toBe('cat')
    expect(s.startingCash).toBe(1500)
    expect(s.goSalary).toBe(200)
  })

  it('开局可自定义金币与角色', () => {
    const s = reduce(createLobbyState(), {
      type: 'START_GAME',
      players: [
        { name: '甲', color: '#e74c3c', animalKind: 'cat' },
        { name: '乙', color: '#3498db', animalKind: 'pig' },
      ],
      startingCash: 800,
      goSalary: 100,
    })
    expect(s.players[0]!.cash).toBe(800)
    expect(s.players[1]!.cash).toBe(800)
    expect(s.players[0]!.animalKind).toBe('cat')
    expect(s.players[1]!.animalKind).toBe('pig')
    expect(s.startingCash).toBe(800)
    expect(s.goSalary).toBe(100)
  })

  it('经过起点按本局 goSalary 发钱', () => {
    let s = reduce(createLobbyState(), {
      type: 'START_GAME',
      players: [
        { name: '甲', color: '#e74c3c', animalKind: 'pig' },
        { name: '乙', color: '#3498db', animalKind: 'cat' },
      ],
      startingCash: 1000,
      goSalary: 50,
    })
    const len = s.board.length
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, position: len - 2 } : p,
      ),
      phase: 'moving',
      lastDice: { value: 4 },
    }
    // 倒数第 2 格 + 4 → 过起点到格 2，应领取 $50
    s = {
      ...s,
      phase: 'waitingRoll',
    }
    s = reduce(s, { type: 'ROLL_DICE' })
    s = reduce(s, { type: 'FINISH_ROLL', die: 4 })
    expect(s.players[0]!.position).toBe(2)
    expect(s.players[0]!.cash).toBe(1050)
    expect(s.log.some((e) => e.message.includes('领取 $50'))).toBe(true)
  })

  it('可选棋盘大小，且北上广深常驻最高价', () => {
    const s = reduce(createLobbyState(), {
      type: 'START_GAME',
      boardSize: 'mini',
      players: [
        { name: '甲', color: '#e74c3c', animalKind: 'pig' },
        { name: '乙', color: '#3498db', animalKind: 'cat' },
      ],
    })
    expect(s.board).toHaveLength(24)
    expect(s.boardSize).toBe('mini')
    const props = s.board.filter((t) => t.type === 'property')
    const names = props.map((t) => t.name)
    for (const city of ['北京', '上海', '广州', '深圳']) {
      expect(names).toContain(city)
    }
    const top = [...props].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 4)
    expect(top.map((t) => t.name).sort()).toEqual(['上海', '北京', '广州', '深圳'].sort())
  })

  it('掷骰后进入 rolling，物理点数结算后移动', () => {
    let s = startTwoPlayer()
    s = reduce(s, { type: 'ROLL_DICE' })
    expect(s.phase).toBe('rolling')
    expect(s.lastDice).toBeNull()
    s = reduce(s, { type: 'FINISH_ROLL', die: 4 })
    expect(s.phase).toBe('moving')
    expect(s.lastDice).toEqual({ value: 4 })
    s = reduce(s, { type: 'FINISH_MOVE' })
    expect(['tileAction', 'manageAssets', 'debt']).toContain(s.phase)
  })

  it('购买无人地产', () => {
    let s = startTwoPlayer()
    // 强制放到第一格城市地产
    const price = s.board[1]!.price!
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, position: 1 } : p,
      ),
      phase: 'moving',
      lastDice: { value: 1 },
    }
    s = reduce(s, { type: 'FINISH_MOVE' })
    expect(s.pendingPurchaseTileId).toBe(1)
    s = reduce(s, { type: 'BUY_PROPERTY' })
    expect(s.properties[1]!.ownerId).toBe(0)
    expect(s.players[0]!.cash).toBe(1500 - price)
    expect(s.phase).toBe('manageAssets')
  })

  it('放弃购买进入拍卖', () => {
    let s = startTwoPlayer()
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, position: 1 } : p,
      ),
      phase: 'moving',
      lastDice: { value: 1 },
    }
    s = reduce(s, { type: 'FINISH_MOVE' })
    s = reduce(s, { type: 'DECLINE_PROPERTY' })
    expect(s.phase).toBe('auction')
    expect(s.auction?.tileId).toBe(1)
  })

  it('租金：空地为基础租金', () => {
    let s = startTwoPlayer()
    s = {
      ...s,
      properties: {
        ...s.properties,
        1: { ownerId: 0, houses: 0, mortgaged: false },
      },
    }
    expect(calcPropertyRent(s, 1)).toBe(2)
  })

  it('停靠自家格仅可建一次', () => {
    let s = startTwoPlayer()
    s = {
      ...s,
      phase: 'manageAssets',
      landingBuildTileId: 1,
      properties: {
        ...s.properties,
        1: { ownerId: 0, houses: 0, mortgaged: false },
      },
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, cash: 500, position: 1 } : p,
      ),
    }
    expect(canBuildHouse(s, 0, 1)).toBe(true)
    s = reduce(s, { type: 'BUILD_HOUSE', tileId: 1 })
    expect(s.properties[1]!.houses).toBe(1)
    expect(s.landingBuildTileId).toBeNull()
    // 同一回合不可再连建
    expect(canBuildHouse(s, 0, 1)).toBe(false)
  })

  it('踩到自家可建房地产时写入建房提醒', () => {
    let s = startTwoPlayer()
    s = {
      ...s,
      properties: {
        ...s.properties,
        1: { ownerId: 0, houses: 0, mortgaged: false },
      },
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, position: 1, cash: 500 } : p,
      ),
      phase: 'moving',
      lastDice: { value: 1 },
    }
    s = reduce(s, { type: 'FINISH_MOVE' })
    expect(s.phase).toBe('manageAssets')
    expect(s.landingBuildTileId).toBe(1)
    expect(s.log.some((e) => e.message.includes('可在「') && e.message.includes('建造'))).toBe(
      true,
    )
  })

  it('抵押获得半价', () => {
    let s = startTwoPlayer()
    s = {
      ...s,
      phase: 'manageAssets',
      properties: {
        ...s.properties,
        1: { ownerId: 0, houses: 0, mortgaged: false },
      },
    }
    const before = s.players[0]!.cash
    s = reduce(s, { type: 'MORTGAGE', tileId: 1 })
    expect(s.properties[1]!.mortgaged).toBe(true)
    expect(s.players[0]!.cash).toBe(before + 30)
  })

  it('进监狱', () => {
    let s = startTwoPlayer()
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, position: 30 } : p,
      ),
      phase: 'moving',
      lastDice: { value: 5 },
    }
    s = reduce(s, { type: 'FINISH_MOVE' })
    expect(s.players[0]!.inJail).toBe(true)
    expect(s.players[0]!.position).toBe(10)
  })

  it('破产后只剩一人则结束', () => {
    let s = startTwoPlayer()
    s = {
      ...s,
      phase: 'debt',
      debt: {
        debtorId: 1,
        creditorId: 0,
        amount: 9999,
        reason: '测试',
      },
      players: s.players.map((p) =>
        p.id === 1 ? { ...p, cash: 0 } : p,
      ),
    }
    s = reduce(s, { type: 'DECLARE_BANKRUPTCY' })
    expect(s.players[1]!.bankrupt).toBe(true)
    expect(s.phase).toBe('gameOver')
    expect(s.winnerId).toBe(0)
  })

  it('踩到别人地产：先确认再付租金', () => {
    let s = startTwoPlayer()
    s = {
      ...s,
      properties: {
        ...s.properties,
        1: { ownerId: 1, houses: 0, mortgaged: false },
      },
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, position: 1, cash: 500 } : p,
      ),
      phase: 'moving',
      lastDice: { value: 1 },
    }
    s = reduce(s, { type: 'FINISH_MOVE' })
    expect(s.phase).toBe('tileAction')
    expect(s.pendingRent).toEqual({
      tileId: 1,
      amount: 2,
      creditorId: 1,
    })
    expect(s.players[0]!.cash).toBe(500)

    s = reduce(s, { type: 'CONFIRM_PAY_RENT' })
    expect(s.pendingRent).toBeNull()
    expect(s.players[0]!.cash).toBe(498)
    expect(s.players[1]!.cash).toBe(1502)
    expect(s.phase).toBe('manageAssets')
  })

  it('铁路租金随持有数量增加', () => {
    let s = startTwoPlayer()
    const rails = s.board.filter((t) => t.type === 'railroad').map((t) => t.id)
    expect(rails.length).toBeGreaterThanOrEqual(2)
    const [r0, r1] = rails
    s = {
      ...s,
      properties: {
        ...s.properties,
        [r0!]: { ownerId: 0, houses: 0, mortgaged: false },
        [r1!]: { ownerId: 0, houses: 0, mortgaged: false },
      },
    }
    expect(calcPropertyRent(s, r0!)).toBe(50)
  })
})
