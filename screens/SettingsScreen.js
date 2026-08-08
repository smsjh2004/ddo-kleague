import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { TEAM_COLORS } from '../constants/TeamData';
import { sectionLabelBase } from '../constants/sharedStyles';
import { showAlert } from '../utils/appAlert';
import { showRewardedAd } from '../utils/ads';
import { Ionicons } from '@expo/vector-icons';

const APP_VERSION = require('../app.json').expo.version;

// TEMP: premium upgrade isn't wired to a real IAP SDK yet - hide the upgrade
// row until that ships in a future update. Flip back to true (or delete this
// check) once it's ready. Ad-free below is a separate, already-shipped feature.
const PREMIUM_ENABLED = false;

const AD_FREE_DURATION_MS = 24 * 60 * 60 * 1000;

const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScPzljP9QGuTgetY-wKZXqhwWrCK6yZlkhniD90er9Gcqajww/viewform?usp=publish-editor';

function formatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  return `${minutes}분 남음`;
}

const FAQ_ITEMS = [
  {
    q: '직관일지는 어떻게 작성하나요?',
    a: '경기 일정 탭에서 관람한 경기를 선택하거나, 나의 직관 탭의 + 버튼을 눌러 새 직관일지를 작성할 수 있어요.',
  },
  {
    q: '기록한 데이터는 안전하게 보관되나요?',
    a: '로그인 후 작성한 직관일지, 지출 내역, 굿즈 정보는 서버에 저장되어 기기를 바꿔도 유지됩니다.',
  },
  {
    q: '마이팀이나 닉네임을 변경하고 싶어요.',
    a: '마이페이지 프로필 옆의 연필 아이콘을 눌러 마이팀, 닉네임, 프로필 사진을 언제든 수정할 수 있어요.',
  },
  {
    q: '업적은 어떻게 달성하나요?',
    a: '직관 횟수, 승수, 연승 기록, 방문 경기장 수 등 직관일지 데이터를 기반으로 자동 계산되어 달성 시 마이페이지에 표시돼요.',
  },
];

