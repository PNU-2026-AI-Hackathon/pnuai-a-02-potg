const steps = [
  ['01', '주민이 의제를', '제안해요'],
  ['02', '사서가 스튜디오로', '기획해요'],
  ['03', '주민이 수요조사에', '참여해요'],
  ['04', '우리 동네 프로그램으로', '이어져요'],
];

export default function ServiceFlowSection() {
  return (
    <section className="homeSection serviceFlowSection" id="service-flow">
      <div className="uiContainer">
        <div className="serviceFlowIntro">
          <p className="uiEyebrow">HOW MOIRA WORKS</p>
          <h2>모이라는 이렇게 연결됩니다</h2>
          <p>한 사람의 제안이 모두를 위한 프로그램이 되는 과정입니다.</p>
        </div>
        <ol className="serviceFlowList">
          {steps.map(([number, firstLine, secondLine]) => (
            <li key={number}>
              <span className="serviceFlowNumber">{number}</span>
              <div>
                <strong>{firstLine}</strong>
                <strong>{secondLine}</strong>
              </div>
              {number !== '04' ? <span className="serviceFlowArrow" aria-hidden="true">→</span> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
