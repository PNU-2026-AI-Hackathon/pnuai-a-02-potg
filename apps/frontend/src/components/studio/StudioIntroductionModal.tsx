'use client';

type StudioIntroductionModalProps = {
  onClose: () => void;
};

export default function StudioIntroductionModal({
  onClose,
}: StudioIntroductionModalProps) {
  return (
    <div className="studioModalBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="studioModal"
        role="dialog"
        aria-labelledby="studio-intro-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="studioModalClose" type="button" aria-label="소개 닫기" onClick={onClose}>
          ×
        </button>
        <p className="uiEyebrow">ABOUT MOIRA STUDIO</p>
        <h2 id="studio-intro-title">주민의 목소리를 실행 가능한 도서관 프로그램으로</h2>
        <p>
          MOIRA STUDIO는 지역 의제, 수요조사, 참고 프로그램을 바탕으로 사서가 빠르게
          프로그램 기획 초안을 만들 수 있도록 돕는 작업 화면입니다.
        </p>
        <div className="studioModalGrid">
          <article>
            <strong>의제 기반</strong>
            <span>주민 제안과 지역 이슈를 기획 조건으로 연결합니다.</span>
          </article>
          <article>
            <strong>선택 중심</strong>
            <span>긴 프롬프트 작성 없이 필요한 조건만 고릅니다.</span>
          </article>
          <article>
            <strong>사서 검토</strong>
            <span>생성 결과는 초안이며, 최종 조정은 담당자가 수행합니다.</span>
          </article>
        </div>
      </section>
    </div>
  );
}
