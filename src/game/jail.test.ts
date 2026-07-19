import { describe, it, expect, beforeEach } from 'vitest'
import { createLobbyState, reduce, setRng } from './engine'
import { createRng } from './rng'
import { findJailPosition, getTile } from './board'

function startGame(boardSize: 'mini' | 'medium' = 'medium') {
  return reduce(createLobbyState(), {
    type: 'START_GAME',
    players: [
      { name: '甲', color: '#e74c3c', animalKind: 'pig' },
      { name: '乙', color: '#3498db', animalKind: 'cat' },
    ],
    boardSize,
  })
}

describe('监狱规则', () => {
  beforeEach(() => {
    setRng(createRng(42))
  })

  it('踩进监狱格：送入监狱并标记 inJail', () => {
    let s = startGame()
    const goToJail = s.board.find((t) => t.type === 'gotojail')!
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, position: goToJail.id } : p,
      ),
      phase: 'moving',
      lastDice: { value: 1 },
    }
    s = reduce(s, { type: 'FINISH_MOVE' })
    expect(s.players[0]!.inJail).toBe(true)
    expect(s.players[0]!.position).toBe(findJailPosition(s.board))
  })

  it('在狱中非 6 点：不移动且 jailTurns 递增', () => {
    let s = startGame()
    const jailPos = findJailPosition(s.board)
    s = {
      ...s,
      phase: 'waitingRoll',
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, position: jailPos, inJail: true, jailTurns: 0 } : p,
      ),
    }
    s = reduce(s, { type: 'ROLL_DICE' })
    s = reduce(s, { type: 'FINISH_ROLL', die: 4 })
    expect(s.players[0]!.position).toBe(jailPos)
    expect(s.players[0]!.inJail).toBe(true)
    expect(s.players[0]!.jailTurns).toBe(1)
    expect(s.phase).toBe('manageAssets')
  })

  it('在狱中使用出狱卡：解除监禁且可继续掷骰', () => {
    let s = startGame()
    const jailPos = findJailPosition(s.board)
    s = {
      ...s,
      phase: 'waitingRoll',
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, position: jailPos, inJail: true, getOutOfJailCards: 1 }
          : p,
      ),
    }
    s = reduce(s, { type: 'USE_JAIL_CARD' })
    expect(s.players[0]!.inJail).toBe(false)
    expect(s.players[0]!.getOutOfJailCards).toBe(0)
    expect(s.phase).toBe('waitingRoll')

    s = reduce(s, { type: 'ROLL_DICE' })
    s = reduce(s, { type: 'FINISH_ROLL', die: 3 })
    expect(s.players[0]!.position).toBe((jailPos + 3) % s.board.length)
    expect(s.players[0]!.inJail).toBe(false)
  })

  it('抽到出狱卡：inventory +1', () => {
    let s = startGame()
    s = {
      ...s,
      phase: 'tileAction',
      chanceDeck: ['ch7'],
      chestDeck: [],
    }
    s = reduce(s, { type: 'DISMISS_CARD' }) // noop prep
    s = {
      ...s,
      phase: 'moving',
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, position: getTile(s, 6).type === 'chance' ? 6 : s.board.find((t) => t.type === 'chance')!.id } : p,
      ),
    }
    // 直接模拟抽卡效果
    s = reduce(s, { type: 'FINISH_MOVE' })
    // 若未踩机会，手动走 draw 路径：改到机会格再 finish
    const chanceId = s.board.find((t) => t.type === 'chance')!.id
    s = {
      ...startGame(),
      phase: 'moving',
      chanceDeck: ['ch7'],
      players: startGame().players.map((p, i) =>
        i === 0 ? { ...p, position: chanceId } : p,
      ),
    }
    s = reduce(s, { type: 'FINISH_MOVE' })
    expect(s.lastCardText).toContain('出狱')
    s = reduce(s, { type: 'DISMISS_CARD' })
    expect(s.players[0]!.getOutOfJailCards).toBe(1)
  })

  it('迷你棋盘：进监狱与关押逻辑一致', () => {
    let s = startGame('mini')
    const goToJail = s.board.find((t) => t.type === 'gotojail')!
    const jailPos = findJailPosition(s.board)
    expect(jailPos).toBeGreaterThanOrEqual(0)
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, position: goToJail.id } : p,
      ),
      phase: 'moving',
    }
    s = reduce(s, { type: 'FINISH_MOVE' })
    expect(s.players[0]!.inJail).toBe(true)
    expect(s.players[0]!.position).toBe(jailPos)
  })
})
