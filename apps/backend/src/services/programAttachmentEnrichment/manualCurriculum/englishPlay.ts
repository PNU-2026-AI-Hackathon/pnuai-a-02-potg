/**
 * 들락날락 영어랑 놀자 강의계획서.
 *
 * 세 건 모두 `Period | Book | Introduction | Activity | Phonics` 다섯 칸짜리 표다.
 * 칸이 원본과 같은 순서로 보이도록 줄당 하나씩 적고 `rowsFromTuples`로 옮긴다.
 */

import type { ManualCurriculumEntry, PlanTuple } from './types';
import { rowsFromTuples } from './types';

/** 유아반(Group A) 28회차. 2024. 5. 11. ~ 8. 11. 매주 토·일 14:10~14:50. */
const GROUP_A: PlanTuple[] = [
  // 회차, 일자, Book, Introduction, Activity, Phonics
  [1, '', '[Book1] I Am Tom', '- Story Telling',
    '- Student Book:\n신체 부위 명칭 익히기', 'Aa: ant, apple\nBb: banana, bus'],
  [2, '', '[Book1] I Am Tom', '- Story Telling',
    '- Chant: Eyes and Nose\n- Craft: My Name Tag\n이름표 만들기', 'Cc: cat, cow\nDd: doll, dog'],
  [3, '', '[Book1] I Am Tom', '- 발표: 내 이름 소개하기\n- Story Telling',
    '- Student Book:\n동물들의 신체 크기를 비교하기', 'Ee: egg, elephant\nFf: fan, fox'],
  [4, '', '[Book1] I Am Tom', '- Story Telling',
    '- Song: I Have Eyes\n- Craft: Face Maker\n클레이 모스 화분 만들기', 'Gg: goat, gorilla\nHh: hat, hand'],
  [5, '', '[Book1] I Am Tom', '- 발표: 화분 표정 설명하기\n- Story Telling',
    '- Student Book: 동물 맞추기', 'Ii: igloo, ink\nJj: jam, jelly'],

  [6, '', '[Book2] Hide and Seek', '- Story Telling',
    '- Chant: Are You Alligator?\n- Craft: Pet Balloon\n모자이크 스티커로 꾸민 동물 풍선',
    'Kk: key, kite\nLl: lion, lemon'],
  [7, '', '[Book2] Hide and Seek', '- 발표: 펫 벌룬 이름짓고 소개하기\n- Story Telling',
    '- Student Book: 숨어 있는 동물을 찾기, 스티커 가위바위보 놀이하기',
    'Mm: mask, moon\nNn: nose, nail'],
  [8, '', '[Book2] Hide and Seek', '- Story Telling',
    '- Song: Rock, Scissors, Paper\n- Craft: Hide-and-Seek Basket\n바구니를 만들고 계란을 꾸며 나의 계란 찾기 놀이하기',
    'Oo: orange, oreo\nPp: pear, penguin'],
  // 특별 프로그램은 칸을 나누지 않고 회차 아래에 한 줄로 걸쳐 있다.
  [9, '', '[Book2] Hide and Seek', '- 발표: 바구니에 담고 싶은 물건 말하기',
    '- Book2에서 배운 표현 총정리\n<Special program 1> 아트전시&발표',
    'Aa ~ Pp Review\nAlphabet Dance'],

  [10, '', '[Book3] My Birthday', '- Story Telling',
    '- Student Book: 가족 구성원 배우기', 'Qq: queen, quilt\nRr: ring, robot'],
  [11, '', '[Book3] My Birthday', '- Story Telling',
    '- Chant: Boo! Here I Am\n- Craft: Special cake box\n케이크를 선물하고 싶은 사람을 떠올리며 박스 꾸미기',
    'Ss: socks, saw\nTt: tomato, turtle'],
  [12, '', '[Book3] My Birthday', '- 발표: 누구를 위한 케이크인지 말하기\n- Story Telling',
    '- Student Book: 상대방이 누구인지 묻고 답하기, 내가 누군지 맞춰보기',
    'Uu: umbrella\nVv: vase, van'],
  [13, '', '[Book3] My Birthday', '- Story telling',
    '- Song: Where Is Daddy?\n- Craft: My cake you like\n케이크 만들기',
    'Ww: watch, whale\nXx: box, fox'],

  [14, '', "[Book4] We're Friends", '- 발표: 케이크의 모양 설명하기\n- Story Telling',
    '- Student book: 동물 퍼즐 완성하기', 'Yy: yo-yo, yellow\nZz: zero, zipper'],
  [15, '', "[Book4] We're Friends", '- Story Telling',
    "- Chant: It's a Cat\n- Craft: Jumping Frog\n고무줄을 이용해 개구리 만들기",
    'Aa ~ Zz Review\nAlphabet Dance'],
  [16, '', "[Book4] We're Friends", '- 발표: 나의 개구리 재주 설명하기\n- Story Telling',
    '- Student book: 동물 넣어서 문장 만들기', 'Aa: ant, apple\nBb: banana, bus\nCc: cat, cow'],
  [17, '', "[Book4] We're Friends", '- Story Telling',
    '- Song: What is it?\n- Craft: Make Snake Shake\n실을 이어 알록달록 뱀을 만들고 흔들기',
    'Dd: doll, dog\nEe: egg, elephant\nFf: fan, fox'],
  [18, '', "[Book4] We're Friends", '- 발표: 뱀으로 만들 수 있는 모양 말하기',
    "- Book4에서 배운 표현 총정리\n<Special program 2> I'm a Creator",
    'Aa ~ Ff Review\nAlphabet Dance'],

  [19, '', '[Book5] Be Clean, Sam', '- Story Telling',
    '- Student book: 음식 명칭 배우기', 'Gg: goat, gorilla\nHh: hat, hand\nIi: igloo, ink'],
  [20, '', '[Book5] Be Clean, Sam', '- Story Telling',
    '- Chant: Dirty vs Clean\n- Craft: Soft Soap Clean Mess\n조물조물 비누 만들기',
    'Jj: jam, jelly\nKk: key, kite\nLl: lion, lemon'],
  [21, '', '[Book5] Be Clean, Sam', '- 발표: 언제 손을 씻어야 하는지 말하기\n- Story Telling',
    '- Student book: 레스토랑에서 사용하는 표현 익히기',
    'Mm: mask, moon\nNn: nose, nail\nOo: orange, oreo'],
  [22, '', '[Book5] Be Clean, Sam', '- Story Telling',
    '- Song: What Do You Want?\n- Craft: Sam sandwich man\n샘 아저씨 얼굴 모양의 샌드위치 만들기',
    'Pp: pear, penguin\nQq: queen, quilt\nRr: ring, robot'],

  [23, '', '[Book6] Aquarium', '- 발표: 도시락 들고 소풍 가고 싶은 곳 말하기\n- Story Telling',
    '- Student book: 문장을 듣고 어떤 해양 동물인지 맞추기, 사진을 보고 문장에 바다생물 단어를 넣어 익히기',
    'Ss: socks, saw\nTt: tomato, turtle\nUu: umbrella'],
  [24, '', '[Book6] Aquarium', '- Story Telling',
    '- Craft: Feel Fish Aquarium\n페트병 안에 물고기 장난감을 넣어 나만의 수족관 만들기',
    'Vv: vase, van\nWw: watch, whale\nXx: box, fox'],
  [25, '', '[Book6] Aquarium', '- 발표: 키워 보고 싶은 바다생물 이야기하기\n- Story Telling',
    '- Student book: 문장을 듣고 어떤 해양 동물인지 맞추기, 같은 바다생물끼리 칸으로 나누기',
    'Yy: yo-yo, yellow\nZz: zero, zipper'],
  [26, '', '[Book6] Aquarium', '- Story Telling',
    '- Craft: Water Plant Marimo\n재활용 플라스틱 컵을 이용해 마리모 집을 만들어 키우는 활동',
    'Aa ~ Zz Review\nAlphabet Dance'],
  [27, '', '[Book6] Aquarium', '- 발표: 마리모 집 설명하기',
    '- Book6에서 배운 표현 총정리\n<Special program 3> Show & Tell',
    'Aa~ Zz Review\nAlphabet Dance'],

  [28, '', '', '', '<Special program 5> Farewell Party\n시상 및 수료', ''],
];

