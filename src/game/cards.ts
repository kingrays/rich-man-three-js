import type { CardDef } from './types'

/** 机会卡 */
export const CHANCE_CARDS: CardDef[] = [
  {
    id: 'ch1',
    deck: 'chance',
    text: '前进到起点，领取 $200。',
    effect: { kind: 'moveTo', position: 0, collectGo: true },
  },
  {
    id: 'ch2',
    deck: 'chance',
    text: '前进到伊利诺伊大道。若经过起点，领取 $200。',
    effect: { kind: 'moveTo', position: 24, collectGo: true },
  },
  {
    id: 'ch3',
    deck: 'chance',
    text: '前进到圣查尔斯广场。若经过起点，领取 $200。',
    effect: { kind: 'moveTo', position: 11, collectGo: true },
  },
  {
    id: 'ch4',
    deck: 'chance',
    text: '前进到最近的公用事业。若无人拥有则可购买；若已有主人，掷骰并支付 10 倍租金。',
    effect: { kind: 'nearestUtility' },
  },
  {
    id: 'ch5',
    deck: 'chance',
    text: '前进到最近的铁路。若无人拥有则可购买；若已有主人，支付双倍铁路租金。',
    effect: { kind: 'nearestRailroad' },
  },
  {
    id: 'ch6',
    deck: 'chance',
    text: '银行发红利 $50。',
    effect: { kind: 'money', amount: 50 },
  },
  {
    id: 'ch7',
    deck: 'chance',
    text: '获得一张「出狱免费」卡。',
    effect: { kind: 'getOutOfJail' },
  },
  {
    id: 'ch8',
    deck: 'chance',
    text: '后退 3 格。',
    effect: { kind: 'moveSteps', steps: -3 },
  },
  {
    id: 'ch9',
    deck: 'chance',
    text: '直接进监狱。不经过起点，不领取 $200。',
    effect: { kind: 'gotoJail' },
  },
  {
    id: 'ch10',
    deck: 'chance',
    text: '房屋大修：每栋房屋付 $25，每座酒店付 $100。',
    effect: { kind: 'repairs', house: 25, hotel: 100 },
  },
  {
    id: 'ch11',
    deck: 'chance',
    text: '缴纳穷困税 $15。',
    effect: { kind: 'money', amount: -15 },
  },
  {
    id: 'ch12',
    deck: 'chance',
    text: '搭乘阅读铁路。若经过起点，领取 $200。',
    effect: { kind: 'moveTo', position: 5, collectGo: true },
  },
  {
    id: 'ch13',
    deck: 'chance',
    text: '前进到板球大道。',
    effect: { kind: 'moveTo', position: 39, collectGo: true },
  },
  {
    id: 'ch14',
    deck: 'chance',
    text: '你被选为董事会主席，每位玩家付给你 $50。',
    effect: { kind: 'perPlayer', amount: 50 },
  },
  {
    id: 'ch15',
    deck: 'chance',
    text: '建筑贷款到期，领取 $150。',
    effect: { kind: 'money', amount: 150 },
  },
  {
    id: 'ch16',
    deck: 'chance',
    text: '在纵横字谜比赛中获胜，领取 $100。',
    effect: { kind: 'money', amount: 100 },
  },
]

/** 社区基金卡 */
export const CHEST_CARDS: CardDef[] = [
  {
    id: 'ce1',
    deck: 'chest',
    text: '前进到起点，领取 $200。',
    effect: { kind: 'moveTo', position: 0, collectGo: true },
  },
  {
    id: 'ce2',
    deck: 'chest',
    text: '银行错误，给你 $200。',
    effect: { kind: 'money', amount: 200 },
  },
  {
    id: 'ce3',
    deck: 'chest',
    text: '医生费，支付 $50。',
    effect: { kind: 'money', amount: -50 },
  },
  {
    id: 'ce4',
    deck: 'chest',
    text: '股票出售获得 $50。',
    effect: { kind: 'money', amount: 50 },
  },
  {
    id: 'ce5',
    deck: 'chest',
    text: '获得一张「出狱免费」卡。',
    effect: { kind: 'getOutOfJail' },
  },
  {
    id: 'ce6',
    deck: 'chest',
    text: '直接进监狱。不经过起点，不领取 $200。',
    effect: { kind: 'gotoJail' },
  },
  {
    id: 'ce7',
    deck: 'chest',
    text: '度假基金到期，领取 $100。',
    effect: { kind: 'money', amount: 100 },
  },
  {
    id: 'ce8',
    deck: 'chest',
    text: '退税，领取 $20。',
    effect: { kind: 'money', amount: 20 },
  },
  {
    id: 'ce9',
    deck: 'chest',
    text: '今天是你的生日，每位玩家给你 $10。',
    effect: { kind: 'perPlayer', amount: 10 },
  },
  {
    id: 'ce10',
    deck: 'chest',
    text: '人寿保险到期，领取 $100。',
    effect: { kind: 'money', amount: 100 },
  },
  {
    id: 'ce11',
    deck: 'chest',
    text: '医院费，支付 $100。',
    effect: { kind: 'money', amount: -100 },
  },
  {
    id: 'ce12',
    deck: 'chest',
    text: '学费，支付 $50。',
    effect: { kind: 'money', amount: -50 },
  },
  {
    id: 'ce13',
    deck: 'chest',
    text: '咨询费，领取 $25。',
    effect: { kind: 'money', amount: 25 },
  },
  {
    id: 'ce14',
    deck: 'chest',
    text: '街道维修：每栋房屋付 $40，每座酒店付 $115。',
    effect: { kind: 'repairs', house: 40, hotel: 115 },
  },
  {
    id: 'ce15',
    deck: 'chest',
    text: '你在选美比赛中获得第二名，领取 $10。',
    effect: { kind: 'money', amount: 10 },
  },
  {
    id: 'ce16',
    deck: 'chest',
    text: '继承遗产 $100。',
    effect: { kind: 'money', amount: 100 },
  },
]

export function getCard(id: string): CardDef {
  const all = [...CHANCE_CARDS, ...CHEST_CARDS]
  const card = all.find((c) => c.id === id)
  if (!card) throw new Error(`未知卡牌: ${id}`)
  return card
}
