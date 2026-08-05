# ProgramCase Grouping 분석

## 결과

- 입력 ProgramCase: 349
- ProgramGroup: 280
- 단독 그룹: 273
- 복수 member 그룹: 7
- Variant candidate: 27
- 자동 병합된 최대 그룹: `이야기로 만나는 동화나라` 53건

공유 binary 관계는 날짜 차이 7, 시간 차이 5, 차수 차이 1, 대상 차이 2, 통합 문서 5, 행사 개요/활동 슬롯 1건이다. 통합 문서와 행사 개요는 같은 파일이라는 이유로 합치지 않았다.

정규화는 날짜·시간·차수 접미어 제거에 한정된다. 제목 의미 유사도나 LLM 분류는 사용하지 않으므로 보수적이고 재현 가능하다. 대상 차이는 variant 후보로 남기되 현재 MVP corpus는 group 대표 문서 한 건을 생성한다.

## 한계

정확히 같은 base title로 여러 해 반복되는 프로그램은 하나의 검색 family가 된다. 기관이 제목에 없고 source type만 같은 동명 이종 프로그램은 추가 기관 신호가 필요할 수 있다. Variant는 artifact로 기록하지만 독립 corpus 분할은 후속 retrieval 평가에서 결정한다.
