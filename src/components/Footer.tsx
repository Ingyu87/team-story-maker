import React, { useState } from 'react';
import { TermsModal } from './TermsModal';

export const Footer: React.FC = () => {
  const [modalType, setModalType] = useState<'terms' | 'privacy'>('terms');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = (type: 'terms' | 'privacy') => {
    setModalType(type);
    setIsModalOpen(true);
  };

  return (
    <footer className="footer">
      <div className="footer-links">
        <button className="footer-link" onClick={() => openModal('terms')}>이용약관</button>
        <span style={{ color: '#666' }}>|</span>
        <button className="footer-link" onClick={() => openModal('privacy')}>개인정보처리방침</button>
      </div>
      <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#aaa' }}>
        <p>© 2026 ingyu's AI world. All rights reserved.</p>
        <p style={{ marginTop: '5px' }}>개인정보책임자: 서울가동초등학교 백인규 교사 (02-448-5766)</p>
      </div>

      <TermsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        type={modalType} 
      />
    </footer>
  );
};
