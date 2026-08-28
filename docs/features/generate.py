# -*- coding: utf-8 -*-
"""README 3.3 기능명세서 -> PR/이슈 구현 흐름 문서 생성기.

같은 디렉토리의 README.md를 다시 만듭니다. 제목/상태/머지일은 GitHub API에서 그대로
가져오고, 어떤 PR이 어느 기능의 몇 단계에 속하는지만 아래 GROUPS/BASE에서 사람이 정합니다.

    python docs/features/generate.py

PR이 추가되면 임시 디렉토리의 캐시(potg-issues-cache.json)를 지우고 다시 실행하면 갱신됩니다.
"""
import json, io, os, re, tempfile, urllib.request

REPO = "https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg"
API = "https://api.github.com/repos/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues"
# 응답 캐시는 저장소 밖(임시 디렉토리)에 둔다.
CACHE = os.path.join(tempfile.gettempdir(), 'potg-issues-cache.json')


def fetch():
    """공개 저장소이므로 인증 없이 이슈+PR 전체를 받아 캐시에 저장한다."""
    items, page = [], 1
    while True:
        url = "%s?state=all&per_page=100&page=%d" % (API, page)
        with urllib.request.urlopen(url) as r:
            batch = json.load(r)
        if not batch:
            break
        items += batch
        page += 1
    json.dump(items, io.open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
    return items


data = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else fetch()
PR = {x['number']: x for x in data if 'pull_request' in x}
IS = {x['number']: x for x in data if 'pull_request' not in x}

# PR 본문에 이슈 참조가 없어 제목/작업 내용으로 직접 연결한 경우
MANUAL = {7: [6], 12: [6, 9], 165: [162], 183: [134],
          186: [184], 187: [185], 197: [196], 205: [204]}

EXCLUDE_PR = {1, 16, 18, 20}   # classroom bot / 연습 / 이슈-PR 사용법 테스트
EXCLUDE_IS = {3, 17, 19}       # 이슈 사용법 테스트

# PR 없이 이슈로만 남은 항목 (상위 기획 이슈, 설계 이슈 등)
EXTRA = {
    "F01": [4, 5, 33], "F06": [39], "F08": [63],
    "F09": [147], "F11": [109], "B02": [8, 47, 54, 55],
}

# (ID, 기능, 구분, 주요 내용, 권한, 흐름 요약, [(단계, [PR...]), ...])
GROUPS = [
    ("F01", "계정 관리", "회원", "회원가입, 로그인, 관심분야 설정", "공통",
     "로그인 API를 먼저 세우고, 회원가입에 관심분야를 붙이다 한 번 되돌린 뒤 DB 모델을 다시 잡았습니다. "
     "이후 세션과 역할 권한을 넣고, 마지막에 화면과 입력 검증을 손봤습니다.",
     [("로그인 기반 세우기", [11, 14, 24, 26]),
      ("회원가입과 관심분야 (되돌리고 다시 설계)", [40, 41, 43, 44, 45, 50]),
      ("세션 유지와 역할 권한", [42, 51]),
      ("화면 정리와 입력 검증 수정", [130, 168, 179, 205])]),

    ("F02", "서비스 진입", "홈", "서비스 흐름 안내와 주요 화면 연결", "공통",
     "첫 화면 골격에서 출발해 메뉴와 소개 페이지를 붙이고, 마지막에 더미 콘텐츠를 실제 게시판 데이터로 "
     "교체하면서 기기별 화면까지 맞췄습니다.",
     [("첫 화면 골격", [7, 12]),
      ("메뉴와 소개 페이지 붙이기", [59, 111, 142]),
      ("소개 흐름 다듬기", [161, 164, 183, 220]),
      ("실데이터 연결과 화면 대응", [214, 217, 218])]),

    ("F03", "도서관 찾기", "도서관", "도서관 검색, 위치·유형, 최근 프로그램 확인", "공통",
     "이미 쌓아둔 프로그램 데이터에 도서관 위치를 얹는 형태여서, 지도 검색 화면 하나로 마무리됐습니다.",
     [("지도 검색 화면", [211])]),

    ("F04", "프로그램 탐색", "프로그램", "목록, 검색, 필터, 상세 정보, 원본 신청 링크", "공통",
     "크롤링 원본을 바로 쓰지 않고 17건 -> 대표 20건 검수 -> 351건 순으로 정제 규칙을 넓혀가며 검증한 뒤 "
     "게시판에 올렸고, 마지막에 JSON 파일에서 DB/API로 옮겼습니다. 원천 데이터는 B01에서 만듭니다.",
     [("정제 규칙 세우고 좁게 검증", [143, 145]),
      ("전체 351건으로 넓히기", [166, 182]),
      ("파일에서 DB/API 구조로 이전", [188])]),

    ("F05", "일정·관심 관리", "프로그램", "캘린더 확인, 관심 프로그램 저장·해제", "로그인",
     "게시판이 실제 데이터로 완성된 뒤, 같은 데이터를 날짜 축으로 다시 보여주고 계정에 묶는 순서로 붙였습니다.",
     [("날짜 축으로 다시 보기", [208]),
      ("계정에 묶기", [209])]),

    ("F06", "주민 아이디어", "커뮤니티", "아이디어 작성, 댓글, 공감, STUDIO 연계", "공통",
     "게시판 3종을 만들어보고 DB를 붙인 뒤, 실제로 쓰이는 아이디어 게시판 하나로 범위를 좁혔습니다. "
     "자유게시판·동네 광장·지역 제안은 이 과정에서 걷어냈고, 마지막에 MOIRA STUDIO와 이었습니다.",
     [("게시판 골격 만들기", [27, 30, 48]),
      ("DB 연동과 글·댓글 기능", [62, 82, 118, 135]),
      ("범위 좁히기 (게시판 3종 -> 아이디어 게시판)", [96, 125, 181, 200]),
      ("MOIRA STUDIO와 연결", [176]),
      ("리디자인과 마무리", [197, 198, 201, 203, 213])]),

    ("F07", "도서관 소식", "커뮤니티", "공지·행사 글 조회, 검색, 좋아요·저장", "공통",
     "F06에서 만든 게시판 구조를 그대로 쓰기 때문에, 소식 게시판 전용 화면 작업 한 건으로 끝났습니다.",
     [("소식 게시판 화면", [190])]),

    ("F08", "기획안 생성", "MOIRA STUDIO", "직접 입력 또는 주민 아이디어 기반 AI 초안 생성, 기존 프로그램 사례 참고", "사서",
     "빈 화면에서 LLM 초안 생성을 붙이고, 여기에 B01의 사례 검색을 결합해 기존 프로그램을 근거로 삼는 "
     "초안으로 바꿨습니다. 주민 아이디어를 입력으로 받는 두 번째 모드를 더한 뒤, 마지막으로 사례 검색을 "
     "로컬 JSON 파일럿에서 pgvector 본 경로로 옮겨 파일럿과 같은 결과가 나오는지 확인했습니다.",
     [("진입 화면", [65]),
      ("LLM 초안 생성 연결", [128, 137, 149, 156]),
      ("기존 사례 검색 결합 (파일 기반 파일럿)", [165, 170]),
      ("주민 아이디어 모드 추가", [174, 176]),
      ("화면 정리", [194]),
      ("사례 검색을 본 경로로 이전 (파일 -> pgvector)", [222])]),

    ("F09", "기획안 편집", "MOIRA STUDIO", "항목별 수정, AI 다듬기, 기획서 저장", "사서",
     "편집 화면을 먼저 세우고, 선택 영역 AI 수정을 패널 -> 결과 비교 -> 반영 순으로 완성했습니다. "
     "그 뒤 저장과 사용자별 관리를 붙이고, 실제 강의계획서 서식에 맞춰 PDF 출력까지 확정했습니다.",
     [("문서 편집 화면", [103, 104]),
      ("선택 영역 AI 수정 (패널 -> 비교 -> 반영)", [105, 126, 157, 159]),
      ("저장과 사용자별 관리", [127, 151, 158]),
      ("기획서 서식과 PDF 확정", [172, 186, 202])]),

    ("F10", "참여와 집계", "수요조사", "참여 의향·선호 시간대 응답, 결과 확인", "공통/사서",
     "F09에서 만든 기획서를 입력으로 받아, 주민이 응답하는 공개 페이지와 사서가 결과를 보는 화면을 "
     "짝으로 붙였습니다.",
     [("주민이 응답하는 공개 페이지", [192, 199]),
      ("사서가 결과를 보는 화면", [187])]),

    ("F11", "내 활동 관리", "마이페이지", "프로필, 게시글, 댓글, 관심글, 관심 프로그램 관리", "로그인",
     "스켈레톤과 프로필 API를 먼저 두고, 다른 기능이 완성될 때마다 그 활동 내역을 마이페이지로 끌어오는 "
     "방식으로 채웠습니다.",
     [("골격과 프로필 API", [52, 110]),
      ("각 기능의 활동 내역 끌어오기", [132, 209, 216])]),
]

BASE = [
    ("B01", "프로그램 사례 데이터·AI 검색 파이프라인",
     "**F04 프로그램 탐색**과 **F08 기획안 생성**이 함께 올라서는 토대입니다. "
     "금정구 프로그램을 크롤링해 저장하고, 첨부파일에서 텍스트를 뽑아 검색용 문서로 만든 뒤 "
     "임베딩과 검색 품질까지 검증하는 한 줄기 작업입니다.",
     [("크롤링", [66, 72, 139]),
      ("저장 구조 만들기", [73, 75]),
      ("첨부파일에서 텍스트 뽑기 (PDF -> OCR -> HWP)", [79, 83, 85, 87]),
      ("검색 문서화와 임베딩", [90, 91, 93, 106]),
      ("검색 계약과 품질 검증", [112, 116, 119, 121, 123])]),

    ("B02", "프로젝트 기반·배포·디자인 시스템",
     "저장소 구조, 배포 환경, 공통 디자인 시스템 등 특정 기능에 속하지 않는 공통 작업입니다.",
     [("", [2, 22, 58, 60, 69, 70, 219])]),
]


def issues_of(n):
    if n in MANUAL:
        return MANUAL[n]
    body = PR[n].get('body') or ''
    return sorted({int(x) for x in re.findall(r'#(\d{1,3})\b', body) if int(x) in IS})


def pr_date(n):
    p = PR[n]
    return (p['pull_request'].get('merged_at') or p.get('closed_at') or p['created_at'])[:10]


def pr_state(n):
    p = PR[n]
    if p['pull_request'].get('merged_at'):
        return "머지"
    return "열림" if p['state'] == 'open' else "닫힘"


def esc(t):
    return t.strip().replace('|', '&#124;')


def flat(stages):
    return [n for _, nums in stages for n in nums]


def pr_rows(nums):
    out = []
    for n in sorted(nums, key=lambda x: (pr_date(x), x)):
        cell = ", ".join("[#%d](%s/issues/%d)" % (i, REPO, i) for i in issues_of(n)) or "—"
        out.append("| %s | [#%d](%s/pull/%d) | %s | %s | %s |"
                   % (pr_date(n), n, REPO, n, esc(PR[n]['title']), cell, pr_state(n)))
    return "\n".join(out)


def issue_rows(nums):
    out = []
    for n in sorted(nums):
        st = "열림" if IS[n]['state'] == 'open' else "닫힘"
        out.append("| [#%d](%s/issues/%d) | %s | %s |" % (n, REPO, n, esc(IS[n]['title']), st))
    return "\n".join(out)


def anchor(gid, name):
    return ("#%s-%s" % (gid, name.replace(' ', '-').replace('·', ''))).lower()


def period(nums):
    ds = sorted(pr_date(n) for n in nums)
    return ds[0] if ds[0] == ds[-1] else "%s ~ %s" % (ds[0], ds[-1])


HEAD = "| 머지일 | PR | 제목 | 관련 이슈 | 상태 |\n| --- | --- | --- | --- | --- |\n"

assigned = set()
for g in GROUPS:
    assigned |= set(flat(g[6]))
for b in BASE:
    assigned |= set(flat(b[3]))
missing = sorted(set(PR) - assigned - EXCLUDE_PR)

f = io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'README.md'),
            'w', encoding='utf-8')