/** 초등반(Group B) 28회차. 2024. 5. 11. ~ 8. 11. 매주 토·일 15:10~15:50. */
const GROUP_B: PlanTuple[] = [
  [1, '', '[Book1] Name Me', '- Story Telling',
    '- Student Book: 그림 속에서 동물을 찾아 스티커 붙이기',
    'Aa: ant, apple\nBb: banana, bus\nCc: cat, cow\nDd: doll, dog'],
  [2, '', '[Book1] Name Me', '- Story Telling',
    "- Chant: What's Your Name?\n- Craft: My Name Tag\n이름표 만들기",
    'Aa: ant, apple\nBb: banana, bus\nCc: cat, cow\nDd: doll, dog'],
  [3, '', '[Book1] Name Me', '- 발표: 자기소개하기\n- Story Telling',
    '- Student Book: 스티커 활동을 하며 신체적 차이 인식하기',
    'Ee: egg, elephant\nFf: fan, fox\nGg: goat, gorilla\nHh: hat, hand'],
  [4, '', '[Book1] Name Me', '- Story Telling',
    '- Song: Oh, Who Are You?\n- Craft: Guess Who Am I?\n동물 마스크 만들기',
    'Ii: igloo, ink\nJj: jam, jelly\nKk: key, kite\nLl: lion, lemon'],

  [5, '', '[Book2] Magic Show', '- 발표: 동물의 특징을 설명하며 퀴즈 내기\n- Story Telling',
    '- Student Book: 다양한 감촉 표현 익히기, 감촉이 같은 사물 분류하기',
    'Mm: mask, moon\nNn: nose, nail\nOo: orange, oreo\nPp: pear, penguin'],
  [6, '', '[Book2] Magic Show', '- Story Telling',
    "- Chant: It's My Back\n- Craft: Touch and Feel\n개구리알 병 만들기",
    'Qq: queen, quilt\nRr: ring, robot\nSs: socks, saw\nTt: tomato, turtle'],
  [7, '', '[Book2] Magic Show', '- 발표: 내가 좋아하는 촉감의 동물이나 사물 설명하기\n- Story Telling',
    '- Student Book: 상상 동물의 그림으로 신체 부분 단어 익히기',
    'Uu: umbrella\nVv: vase, van\nWw: watch, whale\nXx: box, fox'],
  [8, '', '[Book2] Magic Show', '- Story Telling',
    '- Song: How Does It Feel?\n- Craft: My Magic\n지우개에 원하는 동물을 그리기',
    'Yy: yo-yo, yellow\nZz: zero, zipper'],
  [9, '', '[Book2] Magic Show', '- 발표: 반려동물 소개하기, 없다면 어떤 동물을 키우고 싶은지 말하기',
    '- Book2에서 배운 표현 총정리\n<Special program 1> Show & Tell',
    'Mm ~ Zz Review\nAlphabet Dance'],

  [10, '', '[Book3] My Mistake', '- Story Telling',
    '- Student Book: 가족 구성원 호칭 익히기',
    'Aa: ant, apple\nBb: banana, bus\nCc: cat, cow\nDd: doll, dog\nEe: egg, elephant'],
  [11, '', '[Book3] My Mistake', '- Story Telling',
    "- Chant: Don't Do That!\n- Craft: My Family\n가족 액자 만들기",
    'Ff: fan, fox\nGg: goat, gorilla\nHh: hat, hand\nIi: igloo, ink\nJj: jam, jelly'],
  [12, '', '[Book3] My Mistake', '- 발표: 우리 가족 소개하기\n- Story Telling',
    '- Student Book: 명령문 연습하기, 그림 순서 맞추며 이야기 만들기',
    'Kk: key, kite\nLl: lion, lemon\nMm: mask, moon\nNn: nose, nail\nOo: orange, oreo'],
  [13, '', '[Book3] My Mistake', '- Story telling',
    "- Song: Oh No! I'm Sorry\n- Craft: Dear Family\n카네이션카드 만들고 편지쓰기",
    'Pp: pear, penguin\nQq: queen, quilt\nRr: ring, robot'],

  [14, '', '[Book4] Where is the Pig', '- 발표: 가족에게 고마운 마음 표현하기\n- Story Telling',
    '- Student book: 동물들이 어디에 숨어 있는지 이야기해 보며 가구 명칭 익히기',
    'Uu: umbrella\nVv: vase, van\nWw: watch, whale\nXx: box, fox'],
  [15, '', '[Book4] Where is the Pig', '- Story Telling',
    '- Chant: Under the Table\n- Craft: Pet In My Fortune Cookie\n클레이 포춘쿠키 만들기',
    'Vowel Phonics\nAa: ambulance, ant, apple, axe'],
  [16, '', '[Book4] Where is the Pig', '- 발표: 나의 소원 말하기\n- Story Telling',
    '- Student book: 동물의 수 세기', 'Ii: igloo, iguana, ink, Italy\nOo: October,'],
  [17, '', '[Book4] Where is the Pig', '- Story Telling',
    '- Song: Where Is Pig?\n- Craft: Find My Pig\n돼지모형을 만들어 숨바꼭질 놀이하기',
    'Uu: umbrella, uncle, up, upset'],
  [18, '', '[Book4] Where is the Pig', '- 발표: 저금통을 가득 채우면 하고 싶은 것 말하기',
    '- Book4에서 배운 표현 총정리\n<Special program 2> Show & Tell', 'Vowel Review'],

  [19, '', '[Book5] Hungry BOB!', '- Story Telling',
    '- Student book: 음식을 보고 단어를 익히기', 'Consonant Phonics\nBb: banana, bus'],
  [20, '', '[Book5] Hungry BOB!', '- Story Telling',
    '- Chant: What Do You Have?\n- Craft: Sweet Necklace\n간식 목걸이 만들기',
    'Ff: fan, fox\nGg: goat, gorilla'],
  [21, '', '[Book5] Hungry BOB!', '- 발표: 내가 좋아하는 간식 말하기\n- Story Telling',
    '- Student book: 배운 과일을 사용해서 멜론에 동물 얼굴 만들어 붙이기',
    'Jj: jam, jelly\nKk: key, kite'],
  [22, '', '[Book5] Hungry BOB!', '- Story Telling',
    '- Song: Take a Guess!\n- Craft: Mr. Bread\n채소로 얼굴 만들기',
    'Mm: mask, moon\nNn: nose, nail'],

  [23, '', "[Book6] Let's Go Camping", '- 발표: 내가 만들고 싶은 음식 말하기\n- Story Telling',
    '- Student book: 캠핑에 필요한 도구에 관해 이야기 해 보기, 사진 붙이며 캠프장 구성하기',
    'Qq: queen, quilt\nRr: ring, robot'],
  [24, '', "[Book6] Let's Go Camping", '- Story Telling',
    '- Craft: My Camping Torch\n캠핑 랜턴 꾸미기', 'Tt: tomato, turtle\nUu: umbrella'],
  [25, '', "[Book6] Let's Go Camping", '- 발표: 랜턴이 필요한 순간을 설명하기\n- Story Telling',
    '- Student book: 두 그림을 비교하며 다른 부분 찾아보기', 'Ww: watch, whale\nXx: box, fox'],
  [26, '', "[Book6] Let's Go Camping", '- Story Telling',
    "- Craft: What's In My Camping Bag\n캠핑 여행 가방 만들기", 'Qq ~ Zz Review'],
  [27, '', "[Book6] Let's Go Camping", '- 발표: 여행에서 꼭 필요한 물건 설명하기',
    '- Book6에서 배운 표현 총정리\n<Special program 3> Show & Tell', 'Consonant + Vowel'],

  [28, '', '', '', '<Special program 5> Farewell Party\n시상 및 수료', ''],
];

