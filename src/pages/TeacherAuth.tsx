import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Mail, Lock, UserPlus, LogIn, AlertCircle } from 'lucide-react';

export const TeacherAuth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const { signUp, logIn, loading, error } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim() || !password.trim()) {
      setLocalError('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    if (password.length < 6) {
      setLocalError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    try {
      if (isSignUp) {
        await signUp(email.trim(), password.trim());
      } else {
        await logIn(email.trim(), password.trim());
      }
    } catch (err: unknown) {
      // 에러는 스토어에 세팅되므로 로컬에 뿌림
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px' }}>
      <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '35px' }}>
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', background: '#d1c4e9', border: '2.5px solid #333', borderRadius: '50%', boxShadow: '3px 3px 0 #333', marginBottom: '15px' }}>
            {isSignUp ? <UserPlus size={32} /> : <LogIn size={32} />}
          </div>
          <h2>{isSignUp ? '선생님 회원가입' : '선생님 로그인'}</h2>
          <p style={{ color: '#666', fontSize: '0.95rem' }}>
            {isSignUp 
              ? '가입 후 모둠별 이야기 릴레이를 관리해 보세요.' 
              : '로그인하여 프로젝트 폴더와 기록을 확인하세요.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={16} /> 이메일 주소
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="example@school.es.kr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={16} /> 비밀번호 (6자 이상)
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {(localError || error) && (
            <div style={{ color: 'red', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontSize: '0.9rem' }}>
              <AlertCircle size={16} />
              <span>{localError || error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-accent"
            style={{ width: '100%', justifyContent: 'center', marginBottom: '15px' }}
            disabled={loading}
          >
            {loading 
              ? '진행 중...' 
              : isSignUp ? '선생님 계정 만들기 ✨' : '로그인하기 🔑'}
          </button>
        </form>

        <div style={{ textAlign: 'center', borderTop: '2px dotted #ddd', paddingTop: '15px', marginTop: '10px' }}>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>
            {isSignUp ? '이미 계정이 있으신가요?' : '처음 방문하셨나요?'}
          </span>{' '}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setLocalError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary-hover)',
              textDecoration: 'underline',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {isSignUp ? '로그인하러 가기' : '회원가입하러 가기'}
          </button>
        </div>
      </div>
    </div>
  );
};
