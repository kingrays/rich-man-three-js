import { create } from 'zustand'

/** 纯 UI 状态（不进存档） */
interface UiStore {
  /** 正在查看详情的格子 id；null 表示未打开 */
  inspectedTileId: number | null
  /** 打开格子详情提示 */
  inspectTile: (tileId: number) => void
  /** 关闭格子详情 */
  closeTileInspect: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  inspectedTileId: null,
  inspectTile: (tileId) => set({ inspectedTileId: tileId }),
  closeTileInspect: () => set({ inspectedTileId: null }),
}))
