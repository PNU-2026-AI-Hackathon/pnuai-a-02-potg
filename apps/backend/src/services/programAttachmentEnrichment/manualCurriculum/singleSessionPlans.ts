/**
 * 하루짜리 만들기 수업과, 회차표가 아예 없는 모집 포스터.
 *
 * 이 계획서들은 회차표 대신 `<활동 계획>` 한 덩어리만 싣는다. 같은 날 시간대만 나눠
 * 여러 건으로 등록돼 있어 건마다 1회차로 넣는다. 시간대는 원본 등록대로 두는 편이
 * 낫다는 판단에 따라 합치지 않는다.
 */

import type { ManualCurriculumEntry } from './types';

/** 하루짜리 수업 하나를 1회차로 만든다. 여러 시간대가 같은 계획서를 쓴다. */
function singleSession(source: string, activity: string, teachingMethod?: string, instructor?: string) {
  return {
    source,
    rows: [{ session: 1, date: null, activity, teachingMethod: teachingMethod ?? null, notes: instructor ?? null }],
  } satisfies ManualCurriculumEntry;
}

const CANDLE = '<활동 계획>\n'
  + '1. 인사, 간단한 캔들 설명\n'
  + '2. 만드는 방법 안내\n'
  + '3. 미리 녹여둔 왁스에 향료를 넣어 섞어준다.\n'
  + '4. 준비된 유리용기에 왁스를 부어준다.\n'
  + '5. 왁스가 굳는동안 주의사항 안내\n'
  + '6. 왁스 파츠를 사용하여 꾸며준다.\n'
  + '7. 완성 후 크리스마스 계획 이야기 나누고 사진찍고 포장하여 마무리!';

const SOAP = '<활동 계획>\n'
  + '* 크리스마스에 대해 서로 이야기 나누어 본다.\n'
  + '* MP비누의 성질을 설명하고 주의점에 대해 설명한다\n'
  + '* 만드는 방법과 도구에 대해 설명한다\n\n'
  + '<비누만들기>\n'
  + '1. 산타 모자 및 나무 부분의 색을 선택한다\n'
  + '2. 녹인 비누베이스에 선택한 색과 향을 넣고 천천히 저어 준다\n'
  + '3. 해당 부분에 비누액을 넣고 굳힌다\n'
  + '4. 산타 및 트리 바디 부분의 색을 선택한다\n'
  + '5. 녹인 비누베이스에 선택한 색과 향을 넣고 천천히 저어 준다\n'
  + '6. 몰드에 비누액을 모두 붓고 굳힌다\n'
  + '7. 굳은 비누를 몰드에서 탈형하고 포장하여 상자에 담는다';

const HIP_POT = '<활동 계획>\n'
  + '1. 힙팟 몰드에 간단한 디자인 스케치하기\n'
  + '2. 조색에 대해 간략하게 설명 후 원하는 색 조색하기\n'
  + '3. 색을 칠하고 건조시키기\n'
  + '4. 화분 심고 데코하기';

const KEYRING = '*교육\n'
  + '-〈안녕, 팝콘〉 책을 함께 읽어본다.\n'
  + '-그림책 주인공을 통하여 반려동물이 주는 의미를 이해한다.\n\n'
  + '*실습 : 모루 동물인형키링만들기';

const CANDLE_SOURCE = '향기로운 크리스마스 캔들 만들기 강의계획서 이미지의 <활동 계획>.'
  + ' 같은 계획서를 세 시간대(10:00·11:00·12:00)가 함께 쓴다.';
const SOAP_SOURCE = '아기자기 크리스마스 비누 만들기 강의계획서 이미지의 <활동 계획>과 <비누만들기>.'
  + ' 같은 계획서를 두 시간대(10:00·11:30)가 함께 쓴다.';
const HIP_POT_SOURCE = '크리스마스 느낌 가득! 힙팟 클래스 강의계획서 이미지의 <활동 계획>.'
  + ' 같은 계획서를 두 시간대(14:00·15:30)가 함께 쓴다.';

export const SINGLE_SESSION_ENTRIES: Record<number, ManualCurriculumEntry> = {
  3649: {
    ...singleSession(
      '여름방학 새 친구! 모루동물인형 키링만들기 강의계획서 이미지의 1차시 표 (차시 | 일자 | 교육내용 | 비고)',
      KEYRING,
      'ppt강의, 실습',
    ),
    content: [{
      label: '강의목표',
      value: '〈안녕,팝콘〉라는 책을 함께 읽어보고, 반려동물의 소중함을 알아본다.',
    }],
  },
  3779: singleSession(CANDLE_SOURCE, CANDLE, '(프린터물)', '조민화'),
  3780: singleSession(CANDLE_SOURCE, CANDLE, '(프린터물)', '조민화'),
  3781: singleSession(CANDLE_SOURCE, CANDLE, '(프린터물)', '조민화'),
  3782: singleSession(SOAP_SOURCE, SOAP, '(ppt, 강의와 설명 등)'),
  3783: singleSession(SOAP_SOURCE, SOAP, '(ppt, 강의와 설명 등)'),
  4114: singleSession(HIP_POT_SOURCE, HIP_POT, 'ppt자료 및 동영상 시청', '구민정'),
  4115: singleSession(HIP_POT_SOURCE, HIP_POT, 'ppt자료 및 동영상 시청', '구민정'),

  // 크리스마스 행사 II 포스터 한 장에 두 프로그램이 나란히 실려 있어 값이 서로 섞였다.
  // 각자에게 맞는 내용만 남기고, 옆 칸에서 딸려 온 값은 뺀다.
  3422: {
    source: '금정구 작은도서관 크리스마스 행사 II 포스터의 왼쪽 칸(샌드아트로 만나는 슈퍼거북).'
      + ' 오른쪽 칸(램프 장식 만들기)의 값이 섞여 들어와 있었다.',
    noCurriculum: true,
    rows: [],
    // 시간은 교육시간에 이미 있고, 재료비는 옆 칸인 램프 장식의 것이다.
    basicInfo: [
      { label: '시간', value: '' },
      { label: '신청방법', value: '온라인 수강신청 12/5(화), 오전 10시부터~ 금정구청 공공예약포털 인터넷 선착접수' },
    ],
    operation: [{ label: '재료비', value: '' }],
    content: [{
      label: '내용',
      value: '그림책 <슈퍼거북>을 샌드아트 공연으로 각색. 있는 그대로의 나를 사랑하기',
    }],
  },
  3423: {
    source: '금정구 작은도서관 크리스마스 행사 II 포스터의 오른쪽 칸(굴뚝에 낀 산타 클로스 램프 장식 만들기).'
      + ' 왼쪽 칸(샌드아트)의 시간이 섞여 들어와 있었다.',
    noCurriculum: true,
    rows: [],
    // 딸려 온 `오전11-12시`는 샌드아트의 시간이다. 이 수업은 오후 2~3시 30분이며 교육시간에 이미 있다.
    basicInfo: [
      { label: '시간', value: '' },
      { label: '신청방법', value: '온라인 수강신청 12/5(화), 오전 10시부터~ 금정구청 공공예약포털 인터넷 선착접수' },
    ],
    content: [{ label: '내용', value: '굴뚝에 낀 산타클로스 램프 만들기' }],
  },

  3939: {
    source: '2025년 들락날락 영어랑 놀자 2기 모집 포스터. 회차별 내용을 싣지 않은 모집 안내문이라'
      + ' 채울 회차가 없다. 본문에 적힌 「16주, 32회차」는 기간 안내일 뿐 회차표가 아니다.',
    noCurriculum: true,
    rows: [],
  },
};