w = f.write

w("# 기능별 구현 흐름\n\n")
w("README [3.3. 기능명세서](../../README.md#33-기능명세서)의 각 기능이 "
  "**어떤 이슈에서 출발해, 어떤 순서의 PR을 거쳐 지금 모습이 됐는지**를 기록한 문서입니다.\n\n")
w("기능명세서는 완성된 결과만 한 줄로 보여줍니다. 그 한 줄에 닿기까지 먼저 무엇을 세웠고, "
  "무엇을 되돌렸고, 무엇을 걷어냈는지는 거기 드러나지 않습니다. 이 문서는 그 과정을 단계로 나눠 담았습니다.\n\n")
w("- 각 기능은 **시간순 단계**로 묶여 있고, 단계 안의 PR도 머지일 순서입니다.\n")
w("- 대상: 이슈 %d건, PR %d건 (사용법 연습·테스트용 이슈 %d건, PR %d건 제외)\n"
  % (len(IS) - len(EXCLUDE_IS), len(PR) - len(EXCLUDE_PR), len(EXCLUDE_IS), len(EXCLUDE_PR)))
w("- 이슈는 PR 본문의 참조를 기준으로 연결했고, 참조가 없는 PR은 제목과 작업 내용을 보고 직접 이었습니다.\n")
w("- 하나의 PR이 두 기능에 걸치면 양쪽에 모두 표시했습니다.\n\n")

