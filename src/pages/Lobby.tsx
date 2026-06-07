import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { BookOpen, User } from 'lucide-react';

export const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roomId, setRoomId] = useState(() => {
    const codeParam = searchParams.get('code');
    const savedRoomId = localStorage.getItem('relay-story-last-roomId');
    return (codeParam || savedRoomId || '').toUpperCase();
  });
  const [nickname, setNickname] = useState(() => localStorage.getItem('relay-story-last-nickname') || '');
  const [errorMsg, setErrorMsg] = useState('');
  const { joinRoom, loading, error, setError } = useGameStore();

  const handleStudentJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setError(null);

    if (!roomId.trim() || !nickname.trim()) {
      setErrorMsg('방 코드와 닉네임을 모두 입력해 주세요.');
      return;
    }

    // 닉네임 유효성 검사 (초등학생 장난 및 빈칸 방지)
    if (nickname.length < 2 || nickname.length > 8) {
      setErrorMsg('닉네임은 2자 이상, 8자 이하로 입력해 주세요.');
      return;
    }

    const success = await joinRoom(roomId.trim(), nickname.trim());
    if (success) {
      // 입장 성공 시 입력정보 저장
      localStorage.setItem('relay-story-last-roomId', roomId.trim());
      localStorage.setItem('relay-story-last-nickname', nickname.trim());
      navigate(`/student/${roomId.trim()}/${nickname.trim()}`);
    } else {
      setErrorMsg(error || '방 입장 신청에 실패했습니다.');
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'inline-flex', padding: '15px', background: '#ffe082', borderRadius: '50%', border: '3px solid #333', marginBottom: '15px', boxShadow: '3px 3px 0 #333' }}>
          <BookOpen size={48} color="#333" />
        </div>
        <h1>우리들의 이야기 릴레이</h1>
        <p style={{ fontSize: '1.2rem', color: '#666', fontWeight: 'bold' }}>
          선생님이 나눠주신 방 코드와 닉네임을 입력하고 들어가 봐요! ✍️
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', maxWidth: '450px' }}>
        {/* 학생 입장 영역 단독 배치 */}
        <div className="card" style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ padding: '8px', background: '#bbdefb', borderRadius: '50%', border: '2px solid #333' }}>
              <User size={24} />
            </div>
            <h2>이야기방 참여하기</h2>
          </div>
          
          <form onSubmit={handleStudentJoin} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="input-group">
              <label className="input-label">방 코드 (4자리)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="예: AB12" 
                value={roomId} 
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                maxLength={4}
              />
            </div>
            
            <div className="input-group">
              <label className="input-label">내 닉네임 (2~8자)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="예: 씩씩한호랑이" 
                value={nickname} 
                onChange={(e) => setNickname(e.target.value.replace(/\s/g, ''))} // 공백 제거
                maxLength={8}
              />
            </div>

            {errorMsg && (
              <div style={{ color: 'red', fontWeight: 'bold', marginBottom: '15px', fontSize: '0.95rem' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <button 
              type="submit" 
              className={`btn btn-primary ${loading ? 'btn-disabled' : ''}`}
              style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
            >
              {loading ? '입장하는 중...' : '이야기방 입장하기 🚀'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
