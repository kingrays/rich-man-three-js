/** 可注入随机数，便于测试 */
export type Rng = () => number

export function createRng(seed?: number): Rng {
  if (seed === undefined) {
    return () => Math.random()
  }
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

export function rollDie(rng: Rng): number {
  return Math.floor(rng() * 6) + 1
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}
