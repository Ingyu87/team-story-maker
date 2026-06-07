import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { Star, Award, Home } from 'lucide-react';
import type { Rubric, Sentence, Evaluation } from '../types/game';

export const EvaluationBoard: React.FC = () => {
  const { roomId, nickname } = useParams<{ roomId: string; nickname: string }>();
  const navigate = useNavigate();
  const { currentRoom, subscribeRoom, unsubscribeRoom, submitEvaluation } = useGameStore();

  const [scores, setScores] = useState<{ [rubricId: string]: number }>({});
  const [comment, setComment] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (roomId) {
      subscribeRoom(roomId);
    }
    return () => {
      if (roomId) {
        unsubscribeRoom(roomId);
      }
    };
  }, [roomId]);

  // 평가 기본 별점(5점) 세팅 및 기제출 여부 확인
  useEffect(() => {
    if (currentRoom && nickname) {
      const targetRoomId = currentRoom.id;
      const roomEvaluations = currentRoom.evaluations?.[targetRoomId] || [];
      const myEval = roomEvaluations.find((e: Evaluation) => e.evaluatorNickname === nickname);

      if (myEval) {
        setScores(myEval.scores);
        setComment(myEval.comment || '');
        setHasSubmitted(true);
      } else {
        const initialScores: { [key: string]: number } = {};
        currentRoom.rubrics.forEach((r: Rubric) => {
          initialScores[r.id] = 5;
        });
        setScores(initialScores);
      }
    }
  }, [currentRoom, nickname]);

  const handleScoreChange = (rubricId: string, value: number) => {
    if (hasSubmitted) return; // 이미 제출했다면 수정 불가
    setScores({
      ...scores,
      [rubricId]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !nickname || !currentRoom) return;

    await submitEvaluation(roomId, currentRoom.id, nickname, scores, comment);
    setHasSubmitted(true);
    alert('동료 평가가 성공적으로 등록되었습니다. 감사합니다!');
  };

  if (!currentRoom) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p>방 평가 정보를 실시간으로 연결하는 중입니다... ⏳</p>
      </div>
    );
  }

  // 문장 목록을 한 편의 이야기 문단으로 합성
  const fullStory = currentRoom.sentences && currentRoom.sentences.length > 0
    ? currentRoom.sentences.map((s: Sentence) => s.text).join(' ')
    : '작성된 이야기가 없습니다.';

  // 모둠원 목록
  const studentList = currentRoom.studentOrder || [];

  return (
    <div className="app-container">
      
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <span style={{ fontSize: '0.9rem', color: '#666', background: '#ffe082', border: '1.5px solid #333', padding: '3px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
            모둠 이야기 완료 🎉
          </span>
          <h2 style={{ margin: '5px 0 0 0' }}>우리 모둠의 완성 이야기 & 동료 평가 🌟</h2>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          <Home size={16} /> 처음으로
        </button>
      </div>

      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
        
        {/* 왼쪽: 완성된 이야기 책 */}
        <div className="card" style={{ flex: '2', minWidth: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Award size={24} color="#ffb703" />
            <h2>📖 완성작: "{currentRoom.title}"</h2>
          </div>

          <div 
            className="note-container" 
            style={{ 
              flex: '1', 
              fontSize: '1.35rem', 
              lineHeight: '2.2', 
              padding: '30px', 
              minHeight: '250px',
              fontFamily: 'var(--font-cute)',
              backgroundImage: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)',
              backgroundSize: '100% 2.2em'
            }}
          >
            {fullStory}
          </div>

          <div style={{ background: '#f5f5f5', border: '1px solid #ddd', padding: '15px', borderRadius: '12px', marginTop: '20px', textAlign: 'left' }}>
            <h3 style={{ fontSize: '1rem', margin: '0 0 8px 0', color: '#666' }}>✍️ 함께 쓴 작가 친구들:</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {studentList.map((name: string, idx: number) => (
                <span key={name} style={{ background: '#fff', border: '1px solid #ccc', padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  {idx + 1}. {name} {name === nickname && '(나)'}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 오른쪽: 루브릭 평가 및 교사 평가 결과 */}
        <div style={{ flex: '1', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 동료 평가 양식 */}
          <div className="card" style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Star size={22} color="#ffb703" />
              <h2>{hasSubmitted ? '나의 동료 평가 완료' : '내 손으로 매기는 동료 평가'}</h2>
            </div>

            <form onSubmit={handleSubmit}>
              {currentRoom.rubrics.map((rubric: Rubric) => (
                <div key={rubric.id} className="rubric-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{rubric.name}</span>
                  <div className="star-rating">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <span
                        key={num}
                        className={(scores[rubric.id] || 0) >= num ? 'active' : ''}
                        onClick={() => handleScoreChange(rubric.id, num)}
                        style={{ cursor: hasSubmitted ? 'default' : 'pointer' }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              <div className="input-group" style={{ marginTop: '20px' }}>
                <label className="input-label">📝 글을 읽고 느낀 점이나 친구들에게 한마디</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="예: 다 같이 머리를 맞대고 쓰니까 스릴 넘치고 정말 재미있는 이야기가 만들어진 것 같아!"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={hasSubmitted}
                />
              </div>

              {!hasSubmitted ? (
                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  평가 제출하기 🗳️
                </button>
              ) : (
                <div style={{ background: '#e8f5e9', border: '2px solid #81c784', padding: '12px', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold', color: '#2e7d32' }}>
                  평가 작성이 안전하게 저장되었습니다! 👍
                </div>
              )}
            </form>
          </div>

          {/* 선생님의 한마디 (교사 평가 등록 완료 시 노출) */}
          {currentRoom.teacherEvaluation && (
            <div className="card" style={{ borderStyle: 'solid', borderColor: 'var(--accent)', background: '#fffbfa', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <div style={{ background: '#ffebee', padding: '6px', borderRadius: '50%', border: '2px solid var(--accent)' }}>
                  <Award size={20} color="var(--accent)" />
                </div>
                <h2>👨‍🏫 선생님이 보낸 평가 결과</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                {currentRoom.rubrics.map((rubric: Rubric) => (
                  <div key={rubric.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                    <span>⭐ {rubric.name}</span>
                    <strong>{currentRoom.teacherEvaluation?.scores[rubric.id]} / 5 점</strong>
                  </div>
                ))}
              </div>
              
              <div style={{ borderTop: '1px dashed #ffcdd2', paddingTop: '10px' }}>
                <strong>선생님의 종합 평가 의견:</strong>
                <p style={{ marginTop: '5px', fontStyle: 'italic', fontSize: '1.02rem', lineHeight: '1.5', color: '#555' }}>
                  "{currentRoom.teacherEvaluation.comment || '참 잘했습니다!'}"
                </p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
