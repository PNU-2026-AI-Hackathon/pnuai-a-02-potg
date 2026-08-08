from __future__ import annotations

import json
import statistics
import time

from program_case_semantic_search.cli import metadata
from program_case_semantic_search.config import Settings
from program_case_semantic_search.database import connect
from program_case_semantic_search.kure_embedding_provider import KureEmbeddingProvider
from program_case_semantic_search.metadata_inference import (
    AgeGroup, OperationType, ParticipationType, ProgramCaseSearchRequest,
    ProgramCategory, infer_program_metadata,
)
from program_case_semantic_search.ranking_policy import ScoringPolicy, rank_programs
from program_case_semantic_search.search_repository import SearchRepository


REQUESTS = (
    ProgramCaseSearchRequest('유아와 부모가 함께하는 그림책 활동', age_groups=frozenset({AgeGroup.INFANT}), categories=frozenset({ProgramCategory.READING}), participation_types=frozenset({ParticipationType.PARENT_CHILD})),
    ProgramCaseSearchRequest('초등학생 독서 프로그램', age_groups=frozenset({AgeGroup.CHILD}), categories=frozenset({ProgramCategory.READING, ProgramCategory.WRITING})),
    ProgramCaseSearchRequest('노년층 디지털 교육', age_groups=frozenset({AgeGroup.SENIOR}), categories=frozenset({ProgramCategory.DIGITAL})),
    ProgramCaseSearchRequest('부모와 아이 문화 활동', age_groups=frozenset({AgeGroup.CHILD}), categories=frozenset({ProgramCategory.CULTURE}), participation_types=frozenset({ParticipationType.PARENT_CHILD})),
    ProgramCaseSearchRequest('주민 공예 프로그램', age_groups=frozenset({AgeGroup.GENERAL}), categories=frozenset({ProgramCategory.CRAFT, ProgramCategory.COMMUNITY})),
    ProgramCaseSearchRequest('건강 프로그램', age_groups=frozenset({AgeGroup.ADULT}), categories=frozenset({ProgramCategory.HEALTH})),
    ProgramCaseSearchRequest('성인을 위한 스마트폰 활용 교육', age_groups=frozenset({AgeGroup.ADULT}), categories=frozenset({ProgramCategory.DIGITAL})),
    ProgramCaseSearchRequest('초등학생 글쓰기 활동', age_groups=frozenset({AgeGroup.CHILD}), categories=frozenset({ProgramCategory.WRITING})),
    ProgramCaseSearchRequest('유아 미술 체험', age_groups=frozenset({AgeGroup.INFANT}), categories=frozenset({ProgramCategory.ART}), operation_types=frozenset({OperationType.EXPERIENCE})),
    ProgramCaseSearchRequest('가족이 함께하는 주말 프로그램', age_groups=frozenset({AgeGroup.FAMILY}), participation_types=frozenset({ParticipationType.FAMILY})),
    ProgramCaseSearchRequest('중장년 건강 강좌', age_groups=frozenset({AgeGroup.ADULT}), categories=frozenset({ProgramCategory.HEALTH}), operation_types=frozenset({OperationType.LECTURE})),
    ProgramCaseSearchRequest('어린이 영어 프로그램', age_groups=frozenset({AgeGroup.CHILD}), categories=frozenset({ProgramCategory.LANGUAGE})),
    ProgramCaseSearchRequest('환경을 주제로 한 체험 활동', categories=frozenset({ProgramCategory.ENVIRONMENT}), operation_types=frozenset({OperationType.EXPERIENCE})),
    ProgramCaseSearchRequest('주민 독서 모임', age_groups=frozenset({AgeGroup.GENERAL}), categories=frozenset({ProgramCategory.READING, ProgramCategory.COMMUNITY}), participation_types=frozenset({ParticipationType.GROUP})),
    ProgramCaseSearchRequest('어르신 취미 프로그램', age_groups=frozenset({AgeGroup.SENIOR})),
)


def _repair(value: str) -> str:
    try:
        return value.encode('latin1').decode('cp949')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value


def _metadata_audit(connection) -> dict[str, object]:
    rows = connection.execute('SELECT "title", "targetAudience" FROM "ProgramCase"').fetchall()
    values = [infer_program_metadata(title, target) for title, target in rows]
    dimensions = {
        'ageGroups': ('age_groups', AgeGroup.UNKNOWN),
        'categories': ('categories', ProgramCategory.UNKNOWN),
        'participationTypes': ('participation_types', ParticipationType.UNKNOWN),
        'operationTypes': ('operation_types', OperationType.UNKNOWN),
    }
    output = {'programCases': len(values)}
    for label, (attribute, unknown) in dimensions.items():
        groups = [getattr(value, attribute) for value in values]
        output[label] = {
            'unknown': sum(group == frozenset({unknown}) for group in groups),
            'multiLabel': sum(len(group - {unknown}) > 1 for group in groups),
            'matched': sum(group != frozenset({unknown}) for group in groups),
        }
    output['ageConflict'] = sum(
        AgeGroup.ADULT in value.age_groups
        and bool({AgeGroup.INFANT, AgeGroup.CHILD} & value.age_groups)
        for value in values
    )
    return output


def main() -> None:
    settings = Settings.from_environment()
    provider = KureEmbeddingProvider(cache_folder=str(settings.model_cache_dir))
    policy_times = {policy.value: [] for policy in ScoringPolicy}
    embedding_times = []
    database_times = []
    evaluations = []
    with connect(settings.database_url, read_only=True) as connection:
        audit = _metadata_audit(connection)
        repository = SearchRepository(connection)
        for request in REQUESTS:
            started = time.perf_counter()
            vector = provider.encode_query(request.query)
            embedding_times.append(time.perf_counter() - started)
            started = time.perf_counter()
            candidates = repository.search(vector, metadata(), limit=100)
            database_times.append(time.perf_counter() - started)
            policy_results = {}
            for policy in ScoringPolicy:
                started = time.perf_counter()
                ranked = rank_programs(candidates, request, policy, limit=5)
                policy_times[policy.value].append(time.perf_counter() - started)
                policy_results[policy.value] = {
                    'returned': len(ranked),
                    'uniquePrograms': len({item.representative.program_case_id for item in ranked}),
                    'attachmentRepresentatives': sum(item.representative.chunk_type == 'ATTACHMENT' for item in ranked),
                    'results': [{
                        'rank': item.representative.rank,
                        'programTitle': _repair(item.representative.program_title),
                        'programCaseId': item.representative.program_case_id,
                        'rawSimilarity': item.raw_similarity,
                        'finalScore': item.final_score,
                        'chunkType': item.representative.chunk_type,
                    } for item in ranked],
                }
            evaluations.append({'query': request.query, 'policies': policy_results})
    totals = {}
    for policy in ScoringPolicy:
        key = policy.value
        result_sets = [item['policies'][key] for item in evaluations]
        totals[key] = {
            'returned': sum(item['returned'] for item in result_sets),
            'attachmentRepresentatives': sum(
                item['attachmentRepresentatives'] for item in result_sets
            ),
            'duplicatePrograms': sum(
                item['returned'] - item['uniquePrograms'] for item in result_sets
            ),
        }
    print(json.dumps({
        'metadataAudit': audit,
        'queryCount': len(REQUESTS),
        'latencyMedianMs': {
            'queryEmbedding': statistics.median(embedding_times) * 1000,
            'databaseCandidates': statistics.median(database_times) * 1000,
            **{key: statistics.median(values) * 1000 for key, values in policy_times.items()},
        },
        'policyTotals': totals,
        'evaluations': evaluations,
        'labelsAvailable': False,
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
