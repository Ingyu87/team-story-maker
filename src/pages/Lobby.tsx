import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { BookOpen, User, Users } from 'lucide-react';

export const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roomId, setRoomId] = useState('');
  const [nickname, setNickname] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const { joinRoom, loading, error, setError } = useGameStore();

  // URL 쿼리 파라미터로 공유받은 방 코드가 있다면 자동 입력
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setRoomId(codeParam.toUpperCase());
    }
  }, [searchParams]);

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
      navigate(`/student/${roomId.trim()}/${nickname.trim()}`);
    } else {
      setErrorMsg(error || '방 입장 신청에 실패했습니다.');
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'inline-flex', padding: '15px', background: '#ffe082', borderRadius: '50%', border: '3px solid #333', marginBottom: '15px', boxShadow: '3px 3px 0 #333' }}>
          <BookOpen size={48} color="#333" />
        </div>
        <h1>우리들의 이야기 릴레이</h1>
        <p style={{ fontSize: '1.2rem', color: '#666', fontWeight: 'bold' }}>
          친구들과 차례대로 한 문장씩 이어 쓰며 아름다운 이야기를 완성해 봐요! ✍️
        </p>
      </div>

      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '900px' }}>
        
        {/* 학생 입장 영역 */}
        <div className="card" style={{ flex: '1', minWidth: '320px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ padding: '8px', background: '#bbdefb', borderRadius: '50%', border: '2px solid #333' }}>
              <User size={24} />
            </div>
            <h2>학생으로 참여하기</h2>
          </div>
          
          <form onSubmit={handleStudentJoin} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="input-group">
              <label className="input-label">방 코드 (4자리 영문/숫자)</label>
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
              <label className="input-label">내 닉네임</label>
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
              style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
            >
              {loading ? '입장하는 중...' : '이야기방 입장하기 🚀'}
            </button>
          </form>
        </div>

        {/* 교사 대시보드 영역 */}
        <div className="card" style={{ flex: '1', minWidth: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ padding: '8px', background: '#d1c4e9', borderRadius: '50%', border: '2px solid #333' }}>
                <Users size={24} />
              </div>
              <h2>선생님 관리 도구</h2>
            </div>
            <p style={{ color: '#555', marginBottom: '20px', fontSize: '1.05rem', textAlign: 'left' }}>
              새로운 이야기 릴레이 방을 만들고, 모둠의 활동을 실시간으로 확인하며 강제 턴 넘기기, 루브릭 설정 및 학생 동료 평가 현황을 모니터링할 수 있습니다.
            </p>
          </div>
          
          <button 
            onClick={() => navigate('/teacher')} 
            className="btn btn-accent"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            새로운 이야기방 만들기 🛠️
          </button>
        </div>

      </div>
    </div>
  );
};
