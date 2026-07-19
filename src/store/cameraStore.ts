import { create } from 'zustand'

/** 相机飞往目标：玩家格 或 骰子区 */
export type CameraFocusRequest =
  | { kind: 'player'; playerId: number; /** 指定格；缺省用玩家当前逻辑位置 */ tileIndex?: number }
  | { kind: 'dice'; position: [number, number, number] }

/** 骰子实时坐标（投掷过程每帧写入，不走 React 订阅） */
export const diceLiveRef: { current: [number, number, number] } = {
  current: [0, 0.4, 0.6],
}

/** 正在走动的棋子实时坐标 */
export const tokenLiveRef: { current: [number, number, number] } = {
  current: [0, 0.15, 0],
}

export function syncDiceLivePosition(pos: [number, number, number]) {
  diceLiveRef.current = [pos[0], pos[1], pos[2]]
}

export function syncTokenLivePosition(pos: [number, number, number]) {
  tokenLiveRef.current = [pos[0], pos[1], pos[2]]
}

interface CameraStore {
  focusSeq: number
  request: CameraFocusRequest | null
  arrivalSeq: number
  dicePosition: [number, number, number]
  /** 投掷中：相机持续跟随骰子 */
  followDice: boolean
  /** 走动中：相机持续跟随棋子 */
  followToken: boolean
  focusPlayer: (playerId: number, tileIndex?: number) => void
  focusDice: () => void
  setDicePosition: (pos: [number, number, number]) => void
  setFollowDice: (follow: boolean) => void
  setFollowToken: (follow: boolean) => void
  signalArrival: () => void
}

export const useCameraStore = create<CameraStore>((set) => ({
  focusSeq: 0,
  request: null,
  arrivalSeq: 0,
  dicePosition: [0, 0.4, 0.6],
  followDice: false,
  followToken: false,
  focusPlayer: (playerId, tileIndex) =>
    set((s) => ({
      request: { kind: 'player', playerId, tileIndex },
      focusSeq: s.focusSeq + 1,
    })),
  focusDice: () =>
    set((s) => {
      const live = diceLiveRef.current
      const position: [number, number, number] = [live[0], live[1], live[2]]
      return {
        dicePosition: position,
        request: { kind: 'dice', position },
        focusSeq: s.focusSeq + 1,
      }
    }),
  setDicePosition: (pos) => {
    syncDiceLivePosition(pos)
    set({ dicePosition: pos })
  },
  setFollowDice: (follow) => set({ followDice: follow }),
  setFollowToken: (follow) => set({ followToken: follow }),
  signalArrival: () => set((s) => ({ arrivalSeq: s.arrivalSeq + 1 })),
}))