w("## 한눈에 보기\n\n")
w("| ID | 구분 | 기능 | 권한 | 단계 | PR | 이슈 | 기간 |\n"
  "| --- | --- | --- | --- | --- | --- | --- | --- |\n")
for gid, name, cat, desc, perm, summary, stages in GROUPS:
    nums = flat(stages)
    ni = len({i for n in nums for i in issues_of(n)} | set(EXTRA.get(gid, [])))
    w("| [%s](%s) | %s | %s | %s | %d | %d건 | %d건 | %s |\n"
      % (gid, anchor(gid, name), cat, name, perm, len(stages), len(nums), ni, period(nums)))
for bid, name, desc, stages in BASE:
    nums = flat(stages)
    ni = len({i for n in nums for i in issues_of(n)} | set(EXTRA.get(bid, [])))
    ns = len([s for s in stages if s[0]])
    w("| [%s](%s) | 공통 기반 | %s | — | %s | %d건 | %d건 | %s |\n"
      % (bid, anchor(bid, name), name, ns or "—", len(nums), ni, period(nums)))
w("\n<br>\n\n---\n\n")

w("## 기능명세서 항목별 구현 흐름\n\n")
for gid, name, cat, desc, perm, summary, stages in GROUPS:
    nums = flat(stages)
    w("### %s. %s\n\n" % (gid, name))
    w("> **구분** %s · **주요 내용** %s · **권한** %s\n> \n> **기간** %s · **PR** %d건\n\n"
      % (cat, desc, perm, period(nums), len(nums)))
    w("%s\n\n" % summary)
    for i, (stage, snums) in enumerate(stages, 1):
        w("**%d단계 · %s**\n\n" % (i, stage))
        w(HEAD + pr_rows(snums) + "\n\n")
    if EXTRA.get(gid):
        w("PR 없이 이슈로만 남은 항목\n\n")
        w("| 이슈 | 제목 | 상태 |\n| --- | --- | --- |\n" + issue_rows(EXTRA[gid]) + "\n\n")
    w("<br>\n\n")

w("---\n\n## 공통 기반 작업\n\n")
w("기능명세서의 특정 행에 직접 대응하지는 않지만, 여러 기능이 함께 올라서는 토대가 된 작업입니다.\n\n")
for bid, name, desc, stages in BASE:
    nums = flat(stages)
    w("### %s. %s\n\n" % (bid, name))
    w("> **기간** %s · **PR** %d건\n\n" % (period(nums), len(nums)))
    w("%s\n\n" % desc)
    for i, (stage, snums) in enumerate(stages, 1):
        if stage:
            w("**%d단계 · %s**\n\n" % (i, stage))
        w(HEAD + pr_rows(snums) + "\n\n")
    if EXTRA.get(bid):
        w("PR 없이 이슈로만 남은 항목\n\n")
        w("| 이슈 | 제목 | 상태 |\n| --- | --- | --- |\n" + issue_rows(EXTRA[bid]) + "\n\n")
    w("<br>\n\n")

if missing:
    w("---\n\n## 미분류\n\n" + HEAD + pr_rows(missing) + "\n\n")

f.close()
print("PR assigned:", len(assigned), "| missing:", missing)