/**
 * 초등반 2기 32회차. 2024. 9. 7. ~ 12. 22.
 *
 * 원본에 [23] 11월 23일 줄이 두 번, 서로 다른 내용으로 찍혀 있다.
 * 이 표는 Presentation 회차가 늘 직전 회차의 Craft를 가리킨다(3→4 물고기, 8→9 소방차,
 * 21→22 곰, 26→27 크리스마스 모자, 28→29 루돌프). 24회차가 악기를 묻고 있으므로
 * 23회차는 `My guitar` 줄이 맞다. 다른 줄(`My snowman`)은 원본의 군더더기로 본다.
 */
const ELEMENTARY_SECOND: PlanTuple[] = [
  [1, '9월 7일', 'Funny Shapes', '- Story Telling',
    '- Student Book: Learning shape names\n- Craft: My Name Tag', ''],
  [2, '9월 8일', 'Funny Shapes', '- Presentation: My name tag\n- Story Telling: review',
    '- Chant: Fun Shapes\n- Phonics game\n- ABC Worksheets',
    'Aa: ant, apple\nBb: banana, bus\nCc: cat, cow\nDd: doll, dog'],
  [3, '9월 14일', 'Funny Shapes', '- Phonics review\n- Story Telling',
    '- Student Book: Finding shapes in the objects around us\n- Craft: My round fish', ''],
  [4, '9월 15일', 'Funny Shapes',
    '- Presentation: describe the fish and the different shapes used to make it\n- Story Telling: review',
    '- Song: Shape song\n- Phonics game\n- ABC Worksheets',
    'Ee: egg, elephant\nFf: fan, fox\nGg: goat, gorilla\nHh: hat, hand'],
  [5, '9월 21일', 'Funny Shapes', '- Story telling: Overall review',
    'Review expression and words learned in book', 'Aa ~ Hh review'],

  [6, '9월 22일', 'Thomas the magic car', '- Story Telling',
    '- Student Book: learning the names of the different means of transportation\n- Craft: My fast car', ''],
  [7, '9월 28일', 'Thomas the magic car',
    '- Presentation: describe your dream car.\n- Story Telling: review',
    '- Chant: Cars Cars\n- Phonics game\n- ABC Worksheets',
    'Ii: igloo, ink\nJj: jam, jelly\nKk: key, kite\nLl: lion, lemon'],
  [8, '9월 29일', 'Thomas the magic car', '- Phonics review\n- Story Telling',
    '- Student Book: Learning when each type of car is needed\n- Craft: My fire truck', ''],
  [9, '10월 5일', 'Thomas the magic car',
    '- Presentation: what do you need when there is a fire, and why\n- Story Telling: review',
    '- Song: Help Help\n- Phonics game\n- ABC Worksheets',
    'Mm: mask, moon\nNn: nose, nail\nOo: orange, oreo\nPp: pear, penguin'],
  [10, '10월 6일', 'Thomas the magic car', '- Story Telling: Overall review',
    'Review expressions and words learned in book', 'Aa ~ Pp Review\nAlphabet Dance'],

  [11, '10월 12일', 'I am a big boy', '- Story Telling',
    "- Student Book: learn the different verb expressing action related to one's night routine\n- Craft: My daily Routine", ''],
  [12, '10월 13일', 'I am a big boy', '- Presentation:\n- Story Telling: Review',
    '- Chant: I can\n- Phonics game\n- ABC Worksheets',
    'Qq: queen, quilt\nRr: ring, robot\nSs: socks, saw\nTt: tomato, turtle'],
  [13, '10월 19일', 'I am a big boy', '- Phonics review\n- Story Telling',
    '- Student Book: use the expression i need to express need.\n- Craft: My daily routine', ''],
  [14, '10월 20일', 'I am a big boy',
    '- Presentation: Describe your daily routine.\n- Story telling: review',
    '- Song: Big girl and big boy\n- Phonics game\n- ABC Worksheets',
    'Uu: umbrella\nVv: vase, van\nWw: watch, whale'],
  [15, '10월 26일', 'I am a big boy', 'Story telling: Overall review',
    'Review expression and words learned in book', 'Qq ~ Ww Review'],

  [16, '10월 27일', 'You Can Do It', '- Phonics review\n- Story Telling',
    "- Student book: learn the different winter sports.\n- Craft: Let's ski!", ''],
  [17, '11월 2일', 'You Can Do It', '- Presentation:\n- Story Telling: review',
    '- Phonics game\n- ABC Worksheets', 'Xx: box, fox\nYy: yo-yo, yellow\nZz: zero, zipper'],
  [18, '11월 3일', 'You Can Do It', '- Phonics review\n- Story Telling',
    '- Student book: learn the different job names\n- Craft: My medal', ''],
  [19, '11월 9일', 'You Can Do It', '- Presentation:\n- Story Telling: review',
    '- Phonics game\n- ABC Worksheets',
    'Aa: ant, apple\nBb: banana, bus\nCc: cat, cow\nDd: doll, dog\nEe: egg, elephant'],
  [20, '11월 10일', 'You Can Do It', '- Story telling: Overall review',
    '- Review expression and words learned in book', 'Aa ~ Zz Review\nAlphabet Dance'],

  [21, '11월 16일', 'Winter Sleep', '- Phonics review\n- Story Telling',
    '- Student book: Learn the animals the hibernate during winter\n- Craft: Sleepy Bear', ''],
  [22, '11월 17일', 'Winter Sleep',
    '- Presentation: Describe the bear. explain why you think he sleeps during winter.\n- Story Telling: review',
    "- Chant: i'm sleepy\n- Phonics game\n- ABC Worksheets",
    'Ff: fan, fox\nGg: goat, gorilla\nHh: hat, hand\nIi: igloo, ink\nJj: jam, jelly'],
  [23, '11월 23일', 'Winter Sleep', '- Phonics review\n- Story Telling',
    '- Student book: Use the expression "i can" to express ability to do something\n- Craft: My guitar', ''],
  [24, '11월 24일', 'Winter Sleep',
    '- Presentation: What is your favourite instrument and do you want to play another one.\n- Story Telling: review',
    '- Phonics game\n- ABC Worksheets',
    'Kk: key, kite\nLl: lion, lemon\nMm: mask, moon\nNn: nose, nail\nOo: orange, oreo'],
  [25, '11월 30일', 'Winter Sleep', 'Story telling: Overall review',
    '- Review expressions and words learned in book', 'Aa ~ Oo Review\nAlphabet Dance'],

  [26, '12월 1일', 'Hurry Up, Rudolph', '- Phonics review\n- Story Telling',
    '- Student book: learn different feelings and use the expression "are you", " yes i am "\n- Craft: My Christmas hat', ''],
  [27, '12월 7일', 'Hurry Up, Rudolph',
    '- Presentation: Describe your Christmas hat and tell us who you want to give it to as a Christmas present.\n- Story Telling: review',
    '- Chant: Happy Happy\n- Phonics game\n- ABC Worksheets',
    'Pp: pear, penguin\nQq: queen, quilt\nRr: ring, robot\nSs: socks, saw\nTt: tomato, turtle\nXx: box, fox'],
  [28, '12월 8일', 'Hurry Up, Rudolph', '- Phonics review\n- Story Telling',
    '- Student book: match the feeling with the face expression\n- Craft: Standing Rudolph', ''],
  [29, '12월 14일', 'Hurry Up, Rudolph',
    '- Presentation: Describe Rudolph and tell us what you want to get for Christmas as a gift\n- Story Telling: review',
    '- Song: Are you happy\n- Phonics game\n- ABC Worksheets',
    'Uu: umbrella\nVv: vase, van\nWw: watch, whale\nXx: box, fox\nYy: yo-yo, yellow\nZz: zero, zipper'],
  [30, '12월 15일', 'Hurry Up, Rudolph', 'Story telling: Overall review',
    '- Review expression and words learned in book', 'Aa~ Zz Review\nAlphabet Dance'],

  // 마지막 두 회차는 칸을 나누지 않고 한 줄로 적혀 있다.
  [31, '12월 21일', '', '', '<Special program 1>', ''],
  [32, '12월 22일', '', '', '<Special program 2>', ''],
];

