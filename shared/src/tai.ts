/** Every scoring pattern the engine can award. */
export type TaiKey =
  | 'dealer'
  | 'dealerStreak'
  | 'selfDraw'
  | 'concealed'
  | 'concealedSelfDraw'
  | 'roundWind'
  | 'seatWind'
  | 'dragonPung'
  | 'ownFlower'
  | 'flowerSet'
  | 'eightFlowers'
  | 'singleWait'
  | 'robbingKong'
  | 'kongReplacement'
  | 'lastDiscard'
  | 'lastDraw'
  | 'allChows'
  | 'threeConcealedPungs'
  | 'fourConcealedPungs'
  | 'fiveConcealedPungs'
  | 'allMelded'
  | 'halfMelded'
  | 'allPungs'
  | 'mixedOneSuit'
  | 'pureOneSuit'
  | 'smallThreeDragons'
  | 'greatThreeDragons'
  | 'smallFourWinds'
  | 'greatFourWinds'
  | 'allHonors';

export interface TaiInfo {
  key: TaiKey;
  chinese: string;
  pinyin: string;
  english: string;
  /** Short explanation surfaced in the score breakdown. */
  note: string;
}

export const TAI_INFO: Record<TaiKey, TaiInfo> = {
  dealer: {
    key: 'dealer',
    chinese: '莊家',
    pinyin: 'zhuāng jiā',
    english: 'Dealer',
    note: 'The dealer counts an extra tai whether they win or fire the gun.',
  },
  dealerStreak: {
    key: 'dealerStreak',
    chinese: '連莊拉莊',
    pinyin: 'lián zhuāng lā zhuāng',
    english: 'Dealer streak',
    note: 'Worth 2N+1 tai in total, where N is the number of consecutive dealerships.',
  },
  selfDraw: {
    key: 'selfDraw',
    chinese: '自摸',
    pinyin: 'zì mō',
    english: 'Self-draw',
    note: 'Won on a tile drawn from the wall, so all three opponents pay.',
  },
  concealed: {
    key: 'concealed',
    chinese: '門清',
    pinyin: 'mén qīng',
    english: 'Fully concealed',
    note: 'No chow, pung or exposed kong. A concealed kong is still allowed.',
  },
  concealedSelfDraw: {
    key: 'concealedSelfDraw',
    chinese: '不求 / 門清自摸',
    pinyin: 'bù qiú',
    english: 'Concealed self-draw',
    note: 'Replaces 門清 and 自摸 rather than stacking with them.',
  },
  roundWind: {
    key: 'roundWind',
    chinese: '圈風',
    pinyin: 'quān fēng',
    english: 'Round wind',
    note: 'A pung or kong of the prevailing round wind.',
  },
  seatWind: {
    key: 'seatWind',
    chinese: '門風',
    pinyin: 'mén fēng',
    english: 'Seat wind',
    note: 'A pung or kong of your own seat wind.',
  },
  dragonPung: {
    key: 'dragonPung',
    chinese: '三元牌',
    pinyin: 'sān yuán pái',
    english: 'Dragon pung',
    note: 'One tai per pung or kong of 中, 發 or 白, for any player.',
  },
  ownFlower: {
    key: 'ownFlower',
    chinese: '正花',
    pinyin: 'zhèng huā',
    english: 'Own flower',
    note: 'The season and plant matching your seat: E 春/梅, S 夏/蘭, W 秋/菊, N 冬/竹.',
  },
  flowerSet: {
    key: 'flowerSet',
    chinese: '花槓',
    pinyin: 'huā gàng',
    english: 'Flower set',
    note: 'All four seasons or all four plants. Stacks with 正花.',
  },
  eightFlowers: {
    key: 'eightFlowers',
    chinese: '八仙過海',
    pinyin: 'bā xiān guò hǎi',
    english: 'Eight flowers',
    note: 'Holding all eight bonus tiles wins immediately, scored as a self-draw.',
  },
  singleWait: {
    key: 'singleWait',
    chinese: '獨聽',
    pinyin: 'dú tīng',
    english: 'Single wait',
    note: 'Only one kind of tile could have completed the hand.',
  },
  robbingKong: {
    key: 'robbingKong',
    chinese: '搶槓',
    pinyin: 'qiǎng gàng',
    english: 'Robbing a kong',
    note: 'Won on the tile another player added to their pung. They pay as the discarder.',
  },
  kongReplacement: {
    key: 'kongReplacement',
    chinese: '槓上開花',
    pinyin: 'gàng shàng kāi huā',
    english: 'Win on kong replacement',
    note: 'Self-drew the winning tile as a replacement after a kong or a flower.',
  },
  lastDiscard: {
    key: 'lastDiscard',
    chinese: '河底撈魚',
    pinyin: 'hé dǐ lāo yú',
    english: 'Last discard',
    note: 'Won on the very last discard of the hand.',
  },
  lastDraw: {
    key: 'lastDraw',
    chinese: '海底撈月',
    pinyin: 'hǎi dǐ lāo yuè',
    english: 'Last draw',
    note: 'Self-drew the last live tile in the wall. Stacks with 自摸.',
  },
  allChows: {
    key: 'allChows',
    chinese: '平胡',
    pinyin: 'píng hú',
    english: 'All chows',
    note: 'No flowers, no honors, no triplets, a two-sided wait, and not self-drawn.',
  },
  threeConcealedPungs: {
    key: 'threeConcealedPungs',
    chinese: '三暗刻',
    pinyin: 'sān àn kè',
    english: 'Three concealed pungs',
    note: 'Three triplets formed without calling pung.',
  },
  fourConcealedPungs: {
    key: 'fourConcealedPungs',
    chinese: '四暗刻',
    pinyin: 'sì àn kè',
    english: 'Four concealed pungs',
    note: 'Does not stack with 三暗刻.',
  },
  fiveConcealedPungs: {
    key: 'fiveConcealedPungs',
    chinese: '五暗刻',
    pinyin: 'wǔ àn kè',
    english: 'Five concealed pungs',
    note: 'Does not stack with any other concealed-pung tai.',
  },
  allMelded: {
    key: 'allMelded',
    chinese: '全求',
    pinyin: 'quán qiú',
    english: 'All melded',
    note: 'All five sets called, holding a single tile that waits on the pair.',
  },
  halfMelded: {
    key: 'halfMelded',
    chinese: '半求',
    pinyin: 'bàn qiú',
    english: 'Half melded',
    note: 'The 全求 shape completed by self-draw instead of a discard.',
  },
  allPungs: {
    key: 'allPungs',
    chinese: '碰碰胡',
    pinyin: 'pèng pèng hú',
    english: 'All pungs',
    note: 'Five triplets or kongs plus a pair, with no runs.',
  },
  mixedOneSuit: {
    key: 'mixedOneSuit',
    chinese: '混一色',
    pinyin: 'hùn yī sè',
    english: 'Mixed one suit',
    note: 'A single number suit plus honors.',
  },
  pureOneSuit: {
    key: 'pureOneSuit',
    chinese: '清一色',
    pinyin: 'qīng yī sè',
    english: 'Pure one suit',
    note: 'A single number suit and nothing else. Harder here, since it needs five sets.',
  },
  smallThreeDragons: {
    key: 'smallThreeDragons',
    chinese: '小三元',
    pinyin: 'xiǎo sān yuán',
    english: 'Small three dragons',
    note: 'Two dragon pungs plus the third dragon as the pair. Suppresses 三元牌.',
  },
  greatThreeDragons: {
    key: 'greatThreeDragons',
    chinese: '大三元',
    pinyin: 'dà sān yuán',
    english: 'Great three dragons',
    note: 'Pungs of all three dragons. Suppresses 三元牌.',
  },
  smallFourWinds: {
    key: 'smallFourWinds',
    chinese: '小四喜',
    pinyin: 'xiǎo sì xǐ',
    english: 'Small four winds',
    note: 'Three wind pungs plus the fourth wind as the pair. Wind tai still stack.',
  },
  greatFourWinds: {
    key: 'greatFourWinds',
    chinese: '大四喜',
    pinyin: 'dà sì xǐ',
    english: 'Big four winds',
    note: 'Pungs of all four winds. Suppresses 圈風 and 門風.',
  },
  allHonors: {
    key: 'allHonors',
    chinese: '字一色',
    pinyin: 'zì yī sè',
    english: 'All honors',
    note: 'Winds and dragons only, with no number tiles at all.',
  },
};
