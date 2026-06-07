import React from 'react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-terms-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-modal-btn" onClick={onClose}>×</button>
        
        {type === 'terms' ? (
          <div>
            <h2>ingyu's AI world 이용약관</h2>
            <div className="terms-scroll">
              <p><strong>ingyu's AI world (이하 본 서비스) 이용약관에 오신 것을 환영합니다.</strong> 본 약관은 서비스 이용에 관한 기본적인 사항을 정하고 있습니다.</p>
              
              <p><strong>제1조 (목적)</strong><br />
              본 약관은 ingyu's AI world(이하 "서비스")가 제공하는 교육용 협동 글쓰기 웹앱 '우리들의 이야기 릴레이'의 이용과 관련하여 서비스 제공자와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
              
              <p><strong>제2조 (서비스의 제공)</strong><br />
              ① 본 서비스는 초등학생 대상의 AI 기반 협동 글쓰기 웹앱을 제공합니다.<br />
              ② 제공되는 서비스의 주요 기능은 다음과 같습니다:<br />
              1. 모둠별 순차적 이야기 이어쓰기 기능<br />
              2. AI(Gemini API)를 활용한 실시간 비속어 및 부적절한 단어 필터링<br />
              3. 교사의 실시간 활동 모니터링 및 학급 운영 지원 도구</p>
              
              <p><strong>제3조 (서비스 이용 대상)</strong><br />
              ① 본 서비스는 초등학생을 주 대상으로 합니다.<br />
              ② 교사는 학급 단위로 모둠을 생성하고 학생들의 서비스 이용을 관리 및 통제할 권한과 책임이 있습니다.<br />
              ③ 만 14세 미만 이용자는 수업 목적의 테두리 안에서 본 서비스를 이용하며, 필요시 법정대리인(보호자) 또는 담당 교사의 지도를 받습니다.</p>
              
              <p><strong>제4조 (서비스 이용 시간)</strong><br />
              ① 서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다.<br />
              ② 단, 시스템 정기 점검, AI API 통신 장애 등 불가피한 사유가 발생할 경우 서비스 제공이 일시 중단될 수 있습니다.</p>
              
              <p><strong>제5조 (이용자의 의무)</strong><br />
              ① 이용자는 다음 행위를 하여서는 안 됩니다:<br />
              1. 타인(친구)의 닉네임을 도용하여 접속하는 행위<br />
              2. 욕설, 비속어, 음란물 등 타인에게 불쾌감을 주는 내용을 게시하는 행위<br />
              3. 필터링 시스템을 의도적으로 우회하여 부적절한 텍스트를 전송하는 행위<br />
              4. 복사 및 붙여넣기 등 서비스가 의도한 정상적인 이용 방식을 방해하는 행위</p>
              
              <p><strong>제6조 (서비스 제공자의 의무)</strong><br />
              ① 서비스 제공자는 안정적인 교육 서비스 제공을 위해 최선을 다합니다.<br />
              ② 학생들의 바른 언어 습관 형성을 위해 AI 필터링 기술을 유지하고 개선합니다.</p>
              
              <p><strong>제7조 (저작권)</strong><br />
              ① 서비스 내 디자인 및 시스템의 저작권은 서비스 제공자에게 있습니다.<br />
              ② 학생들이 작성한 릴레이 이야기의 저작권은 해당 학생들에게 있으나, 서비스 제공자 및 담당 교사는 교육적 목적으로 이를 학급 내에서 활용하거나 게시할 수 있습니다.</p>
              
              <p><strong>제8조 (책임의 제한)</strong><br />
              ① 서비스 제공자는 천재지변, 외부 AI API(Gemini) 장애 등 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.<br />
              ② 이용자의 귀책사유로 인한 서비스 이용 장애나 닉네임 도용 문제에 대해서는 책임을 지지 않습니다.</p>
              
              <p><strong>제9조 (분쟁 해결 및 효력)</strong><br />
              ① 본 약관은 2026년 3월 1일부터 시행됩니다. 약관 변경 시 사전에 안내합니다.</p>
            </div>
          </div>
        ) : (
          <div>
            <h2>개인정보처리방침</h2>
            <div className="terms-scroll">
              <p><strong>ingyu's AI world는 학생들의 개인정보 보호를 최우선으로 생각합니다.</strong></p>
              
              <p><strong>1. 수집하는 개인정보의 항목 및 목적</strong><br />
              ① <strong>수집 항목:</strong> 본 서비스는 회원가입 절차가 없으며, 이름, 전화번호, 이메일 등 개인을 특정할 수 있는 민감한 정보를 일절 수집하지 않습니다. 단, 활동 진행을 위해 <strong>'임시 닉네임'</strong>만을 수집합니다.<br />
              ② <strong>수집 및 이용 목적:</strong> 수집된 닉네임은 오직 모둠 내에서 순서를 식별하고, 누가 글을 작성했는지 구분하는 교육적 활동 목적(릴레이 글쓰기)으로만 사용됩니다.</p>
              
              <p><strong>2. 개인정보의 보유 및 이용 기간</strong><br />
              본 서비스는 임시 닉네임 외의 정보를 보관하지 않으며, 작성된 이야기 데이터와 닉네임은 해당 학급의 <strong>교육 활동(세션)이 종료되거나 담당 교사가 모둠을 삭제할 때까지만 보관</strong>됩니다. 영구적인 아카이빙을 목적으로 하지 않습니다.</p>
              
              <p><strong>3. 개인정보의 제3자 제공</strong><br />
              본 서비스는 수집된 닉네임 및 작성 데이터를 외부 제3자에게 제공하거나 상업적으로 이용하지 않습니다. (단, 문장 필터링을 위해 입력된 텍스트는 익명화되어 일시적으로 Gemini API로 전송되며, 학습 데이터로 저장되지 않습니다.)</p>
              
              <p><strong>4. 개인정보 보호를 위한 안전성 확보 조치</strong><br />
              서비스 제공자는 학생들의 데이터가 유출되지 않도록 데이터베이스(Firebase) 보안 규칙을 엄격하게 설정하여 접근을 통제하고 있습니다.</p>
              
              <p><strong>5. 개인정보책임자</strong><br />
              개인정보 보호와 관련된 문의 사항은 아래의 연락처로 문의해 주시기 바랍니다.<br />
              * 개인정보책임자: 백인규 교사 (서울가동초등학교)<br />
              * 문의: 02-448-5766</p>
            </div>
          </div>
        )}
        
        <div style={{ textAlign: 'center' }}>
          <button className="btn btn-primary" onClick={onClose}>확인했습니다</button>
        </div>
      </div>
    </div>
  );
};
