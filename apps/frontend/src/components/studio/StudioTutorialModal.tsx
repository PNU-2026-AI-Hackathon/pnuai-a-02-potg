'use client';

type StudioTutorialModalProps = {
  onClose: () => void;
};

const tutorialSteps = [
  '프로그램 분야와 주제를 선택합니다.',
  '대상, 운영 방식, 기간, 인원을 정합니다.',
  '필요하면 주민 아이디어와 참고 프로그램을 함께 선택합니다.',
  '필수 조건이 채워지면 생성하기 버튼으로 다음 단계로 이동합니다.',
];

export default function StudioTutorialModal({
  onClose,
}: StudioTutorialModalProps) {
  return (
    <div className="studioModalBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="studioModal studioTutorialModal"
        role="dialog"
        aria-labelledby="studio-tutorial-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="studioModalClose" type="button" aria-label="기능 설명 닫기" onClick={onClose}>
          ×
        </button>
        <p className="uiEyebrow">QUICK GUIDE</p>
        <h2 id="studio-tutorial-title">MOIRA Studio 사용 흐름</h2>
        <ol className="studioTutorialSteps">
          {tutorialSteps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        <button className="uiButton uiButtonPrimary studioModalAction" type="button" onClick={onClose}>
          시작하기
        </button>
      </section>
    </div>
  );
}
