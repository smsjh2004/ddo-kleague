const REFEREE_ZONES = [
  {
    min: 0,
    max: 20,
    area: '뒷목 구역',
    emoji: '🤬',
    texts: [
      '주심 눈 수술 시급 (퇴근길 조심해라)',
      'VAR 카메라도 고개를 저었다 (총체적 난국)',
      '심판 대신 관중이 봐도 이거보단 낫겠다',
      '오늘 경기 MOM은 심판이다 (다른 의미로)',
      '판정 규탄 대자보 붙여야 할 판',
    ],
  },
  {
    min: 21,
    max: 45,
    area: '답답 구역',
    emoji: '😮💨',
    texts: [
      'VAR은 뒀다 뭐함? (답답해 미침)',
      '판정 하나하나가 다 미스터리',
      '심판만 보면 한숨부터 나옴',
      '답답함에 리모컨 던질 뻔',
      '오심 빙고 한 줄 완성',
    ],
  },
  {
    min: 46,
    max: 65,
    area: '무난 구역',
    emoji: '😐',
    texts: [
      '그냥저냥 평범했음 (이 정도면 선방)',
      '욕하기도 칭찬하기도 애매한 판정',
      '물 흐르듯 무난하게 흘러간 경기',
      '공기 같은 존재감의 심판',
      '큰 이슈 없이 넘어간 하루',
    ],
  },
  {
    min: 66,
    max: 85,
    area: '만족 구역',
    emoji: '🧐',
    texts: [
      '판정 깔끔했음 (리스펙트)',
      '오늘 심판 좀 하는데?',
      '믿고 보는 판정, 안심되는 직관',
      '큰 불만 없이 몰입해서 본 경기',
      '심판 유니폼 입혀도 되겠다 (칭찬)',
    ],
  },
  {
    min: 86,
    max: 100,
    area: '성인군자 구역',
    emoji: '😇',
    texts: [
      '황금 포청천 재림 (연맹에서 상 줘야 됨)',
      '심판계의 GOAT 등장',
      '오심 제로, 완벽 그 자체',
      '명예의 전당에 헌액해야 할 판정',
      '이 정도면 심판 팬클럽 결성 각',
    ],
  },
];

export function getRefereeStatus(score) {
  const zone = REFEREE_ZONES.find((z) => score >= z.min && score <= z.max) || REFEREE_ZONES[REFEREE_ZONES.length - 1];
  const text = zone.texts[score % zone.texts.length];
  return { emoji: zone.emoji, text, area: zone.area };
}