/**
 * 유아반 2기 32회차. 2024. 9. 7. ~ 12. 22.
 *
 * 원본에 [23] 11월 23일 줄이 없다. 오른쪽 표가 [22]에서 끝나고 아래 표가 [24]로 시작하며
 * 그 사이는 빈 여백이다. 지어낼 수 없으므로 23회차는 비워 둔다.
 */
const KINDER_SECOND: PlanTuple[] = [
  [1, '9월 7일', 'Animal farm', '- Story Telling',
    '- Student Book: learning animal sounds and Differentiating between farm animals and wild animals\n- Craft: My Name Tag', ''],
  [2, '9월 8일', 'Animal farm', '- Presentation: My name tag\n- Story Telling: review',
    '- Chant: Animal sounds\n- Phonics game\n- ABC Worksheets',
    'Aa: ant, apple\nBb: banana, bus\nCc: cat, cow\nDd: doll, dog'],
  [3, '9월 14일', 'Animal farm', '- Phonics review\n- Story Telling',
    '- Student Book: Learning the number of limbs each animal has.\n- Craft: My farm animal puppet', ''],
  [4, '9월 15일', 'Animal farm', '- Presentation: My farm animal puppet\n- Story Telling: review',
    '- Song: Bow Wow Meow\n- Phonics game\n- ABC Worksheets',
    'Ee: egg, elephant\nFf: fan, fox\nGg: goat, gorilla\nHh: hat, hand'],
  [5, '9월 21일', 'Animal farm', '- Story telling: Overall review',
    'Review expression and words learned in book', 'Aa ~ Hh review'],

  [6, '9월 22일', 'Fruit Monster', '- Story Telling',
    '- Student Book: Learning the names of different fruits\n- Craft: My fruit basket', ''],
  [7, '9월 28일', 'Fruit Monster', "- Presentation: What's in my fruit basket\n- Story Telling: review",
    '- Chant: Yummy fruits\n- Phonics game\n- ABC Worksheets',
    'Ii: igloo, ink\nJj: jam, jelly\nKk: key, kite\nLl: lion, lemon'],
  [8, '9월 29일', 'Fruit Monster', '- Phonics review\n- Story Telling',
    '- Student Book: Learning the colors of fruit and expressing desire/preference.\n- Craft: Watermelon hat', ''],
  [9, '10월 5일', 'Fruit Monster', "- Presentation: what's my favourite fruit.\n- Story Telling: review",
    '- Song: What do you like\n- Phonics game\n- ABC Worksheets',
    'Mm: mask, moon\nNn: nose, nail\nOo: orange, oreo\nPp: pear, penguin'],
  [10, '10월 6일', 'Fruit Monster', '- Story Telling: Overall review',
    'Review expressions and words learned in book', 'Aa ~ Pp Review\nAlphabet Dance'],

  [11, '10월 12일', 'Shake, Shake, Shake.', '- Story Telling',
    '- Student Book: Learning the name of different body movements.\n- Craft: My marionette', ''],
  [12, '10월 13일', 'Shake, Shake, Shake.',
    '- Presentation: Describe your Marionette\n- Story Telling: Review',
    '- Chant: Super Dancer\n- Phonics game\n- ABC Worksheets',
    'Qq: queen, quilt\nRr: ring, robot\nSs: socks, saw\nTt: tomato, turtle'],
  [13, '10월 19일', 'Shake, Shake, Shake.', '- Phonics review\n- Story Telling',
    '- Student Book: Use the expression "can you?" "yes i can" to express ability to do something.\n- Craft: Dancing Rabbit', ''],
  [14, '10월 20일', 'Shake, Shake, Shake.',
    '- Presentation: Describe the dancing rabbit, and show the different move it can do.\n- Story telling',
    '- Song: Dance and freeze\n- Phonics game\n- ABC Worksheets',
    'Uu: umbrella\nVv: vase, van\nWw: watch, whale'],
  [15, '10월 26일', 'Shake, Shake, Shake.', 'Story telling: Overall review',
    'Review expression and words learned in book', 'Qq ~ Ww Review'],

  [16, '10월 27일', 'I am not scared now', '- Phonics review\n- Story Telling',
    '- Student book: Learn the different scary thing that we can find in our room.\n- Craft: Scary castle', ''],
  [17, '11월 2일', 'I am not scared now',
    "- Presentation: What's your favourite thing about Halloween and why.\n- Story Telling",
    '- Chant: Boo Yawn\n- Phonics game\n- ABC Worksheets',
    'Xx: box, fox\nYy: yo-yo, yellow\nZz: zero, zipper'],
  [18, '11월 3일', 'I am not scared now', '- Phonics review\n- Story Telling',
    "- Student book: Learn morning and night greeting expressions. answering the question with; yes i am/no i'm not.\n- Craft: My pumpkin bag", ''],
  [19, '11월 9일', 'I am not scared now', '- Presentation: My halloween costume\n- Story Telling',
    '- Song: I am not scared\n- Phonics game\n- ABC Worksheets',
    'Aa: ant, apple\nBb: banana, bus\nCc: cat, cow\nDd: doll, dog\nEe: egg, elephant'],
  [20, '11월 10일', 'I am not scared now', '- Story telling: Overall review',
    '- Review expression and words learned in book', 'Aa ~ Zz Review\nAlphabet Dance'],

  [21, '11월 16일', 'Gorilla drum', '- Phonics review\n- Story Telling',
    '- Student book: Finding the difference between the pictures and learn different instruments\n- Craft: Straw Flute', ''],
  [22, '11월 17일', 'Gorilla drum',
    '- Presentation: talk about your flute and your favourite song\n- Story Telling',
    '- Phonics game\n- ABC Worksheets',
    'Ff: fan, fox\nGg: goat, gorilla\nHh: hat, hand\nIi: igloo, ink\nJj: jam, jelly'],
  // 23회차는 원본에 실려 있지 않다.
  [24, '11월 24일', 'Gorilla drum', '- Presentation:\n- Story Telling: review',
    '- Song: Yawn Yawn Yawn\n- Phonics game\n- ABC Worksheets',
    'Kk: key, kite\nLl: lion, lemon\nMm: mask, moon\nNn: nose, nail\nOo: orange, oreo'],
  [25, '11월 30일', 'Gorilla drum', 'Story telling: Overall review',
    '- Review expressions and words learned in book', 'Aa ~ Oo Review\nAlphabet Dance'],

  [26, '12월 1일', 'Merry Christmas', '- Phonics Review\n- Story Telling',
    '- Student book: leaning the different christmas gifts and guessing what is inside the boxes.\n- Craft: My Christmas hat.', ''],
  [27, '12월 7일', 'Merry Christmas',
    '- Presentation: Describe your christmas hat and tell us who you want to give it to as a christmas present.\n- Story Telling: review\n- Story Telling',
    '- Chant: Look at my Sled\n- Phonics game\n- ABC Worksheets',
    'Pp: pear, penguin\nQq: queen, quilt\nRr: ring, robot\nSs: socks, saw\nTt: tomato, turtle\nXx: box, fox'],
  [28, '12월 8일', 'Merry Christmas', '- Phonics review\n- Story Telling',
    '- Student book: learn different winter spots equipment.\n- Craft: christmas Picture holder.', ''],
  [29, '12월 14일', 'Merry Christmas',
    '- Presentation: Describe the picture holder and present who you want to give it as a gift to.\n- Story Telling',
    '- Song Christmas Present\n- Phonics game\n- ABC Worksheets',
    'Uu: umbrella\nVv: vase, van\nWw: watch, whale\nXx: box, fox\nYy: yo-yo, yellow\nZz: zero, zipper'],
  [30, '12월 15일', 'Merry Christmas', 'Story telling: Overall review',
    '- Review expression and words learned in book', 'Aa~ Zz Review\nAlphabet Dance'],

  [31, '12월 21일', '', '', '<Special program 1>', ''],
  [32, '12월 22일', '', '', '<Special program 2>', ''],
];