// Draft ToS covering the standard clauses required under Korea's 약관의 규제에
// 관한 법률 (unfair-terms review) plus the 전자상거래법 청약철회 disclosure that
// becomes mandatory once real in-app payment ships. [대괄호] placeholders need
// the operator's real business info before this goes live - see the notice
// at the bottom of the text.
const TERMS_TEXT = `제1조 (목적)
이 약관은 삼인용스튜디오(이하 "회사")가 제공하는 또직관 애플리케이션 및 관련 제반 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 이용자가 K리그 등 축구 경기 직관 기록, 지출 내역, 굿즈 정보를 작성·저장·관리하고 친구와 공유할 수 있도록 회사가 제공하는 모바일 애플리케이션 서비스를 말합니다.
2. "이용자"란 이 약관에 따라 회사가 제공하는 서비스를 이용하는 회원을 말합니다.
3. "회원"이란 카카오 계정을 통한 소셜 로그인 절차를 거쳐 회사와 이용계약을 체결하고 아이디를 부여받은 자를 말합니다.
4. "게시물"이란 회원이 서비스를 이용하며 게시한 직관일지, 사진, 리뷰, 댓글 등 일체의 정보를 말합니다.

제3조 (약관의 게시 및 개정)
1. 회사는 이 약관의 내용을 이용자가 쉽게 확인할 수 있도록 서비스 초기 화면 또는 마이페이지 내 연결화면에 게시합니다.
2. 회사는 「약관의 규제에 관한 법률」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」(이하 "정보통신망법") 등 관계 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.
3. 회사가 약관을 개정할 경우 적용일자 및 개정사유를 명시하여 적용일자 최소 7일 전(이용자에게 불리하거나 중대한 변경의 경우 30일 전)부터 서비스 내 공지사항을 통해 공지합니다.
4. 이용자가 개정약관 시행일 이후에도 서비스를 계속 이용하는 경우 개정약관에 동의한 것으로 봅니다. 이용자가 개정약관에 동의하지 않는 경우 이용계약을 해지(회원탈퇴)할 수 있습니다.

제4조 (약관 외 준칙)
이 약관에서 정하지 아니한 사항과 이 약관의 해석에 관하여는 전자상거래 등에서의 소비자보호에 관한 법률, 정보통신망법, 개인정보 보호법, 콘텐츠산업 진흥법 등 관계 법령 및 상관례에 따릅니다.

제5조 (이용계약의 체결 및 회원가입)
1. 이용계약은 이용자가 카카오 계정을 통한 소셜 로그인에 동의하고, 회사가 이러한 신청에 대하여 승낙함으로써 체결됩니다.
2. 회사는 다음 각 호에 해당하는 신청에 대하여는 승낙을 거부하거나 사후에 이용계약을 해지할 수 있습니다.
   가. 실명이 아니거나 타인의 명의를 이용한 경우
   나. 허위의 정보를 기재하거나 회사가 제시하는 내용을 기재하지 않은 경우
   다. 만 14세 미만 아동이 법정대리인의 동의 없이 가입한 경우
   라. 이전에 이 약관에 의하여 자격을 상실한 사실이 있는 경우
3. 서비스는 만 14세 이상의 이용자를 대상으로 하며, 만 14세 미만 아동의 개인정보는 「개인정보 보호법」에 따라 법정대리인의 동의 없이 수집하지 않습니다.

제6조 (개인정보의 보호)
회사는 관계 법령이 정하는 바에 따라 이용자의 개인정보를 보호하기 위해 노력하며, 개인정보의 수집, 이용, 보관 및 파기 등에 관한 사항은 별도로 게시하는 "개인정보 처리방침"에 따릅니다.

제7조 (계정 관리에 대한 의무)
1. 회원의 계정에 대한 관리 책임은 회원 본인에게 있으며, 이를 제3자가 이용하도록 하여서는 안 됩니다.
2. 회원은 카카오 계정 정보가 도용되거나 제3자에 의해 사용되고 있음을 인지한 경우 즉시 회사에 통지하고 회사의 안내에 따라야 합니다.

제8조 (회사의 의무)
1. 회사는 관계 법령과 이 약관이 금지하거나 미풍양속에 반하는 행위를 하지 않으며, 계속적, 안정적으로 서비스를 제공하기 위해 노력합니다.
2. 회사는 이용자가 안전하게 서비스를 이용할 수 있도록 개인정보(신용정보 포함) 보호를 위한 보안시스템을 갖추어야 하며 개인정보처리방침을 공시하고 준수합니다.
3. 회사는 서비스 이용과 관련하여 이용자로부터 제기되는 의견이나 불만이 정당하다고 인정할 경우에는 이를 처리하기 위하여 노력합니다.

제9조 (이용자의 의무)
이용자는 다음 각 호의 행위를 하여서는 안 됩니다.
1. 신청 또는 변경 시 허위 내용을 등록하는 행위
2. 타인의 정보를 도용하는 행위
3. 회사가 게시한 정보를 임의로 변경하는 행위
4. 회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등을 송신 또는 게시하는 행위
5. 회사와 기타 제3자의 저작권 등 지식재산권을 침해하는 행위
6. 회사와 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위
7. 외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위
8. 관계 법령에 위배되는 방법으로 서비스를 이용하거나 서비스를 이용하여 영리 목적의 활동을 하는 행위

제10조 (서비스의 제공 및 변경)
1. 회사는 다음과 같은 업무를 수행합니다.
   가. 직관 기록(경기 결과, 관람 후기, 사진 등) 작성 및 관리 기능
   나. 직관 관련 지출 내역 기록 및 통계 제공 기능
   다. 굿즈 보관함 및 원정 구단 도장깨기(스탬프) 기능
   라. 친구 등록 및 직관 기록 공유 기능
   마. 기타 회사가 추가 개발하거나 제휴를 통해 회원에게 제공하는 일체의 서비스
2. 회사는 서비스의 내용, 운영상 또는 기술상의 필요에 따라 제공하고 있는 서비스의 전부 또는 일부를 변경할 수 있으며, 이 경우 변경 사유와 변경될 서비스의 내용 및 제공일자 등을 사전에 공지합니다.

제11조 (서비스의 중단)
1. 회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.
2. 회사는 제1항의 사유로 서비스의 제공이 일시적으로 중단됨으로 인하여 이용자 또는 제3자가 입은 손해에 대하여 회사에 고의 또는 중과실이 없는 한 배상하지 않습니다.

제12조 (게시물의 저작권 및 관리)
1. 회원이 서비스에 작성한 게시물(직관일지, 사진, 후기 등)의 저작권은 이를 작성한 회원에게 귀속됩니다.
2. 회원은 자신이 서비스 내에 게시하는 게시물이 제3자의 저작권 등 지식재산권을 침해하지 않는다는 점을 보장합니다.
3. 회원은 자신의 게시물이 서비스 화면 내 노출, 통계 산출, 친구 공유 기능 등 서비스 운영·개선에 필요한 범위 내에서 회사에 의해 저장·전송·복제될 수 있음에 동의합니다.
4. 회사는 회원이 게시하거나 등록하는 서비스 내 게시물이 관계 법령 및 이 약관에 위반된다고 판단되는 경우 사전 통지 없이 게시물을 삭제하거나 이동 또는 등록 거부할 수 있습니다.

제13조 (광고의 게재 및 이용)
1. 회사는 서비스 운영과 관련하여 서비스 화면, 앱 내 알림 등에 광고를 게재할 수 있습니다.
2. 회원은 서비스 이용 시 노출되는 광고 게재에 대해 동의하는 것으로 봅니다.
3. 회사는 회원이 리워드 광고 시청 등 회사가 정한 절차를 완료하는 경우 광고 제거 등 부가 혜택을 제공할 수 있으며, 구체적인 조건은 서비스 내 화면에서 별도로 안내합니다.

제14조 (유료서비스 이용 및 청약철회)
1. 회사는 향후 프리미엄 구독 등 유료서비스(이하 "유료서비스")를 제공할 수 있으며, 유료서비스의 종류, 이용요금 및 결제방법은 서비스 내 화면에 게시합니다.
2. 이용자는 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조에 따라 유료서비스 결제일 또는 서비스 이용 가능일로부터 7일 이내에 청약철회를 할 수 있습니다. 다만 다음 각 호의 경우에는 관계 법령이 정하는 바에 따라 청약철회가 제한될 수 있습니다.
   가. 이용자에게 책임 있는 사유로 콘텐츠가 멸실 또는 훼손된 경우
   나. 콘텐츠의 제공이 개시된 경우(다만 가분적 콘텐츠의 경우 제공이 개시되지 않은 부분은 청약철회 가능)
   다. 이용이 개시된 경우 그 대가가 감소한 경우
3. 청약철회를 원하는 이용자는 마이페이지 내 "버그 제보 및 의견 보내기" 채널을 통해 회사에 요청할 수 있으며, 회사는 관계 법령이 정하는 기한 내에 대금을 환급합니다.
4. 앱스토어(Google Play, App Store 등)를 통한 인앱결제의 경우 각 스토어 운영정책에 따른 환불 절차가 우선 적용될 수 있습니다.

제15조 (계약해지 및 이용제한)
1. 회원은 언제든지 마이페이지 내 회원탈퇴 기능을 통해 이용계약 해지를 신청할 수 있으며, 회사는 관계 법령이 정하는 바에 따라 이를 즉시 처리합니다.
2. 회사는 회원이 제9조의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우, 경고, 일시정지, 영구이용정지 등으로 서비스 이용을 단계적으로 제한할 수 있습니다.

제16조 (회원탈퇴 시 정보의 처리)
회원탈퇴 시 회원이 작성한 직관일지, 지출 내역, 굿즈 정보 등 서비스 이용 기록 및 개인정보는 관계 법령에 특별한 규정이 있는 경우를 제외하고 지체 없이 파기됩니다. 자세한 사항은 "개인정보 처리방침"을 따릅니다.

제17조 (손해배상)
회사는 무료로 제공되는 서비스와 관련하여 관련 법령에 특별한 규정이 없는 한 회원에게 어떠한 손해가 발생하더라도 회사의 고의 또는 중대한 과실로 인한 경우를 제외하고 이에 대하여 책임을 부담하지 않습니다.

제18조 (면책조항)
1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.
2. 회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.
3. 회사는 이용자가 서비스를 이용하여 기대하는 손익이나 서비스를 통해 얻은 자료로 인한 손해에 관하여 책임을 지지 않습니다.
4. 회사는 이용자가 게시한 정보, 자료, 사실의 신뢰도, 정확성 등 내용에 관하여는 책임을 지지 않습니다.

제19조 (분쟁해결 및 재판관할)
1. 회사와 이용자는 서비스와 관련하여 발생한 분쟁을 원만하게 해결하기 위하여 필요한 모든 노력을 하여야 합니다.
2. 제1항의 노력에도 불구하고 분쟁이 해결되지 않을 경우 양 당사자는 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 설치된 전자거래분쟁조정위원회 등에 조정을 신청할 수 있습니다.
3. 회사와 이용자 간에 제기된 소송은 대한민국 법을 준거법으로 하며, 민사소송법상의 관할법원에 제기합니다.

제20조 (운영자 정보)
- 서비스명: 또직관
- 운영: 삼인용스튜디오 (개인 개발자)
- 대표: 신민성
- 문의: saminyong2004@gmail.com

부칙
이 약관은 2026년 7월 24일부터 시행합니다.`;

