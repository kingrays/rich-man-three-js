import { create } from 'zustand'
import { GO_SALARY, STARTING_CASH } from '../game/board'
import { createLobbyState, reduce } from '../game/engine'
import { ANIMAL_KINDS, type GameAction, type GameState } from '../game/types'

const STORAGE_KEY = 'rich-man-save-v1'

interface GameStore {
  state: GameState
  dispatch: (action: GameAction) => void
  /** 结束本局并清空存档，回到大厅 */
  reset: () => void
}

/** 恢复存档时修正动画中断等不可恢复阶段 */
function sanitizePersistedState(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') return createLobbyState()
  const base = createLobbyState()
  const parsed = raw as Partial<GameState>

  let state: GameState = {
    ...base,
    ...parsed,
    players: Array.isArray(parsed.players) ? parsed.players : [],
    properties: parsed.properties ?? base.properties,
    log: Array.isArray(parsed.log) ? parsed.log : [],
    startingCash:
      typeof parsed.startingCash === 'number' ? parsed.startingCash : STARTING_CASH,
    goSalary: typeof parsed.goSalary === 'number' ? parsed.goSalary : GO_SALARY,
  }

  // 兼容旧存档：补全棋子角色与经济字段
  state = {
    ...state,
    players: state.players.map((p, i) => ({
      ...p,
      animalKind: p.animalKind ?? ANIMAL_KINDS[i % ANIMAL_KINDS.length]!,
    })),
  }

  if (state.phase === 'lobby' || state.players.length === 0) {
    return createLobbyState()
  }

  // 掷骰动画中刷新：回到等待掷骰，避免卡住
  if (state.phase === 'rolling') {
    return { ...state, phase: 'waitingRoll', lastDice: null }
  }

  // 棋子移动动画中刷新：逻辑位置已更新，补完落地结算
  if (state.phase === 'moving') {
    return reduce(state, { type: 'FINISH_MOVE' })
  }

  return state
}

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createLobbyState()
    return sanitizePersistedState(JSON.parse(raw))
  } catch {
    return createLobbyState()
  }
}

function saveState(state: GameState) {
  try {
    if (state.phase === 'lobby') {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 存储满或隐私模式：忽略，不影响本局游玩
  }
}

function clearSave() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: loadState(),
  dispatch: (action) => {
    const next = reduce(get().state, action)
    saveState(next)
    set({ state: next })
  },
  reset: () => {
    clearSave()
    set({ state: createLobbyState() })
  },
}))