const GOAL_GROUP_A = '· 일상생활에서 사용되는 쉽고 간단한 표현을 듣고 말할 수 있다.\n'
  + '· 구두로 익힌 쉽고 간단한 표현을 따라 읽고 쓸 수 있으며 쉽고 간단한 단어를 스스로 인식할 수 있다.';

const GOAL_ELEMENTARY = '· 일상생활에서 사용되는 간단한 표현을 듣고 말할 수 있다.\n'
  + '· 구두로 익힌 쉽고 간단한 문장을 따라 읽고 쓸 수 있으며 쉽고 간단한 문장을 스스로'
  + ' 인식할 수 있고, 쉽고 간단한 단어를 스스로 보고 쓸 수 있다.';

const PLAN_COLUMNS = ' (Period | Book | Introduction | Activity | Phonics)';

export const ENGLISH_PLAY_ENTRIES: Record<number, ManualCurriculumEntry> = {
  3595: {
    source: '들락날락 영어랑 놀자(Group A / 유아반) 강의계획서 이미지의 28회차 표' + PLAN_COLUMNS,
    content: [{ label: '강의목표', value: GOAL_GROUP_A }],
    rows: rowsFromTuples(GROUP_A),
  },
  3596: {
    source: '들락날락 영어랑 놀자(Group B / 초등반) 강의계획서 이미지의 28회차 표' + PLAN_COLUMNS,
    content: [{ label: '강의목표', value: GOAL_ELEMENTARY }],
    rows: rowsFromTuples(GROUP_B),
  },
  3702: {
    source: '들락날락 영어랑 놀자(Group A / 유아반) 2기 강의계획서 이미지의 회차표' + PLAN_COLUMNS
      + '. 원본에 [23] 11월 23일 줄이 없어 23회차는 비어 있다.'
      + ' 오른쪽 표가 [22]에서 끝나고 아래 표가 [24]로 시작하며 그 사이는 여백이다.',
    // 3703과 같은 계획서 양식이라 표가 통째로 장소 칸으로 딸려 들어가 있었다.
    basicInfo: [{ label: '장소', value: '금정아이꿈자람 작은도서관' }],
    content: [{ label: '강의목표', value: GOAL_GROUP_A }],
    rows: rowsFromTuples(KINDER_SECOND),
  },
  3703: {
    source: '들락날락 영어랑 놀자(Group B / 초등반) 2기 강의계획서 이미지의 32회차 표' + PLAN_COLUMNS
      + '. 원본에 [23] 11월 23일 줄이 두 번, 서로 다른 내용으로 찍혀 있다.'
      + ' 24회차 Presentation이 악기를 묻고 있어 `Craft: My guitar` 줄을 넣었고,'
      + ' 다른 줄(learning the different seasons / My snowman)은 넣지 않았다.',
    // 표가 통째로 장소 칸으로 딸려 들어가 있었다.
    basicInfo: [{ label: '장소', value: '금정아이꿈자람 작은도서관' }],
    content: [{ label: '강의목표', value: GOAL_ELEMENTARY }],
    rows: rowsFromTuples(ELEMENTARY_SECOND),
  },
};
