# ProgramCase Search Evaluation 현황

검색 엔진, query set, 사람 label 저장, partial metrics 계산 기반은 구현되었다. 사람 relevance label은 아직 없으므로 최종 성능 결론은 보류한다. qrels와 metrics는 사람 label이 추가될 때 결정적으로 다시 계산해야 한다.

현재 metric은 `AWAITING_HUMAN_LABELS` 또는 `PROVISIONAL`로만 보고하며 빈 label을 성능처럼 공개하지 않는다. 생성 시각은 결정적 hash에서 제외한다.
