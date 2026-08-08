'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { studioDraftStorageKey, type StudioAgendaInput, type StudioGenerateRequest } from '@/lib/studio-draft';
import type { StudioConditionKey } from './studio-options';

type GenerateButtonProps = {
  canGenerate: boolean;
  prompt: string;
  conditions: Record<StudioConditionKey, string[]>;
  selectedAgenda: StudioAgendaInput | null;
};

export default function GenerateButton({
  canGenerate,
  prompt,
  conditions,
  selectedAgenda,
}: GenerateButtonProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleGenerate() {
    if (!canGenerate || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setErrorMessage('');

    try {
      const requestBody: StudioGenerateRequest = {
        prompt,
        conditions: conditions as Record<string, string[]>,
        agenda: selectedAgenda,
      };

      const response = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '기획서 초안 생성에 실패했습니다.');
      }

      window.sessionStorage.setItem(studioDraftStorageKey, JSON.stringify(data.draft));
      router.push('/studio/document/demo-document-1');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '기획서 초안 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="studioGeneratePanel" aria-live="polite">
      <p>
        {errorMessage || (canGenerate
          ? '기획 메모를 바탕으로 초안 작성 흐름을 시작합니다.'
          : '만들고 싶은 프로그램을 한 줄로 적어주세요.')}
      </p>
      <button
        className="uiButton uiButtonPrimary studioGenerateButton"
        disabled={!canGenerate || isGenerating}
        type="button"
        onClick={handleGenerate}
      >
        {isGenerating ? '생성 중...' : '기획안 만들기'} <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
