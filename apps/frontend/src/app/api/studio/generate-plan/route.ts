import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { requestGeminiJson, resolveModels } from '@/lib/gemini';
import { audienceFilter, buildSearchQuery, type StudioConditions } from '@/lib/studio-search-query';
import { buildStudioPlanPrompt, parseStudioPlan, type StudioPlanAgenda } from '@/lib/studio-plan-prompt';

/**
 * 기획서를 항목 구조로 만든다.
 *
 * 기존 `/api/studio/generate`는 항목이 일곱 개이고 회차가 문자열 목록이라
 * 항목 단위 수정과 표 형태 내보내기를 할 수 없다. 그 경로는 아직 쓰는 화면이 있어
 * 두고, 새 구조를 쓰는 화면은 이쪽을 부른다.
 */

export type StudioGeneratePlanRequest = {
  memo: string;
  conditions?: Record<string, string[]>;
  referencesMarkdown?: string;
  agenda?: StudioPlanAgenda | null;
  model?: string;
};

type ReferenceContextResponse = {
  markdown?: unknown;
  resultCount?: unknown;
  error?: unknown;
};

const REFERENCE_LIMIT = 5;
const REFERENCE_TIMEOUT_MS = 90_000;

export const maxDuration = 120;

class ReferenceContextError extends Error {}

function readConditions(value: unknown): StudioConditions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(source).flatMap(([key, values]) => {
      if (!Array.isArray(values)) return [];
      const cleaned = values
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
      return cleaned.length ? [[key, cleaned]] : [];
    }),
  ) as StudioConditions;
}

/**
 * 사서의 메모와 주민 아이디어를 하나의 검색 질의로 만든다.
 * 메모 없이 주민 아이디어만 고른 경우에도 그 내용과 가까운 프로그램을 찾아야 한다.
 */
function referenceSearchMemo(memo: string, agenda: StudioPlanAgenda | null) {
  return [
    memo,
    agenda?.title,
    agenda?.content,
    agenda?.tags.length ? agenda.tags.join(' ') : '',
  ].filter(Boolean).join('. ');
}

/**
 * 기존 KURE-v1 의미 검색이 만든 상위 사례 Markdown을 가져온다.
 * 브라우저가 EC2를 직접 부르지 않고 Vercel의 Route Handler가 서버 간 요청을 보내므로
 * 배포 주소와 CORS 정책을 화면에 노출하지 않는다.
 */
async function buildReferenceContext(
  memo: string,
  agenda: StudioPlanAgenda | null,
  conditions: StudioConditions,
) {
  const query = buildSearchQuery(referenceSearchMemo(memo, agenda), conditions).slice(0, 1000);
  if (!query) throw new ReferenceContextError('유사 사례 검색어를 구성하지 못했습니다.');

  const target = new URL(getBackendUrl('/api/program-board/context'));
  target.searchParams.set('q', query);
  target.searchParams.set('limit', String(REFERENCE_LIMIT));
  const audience = audienceFilter(conditions);
  if (audience) target.searchParams.set('audience', audience);

  let response: Response;
  try {
    response = await fetch(target, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REFERENCE_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ReferenceContextError(
      error instanceof Error && error.name === 'TimeoutError'
        ? '유사 프로그램 검색 시간이 초과되었습니다.'
        : '유사 프로그램 검색 서버에 연결할 수 없습니다.',
    );
  }
  const payload = await response.json().catch(() => ({})) as ReferenceContextResponse;
  if (!response.ok) {
    const detail = typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
    throw new ReferenceContextError(`유사 프로그램 참고자료 생성 실패: ${detail}`);
  }
  if (typeof payload.markdown !== 'string' || !payload.markdown.trim()) {
    throw new ReferenceContextError('유사 프로그램 참고자료가 비어 있습니다.');
  }
  return payload.markdown.slice(0, 30000);
}

/** 보내온 의제를 읽는다. 제목과 내용이 있어야 기획의 근거가 되므로 둘 다 없으면 없는 것으로 본다. */
function readAgenda(value: unknown): StudioPlanAgenda | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const content = typeof source.content === 'string' ? source.content.trim() : '';
  if (!title || !content) return null;
  return {
    title,
    content,
    tags: Array.isArray(source.tags) ? source.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    const body = (await request.json()) as Partial<StudioGeneratePlanRequest>;
    const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
    const agenda = readAgenda(body.agenda);
    /**
     * 메모와 의제 중 하나만 있으면 된다. 의제를 고르는 것 자체가 「이걸로 기획해 달라」는
     * 요청이라, 같은 말을 메모에 한 번 더 적게 할 이유가 없다.
     */
    if (!memo && !agenda) {
      return NextResponse.json({ error: '프로그램 아이디어를 적거나 주민 아이디어를 골라 주세요.' }, { status: 400 });
    }

    const conditions = readConditions(body.conditions);
    const suppliedReferences = typeof body.referencesMarkdown === 'string'
      ? body.referencesMarkdown.trim().slice(0, 30000)
      : '';
    const referencesMarkdown = suppliedReferences || await buildReferenceContext(
      memo,
      agenda,
      conditions,
    );

    const prompt = buildStudioPlanPrompt({
      memo,
      conditions,
      referencesMarkdown,
      agenda,
    });

    const result = await requestGeminiJson(apiKey, prompt, resolveModels(body.model));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { plan, missing } = parseStudioPlan(result.value);
    if (!plan.title) {
      return NextResponse.json({ error: '기획서 형식으로 읽지 못했습니다.' }, { status: 502 });
    }

    return NextResponse.json({
      documentId: `plan-${Date.now()}`,
      plan,
      // 비어 온 항목을 알려 준다. 화면에서 「이 항목은 다시 만들어 주세요」로 안내할 수 있다.
      missingFields: missing,
      model: result.model,
    });
  } catch (error) {
    /**
     * 원인을 함께 남긴다. `fetch failed`만으로는 Gemini가 거절한 것인지, 이 서버가
     * 바깥으로 나가지 못하는 것인지 구분할 수 없어 엉뚱한 곳을 고치게 된다.
     * 화면에는 내보내지 않는다. 내부 주소가 사용자에게 보일 이유가 없다.
     */
    console.error('Studio generate-plan route failed:', error, error instanceof Error ? error.cause : undefined);
    if (error instanceof ReferenceContextError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: '기획서 생성 중 문제가 발생했습니다.' }, { status: 503 });
  }
}