const THEME_MODE_OPTIONS = [
  { key: 'system', label: '시스템', icon: 'phone-portrait-outline' },
  { key: 'light', label: '라이트', icon: 'sunny-outline' },
  { key: 'dark', label: '다크', icon: 'moon-outline' },
];

function getTeamColors(teamName) {
  const key = Object.keys(TEAM_COLORS).find((k) => TEAM_COLORS[k].name === teamName);
  return key ? TEAM_COLORS[key].colors.slice(0, 2) : [];
}


function SettingsRow({ icon, iconColor, label, value, onPress, textColor, showChevron = true }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <Ionicons name={icon} size={18} color={iconColor} style={styles.rowIcon} />
      <Text style={[styles.rowLabel, { color: textColor }]}>{label}</Text>
      {value ? <Text style={[styles.rowValue, { color: iconColor }]}>{value}</Text> : null}
      {onPress && showChevron ? (
        <Ionicons name="chevron-forward" size={16} color={iconColor} />
      ) : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({
  theme = 'light',
  myTeam,
  onBack,
  onLogout,
  onWithdraw,
  themeMode = 'system',
  onSetThemeMode,
  customAccent,
  onSetCustomAccent,
  isPremium,
  onSetIsPremium,
  adFreeUntil,
  onSetAdFreeUntil,
}) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';
  const [detailKey, setDetailKey] = useState(null);
  const [pendingAccent, setPendingAccent] = useState(customAccent || '');
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const teamColors = getTeamColors(myTeam);

  // Premium: 프리미엄 업그레이드 (placeholder for future in-app purchase). 하루
  // 광고 제거하기 is a real rewarded ad now (adFreeUntil/onSetAdFreeUntil are
  // lifted to App.js so the ad-free window can also gate banners on the main tabs).
  const [now, setNow] = useState(Date.now());
  const [adLoading, setAdLoading] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  const isAdFreeActive = adFreeUntil > now;

  const handleWatchRewardedAd = async () => {
    setAdLoading(true);
    const earned = await showRewardedAd();
    setAdLoading(false);
    if (!earned) return;
    const base = Math.max(Date.now(), adFreeUntil);
    const next = base + AD_FREE_DURATION_MS;
    onSetAdFreeUntil(next);
    showAlert('광고 제거 완료', '24시간 동안 광고가 제거됩니다!');
  };

  // Real in-app purchase isn't wired up yet, so this simulates the purchase
  // flow directly - lets premium-gated limits (diary length, photo count) be
  // toggled and tested today (same pattern as the ad-free simulation above).
  const handleUpgradePress = () => {
    if (isPremium) {
      showAlert('프리미엄 해지', '프리미엄 구독을 해지하시겠어요?', [
        { text: '취소', style: 'cancel' },
        { text: '해지하기', style: 'destructive', onPress: () => onSetIsPremium(false) },
      ]);
    } else {
      showAlert('프리미엄 업그레이드', '프리미엄으로 업그레이드하시겠어요? 직관일지를 999자까지 쓰고 이미지를 10장까지 등록할 수 있어요.', [
        { text: '취소', style: 'cancel' },
        { text: '업그레이드', onPress: () => onSetIsPremium(true) },
      ]);
    }
  };

  const confirmLogout = () => {
    showAlert('로그아웃', '정말 로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: onLogout },
    ]);
  };

  const confirmWithdraw = () => {
    showAlert(
      '회원탈퇴',
      '탈퇴 시 직관일지, 지출 내역, 굿즈 등 모든 기록이 삭제되며 복구할 수 없습니다. 정말 탈퇴하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        { text: '탈퇴하기', style: 'destructive', onPress: onWithdraw },
      ]
    );
  };

  const openFeedbackForm = async () => {
    try {
      await Linking.openURL(FEEDBACK_FORM_URL);
    } catch (e) {
      showAlert('페이지를 열 수 없어요', '잠시 후 다시 시도해주세요.');
    }
  };

  const DETAIL_CONTENT = {
    faq: {
      title: '자주 묻는 질문',
      render: () => (
        <>
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <View key={idx} style={[styles.faqItem, { borderColor: activeColors.borderColor }]}>
                <TouchableOpacity
                  style={styles.faqQRow}
                  onPress={() => setOpenFaqIndex(isOpen ? null : idx)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.faqQ, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>Q. {item.q}</Text>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={activeColors.textMuted} />
                </TouchableOpacity>
                {isOpen && (
                  <Text style={[styles.faqA, { color: activeColors.textBody }]}>A. {item.a}</Text>
                )}
              </View>
            );
          })}
        </>
      ),
    },
    terms: {
      title: '서비스 이용약관',
      render: () => (
        <Text style={[styles.plainText, { color: activeColors.textBody }]}>
          {TERMS_TEXT}
        </Text>
      ),
    },
    privacy: {
      title: '개인정보 처리방침',
      render: () => (
        <Text style={[styles.plainText, { color: activeColors.textBody }]}>
          1. 수집하는 개인정보 항목{'\n'}
          카카오 계정 로그인 시 닉네임, 프로필 사진 등 최소한의 정보를 수집하며, 이용자가 직접 작성한 직관일지, 지출 내역, 굿즈 정보를 저장합니다.{'\n\n'}
          2. 개인정보의 이용 목적{'\n'}
          로그인 및 서비스 제공, 기기 간 데이터 동기화를 위한 목적으로만 이용됩니다.{'\n\n'}
          3. 개인정보의 보관 및 파기{'\n'}
          회원탈퇴 시 수집된 개인정보와 기록은 지체 없이 파기됩니다.{'\n\n'}
          ※ 본 방침은 서비스 출시 전 최종 검토가 필요한 초안입니다.
        </Text>
      ),
    },
    customTheme: {
      title: '테마 색상',
      render: () => (
        <>
          <Text style={[styles.themeHint, { color: activeColors.textMuted }]}>
            앱 전반의 포인트 색상을 원하는 색으로 바꿀 수 있어요. 라이트/다크 모드 모두 같은 색으로 표시돼요.
          </Text>

          <View style={styles.quickRow}>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: activeColors.borderColor }, !pendingAccent && { borderColor: activeColors.brandNavy, borderWidth: 2 }]}
              onPress={() => setPendingAccent('')}
            >
              <View style={[styles.quickSwatch, styles.defaultSwatch]}>
                <View style={{ flex: 1, backgroundColor: '#001C48' }} />
                <View style={{ flex: 1, backgroundColor: '#EE3224' }} />
              </View>
              <Text style={[styles.quickBtnText, { color: activeColors.textBody }]}>기본</Text>
            </TouchableOpacity>

            {teamColors.length === 0 ? (
              <View style={[styles.quickBtn, styles.quickBtnDisabled, { borderColor: activeColors.borderColor }]}>
                <View style={[styles.quickSwatch, { backgroundColor: '#cccccc' }]} />
                <Text style={[styles.quickBtnText, { color: activeColors.textBody }]}>마이팀 미설정</Text>
              </View>
            ) : (
              teamColors.map((hex, idx) => (
                <TouchableOpacity
                  key={hex}
                  style={[
                    styles.quickBtn,
                    { borderColor: activeColors.borderColor },
                    pendingAccent === hex && { borderColor: activeColors.brandNavy, borderWidth: 2 },
                  ]}
                  onPress={() => setPendingAccent(hex)}
                >
                  <View style={[styles.quickSwatch, { backgroundColor: hex }]} />
                  <Text style={[styles.quickBtnText, { color: activeColors.textBody }]}>
                    마이팀 컬러 {idx + 1}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: activeColors.brandNavy }]}
            onPress={() => {
              onSetCustomAccent(pendingAccent);
              setDetailKey(null);
            }}
          >
            <Text style={styles.applyBtnText}>적용</Text>
          </TouchableOpacity>
        </>
      ),
    },
  };

  if (detailKey) {
    const detail = DETAIL_CONTENT[detailKey];
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
        <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
          <TouchableOpacity onPress={() => setDetailKey(null)} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>{detail.title}</Text>
          <View style={styles.headerBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">{detail.render()}</ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>설정</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>테마</Text>
        <View style={[styles.sectionCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <View style={styles.themeModeBlock}>
            <Text style={[styles.themeModeLabel, { color: activeColors.textBody }]}>화면 모드</Text>
            <View style={[styles.segmentedRow, { backgroundColor: activeColors.bgTag }]}>
              {THEME_MODE_OPTIONS.map((opt) => {
                const isActive = themeMode === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.segmentedBtn, isActive && { backgroundColor: activeColors.bgCard }]}
                    onPress={() => onSetThemeMode(opt.key)}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={14}
                      color={isActive ? (isDark ? '#ffffff' : activeColors.brandNavy) : activeColors.textMuted}
                    />
                    <Text style={[styles.segmentedBtnText, { color: isActive ? (isDark ? '#ffffff' : activeColors.brandNavy) : activeColors.textMuted }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={[styles.divider, { marginLeft: 0, backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon="color-palette-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="테마 색상"
            onPress={() => setDetailKey('customTheme')}
          />
        </View>

        {PREMIUM_ENABLED && (
          <>
            <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>프리미엄</Text>
            <View style={[styles.sectionCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
              <SettingsRow
                icon="diamond-outline"
                iconColor="#FBC02D"
                textColor={activeColors.textBody}
                label={isPremium ? '프리미엄 이용 중' : '프리미엄 업그레이드'}
                value={isPremium ? '해지하기' : '업그레이드'}
                onPress={handleUpgradePress}
              />
            </View>
          </>
        )}

        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>광고</Text>
        <View style={[styles.sectionCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <SettingsRow
            icon={isAdFreeActive ? 'checkmark-circle-outline' : (adLoading ? 'hourglass-outline' : 'play-circle-outline')}
            iconColor={isAdFreeActive ? '#10B981' : activeColors.textMuted}
            textColor={activeColors.textBody}
            label={adLoading ? '광고 불러오는 중...' : '하루 광고 제거하기'}
            value={isAdFreeActive ? formatRemaining(adFreeUntil - now) : null}
            onPress={isAdFreeActive || adLoading ? undefined : handleWatchRewardedAd}
            showChevron={!isAdFreeActive}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>정보</Text>
        <View style={[styles.sectionCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <SettingsRow
            icon="help-circle-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="자주 묻는 질문"
            onPress={() => setDetailKey('faq')}
          />
          <View style={[styles.divider, { backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon="information-circle-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="버전정보"
            value={`v${APP_VERSION}`}
          />
          <View style={[styles.divider, { backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon="document-text-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="서비스 이용약관"
            onPress={() => setDetailKey('terms')}
          />
          <View style={[styles.divider, { backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon="shield-checkmark-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="개인정보 처리방침"
            onPress={() => setDetailKey('privacy')}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>지원</Text>
        <View style={[styles.sectionCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="버그 제보 및 의견 보내기"
            onPress={openFeedbackForm}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>계정</Text>
        <View style={[styles.sectionCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <SettingsRow
            icon="log-out-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="로그아웃"
            onPress={confirmLogout}
          />
          <View style={[styles.divider, { backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon="person-remove-outline"
            iconColor="#EE3224"
            textColor="#EE3224"
            label="회원탈퇴"
            onPress={confirmWithdraw}
            showChevron={false}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    ...sectionLabelBase,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
  },
  sectionCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  rowIcon: {
    width: 20,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
  },
  rowValue: {
    fontSize: 12.5,
    fontWeight: '700',
    marginRight: 4,
  },
  divider: {
    height: 1,
    marginLeft: 44,
  },
  faqItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  faqQRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  faqQ: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '900',
  },
  faqA: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 10,
  },
  plainText: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 21,
  },
  themeModeBlock: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  themeModeLabel: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  segmentedRow: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
  },
  segmentedBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 6,
  },
  segmentedBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  themeHint: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 20,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  quickBtnDisabled: {
    opacity: 0.4,
  },
  quickSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  defaultSwatch: {
    borderWidth: 0,
  },
  quickBtnText: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  applyBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
});
