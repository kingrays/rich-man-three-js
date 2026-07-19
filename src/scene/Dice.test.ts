import { describe, expect, it } from 'vitest'
import { Euler, Quaternion } from 'three'
import { faceUpFromQuat } from '../scene/Dice'

describe('骰子朝上面识别', () => {
  it('单位朝向时顶面为 1', () => {
    expect(faceUpFromQuat(0, 0, 0, 1)).toBe(1)
  })

  it('绕 X 转 180° 后顶面为 6', () => {
    const q = new Quaternion().setFromEuler(new Euler(Math.PI, 0, 0))
    expect(faceUpFromQuat(q.x, q.y, q.z, q.w)).toBe(6)
  })

  it('绕 X 转 -90° 后顶面为 2', () => {
    const q = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0))
    expect(faceUpFromQuat(q.x, q.y, q.z, q.w)).toBe(2)
  })
})
