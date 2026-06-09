import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Award, MessageSquare } from 'lucide-react';
import type { Rubric, Sentence, Evaluation, Room } from '../types/game';

export const EvaluationBoard: React.FC = () => {
  const { roomId, nickname } = useParams<{ roomId: string; nickname: string }>();
  const { 
    currentRoom, 
    subscribeRoom, 
    unsubscribeRoom, 
    submitEvaluation 
  } = useGameStore();

  // 평가 진행을 위한 로컬 상태
  const [selectedRoomIdForEval, setSelectedRoomIdForEval] = useState<string | null>(null);
  const [scores, setScores] = useState<{ [rubricId: string]: number }>({});
  const [comment, setComment] = useState('');
  const [evaluationRooms, setEvaluationRooms] = useState<Room[] | null>(null);
  const roomsForEvaluation = evaluationRooms ?? (currentRoom ? [currentRoom] : []);
  const teacherId = currentRoom?.teacherId;
  const projectId = currentRoom?.projectId;
  const [sharedProjectRoomIds, setSharedProjectRoomIds] = useState<string[]>([]);
  const projectRoomIds = useMemo(() => {
    if (!currentRoom) return [];
    const ids = sharedProjectRoomIds.length
      ? sharedProjectRoomIds
      : currentRoom.projectRoomIds?.length
        ? currentRoom.projectRoomIds
        : [currentRoom.id];
    return Array.from(new Set(ids)).sort();
  }, [currentRoom, sharedProjectRoomIds]);

  const submittedRoomIds = useMemo(() => {
    const submittedMap: { [roomId: string]: boolean } = {};
    if (!nickname) return submittedMap;

    roomsForEvaluation.forEach((rm: Room) => {
      const evals = rm.evaluations?.[rm.id] || [];
      const myEval = evals.find((e: Evaluation) => e.evaluatorNickname === nickname);
      if (myEval) {
        submittedMap[rm.id] = true;
      }
    });

    return submittedMap;
  }, [roomsForEvaluation, nickname]);

  // 1. 현재 접속한 모둠방 실시간 구독
  useEffect(() => {
    if (roomId) {
      subscribeRoom(roomId);
    }
    return () => {
      if (roomId) {
        unsubscribeRoom(roomId);
      }
    };
  }, [roomId, subscribeRoom, unsubscribeRoom]);

  // 2. 소속된 프로젝트(학급) 전체 모둠방 목록 로드
  useEffect(() => {
    if (!teacherId || !projectId) {
      setSharedProjectRoomIds([]);
      return;
    }

    const roomIdsRef = ref(db, `teachers/${teacherId}/projects/${projectId}/roomIds`);
    const unsubscribe = onValue(roomIdsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setSharedProjectRoomIds([]);
        return;
      }

      setSharedProjectRoomIds(Object.keys(snapshot.val() as Record<string, true>));
    }, (err) => {
      console.error('Failed to load project room ids:', err);
      setSharedProjectRoomIds([]);
    });

    return () => unsubscribe();
  }, [teacherId, projectId]);

  useEffect(() => {
    if (projectRoomIds.length === 0) {
      setEvaluationRooms(null);
      return;
    }

    const roomDataMap: Record<string, Room> = {};
    const normalizeEvalRoom = (room: Room): Room => ({
      ...room,
      sentences: room.sentences || [],
      studentOrder: room.studentOrder || [],
      students: room.students || {},
      typingStatus: room.typingStatus || {},
      evaluations: room.evaluations || {},
      warningLogs: room.warningLogs || [],
    });

    const updateRooms = () => {
      const rooms = projectRoomIds
        .map((id) => roomDataMap[id])
        .filter((room): room is Room => Boolean(room));
      setEvaluationRooms(rooms);
    };

    const unsubscribes = projectRoomIds.map((id) => onValue(ref(db, `rooms/${id}`), (snapshot) => {
      if (snapshot.exists()) {
        roomDataMap[id] = normalizeEvalRoom(snapshot.val() as Room);
      } else {
        delete roomDataMap[id];
      }
      updateRooms();
    }, (err) => {
      console.error(`Failed to load project room ${id}:`, err);
      delete roomDataMap[id];
      updateRooms();
    }));

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [projectRoomIds]);

  // 평가 대상 방 선택 시 폼 초기화
  const handleSelectRoomForEval = (targetRoom: Room) => {
    if (targetRoom.id === roomId) return; // 본인 방은 평가 불가
    
    setSelectedRoomIdForEval(targetRoom.id);
    setComment('');
    
    const evals = targetRoom.evaluations?.[targetRoom.id] || [];
    const myEval = evals.find((e: Evaluation) => e.evaluatorNickname === nickname);
    
    if (myEval) {
      setScores(myEval.scores);
      setComment(myEval.comment || '');
    } else {
      const initialScores: { [key: string]: number } = {};
      currentRoom?.rubrics.forEach((r: Rubric) => {
        initialScores[r.id] = 5;
      });
      setScores(initialScores);
    }
  };

  const handleScoreChange = (rubricId: string, value: number) => {
    if (selectedRoomIdForEval && submittedRoomIds[selectedRoomIdForEval]) return; // 기제출 시 수정 불가
    setScores({
      ...scores,
      [rubricId]: value,
    });
  };

  const handleSubmitEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !nickname || !selectedRoomIdForEval || !currentRoom) return;

    await submitEvaluation(selectedRoomIdForEval, selectedRoomIdForEval, nickname, scores, comment);
    
    setSelectedRoomIdForEval(null);
    alert('동료 평가가 등록되었습니다! 👍');
  };

  if (!currentRoom) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p>평가 보드 정보를 실시간으로 연결하는 중입니다... ⏳</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 상단 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '2px solid #ddd', paddingBottom: '15px' }}>
        <div>
          <span style={{ fontSize: '0.9rem', color: '#333', background: '#ffe082', border: '1.5px solid #333', padding: '3px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
            학급 모둠 릴레이 이야기 공유방 📚
          </span>
          <h2 style={{ margin: '5px 0 0 0' }}>다른 모둠의 이야기를 읽고 서로 동료 평가를 해보아요!</h2>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
        
        {/* 왼쪽: 모둠별 이야기 갤러리 */}
        <div style={{ flex: '2', minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2>📖 우리 반 이야기 목록 ({roomsForEvaluation.length}개 모둠)</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {roomsForEvaluation.map((room: Room) => {
              const fullStory = room.sentences && room.sentences.length > 0
                ? room.sentences.map((s: Sentence) => s.text).join(' ')
                : '아직 작성된 이야기가 없습니다.';
              
              const isMyRoom = room.id === roomId;
              const hasSubmittedThisRoom = submittedRoomIds[room.id];
              const shouldShowStory = room.status !== 'writing' || isMyRoom;
              const displayStatus = room.status === 'writing' && isMyRoom ? 'evaluating' : room.status;
              const writtenCount = room.sentences?.length || 0;
              const writeUnitLabel = room.writeUnit === 'paragraph' ? '문단' : '문장';
              const progressText = room.endCondition === 'limit'
                ? `${writtenCount}/${room.sentenceLimit}${writeUnitLabel}`
                : `${writtenCount}${writeUnitLabel}`;

              return (
                <div 
                  key={room.id} 
                  className="card" 
                  style={{ 
                    borderStyle: isMyRoom ? 'double' : 'solid', 
                    borderWidth: isMyRoom ? '5px' : '3px',
                    borderColor: isMyRoom ? 'var(--primary)' : '#333',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 'bold', 
                        color: '#fff',
                        background: displayStatus === 'completed' ? '#4caf50' : displayStatus === 'evaluating' ? '#ff9800' : '#2196f3',
                        padding: '3px 8px',
                        borderRadius: '10px'
                      }}>
                        {displayStatus === 'writing' && '📝 작성 중'}
                        {displayStatus === 'evaluating' && '⭐ 평가 진행 중'}
                        {displayStatus === 'completed' && '🏁 이야기 완성'}
                      </span>
                      <strong style={{ fontSize: '1.2rem' }}>{room.title} {isMyRoom && '(우리 모둠 🏠)'}</strong>
                      <span style={{ fontSize: '0.85rem', color: '#555', background: '#fff7d6', border: '1.5px solid #333', borderRadius: '14px', padding: '3px 8px', fontWeight: 'bold' }}>
                        ✍️ {progressText}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isMyRoom ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}>우리 작품</span>
                      ) : room.status === 'writing' ? (
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>작성 완료 대기 중</span>
                      ) : (
                        <button 
                          className={`btn ${hasSubmittedThisRoom ? 'btn-secondary' : 'btn-primary'}`} 
                          style={{ padding: '6px 12px', fontSize: '0.85rem', boxShadow: 'none' }}
                          onClick={() => handleSelectRoomForEval(room)}
                        >
                          {hasSubmittedThisRoom ? '🔍 내 평가 보기' : '⭐ 동료 평가하기'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 이야기 본문 내용 */}
                  <div style={{ 
                    background: '#fffdf9', 
                    border: '1.5px solid #eee', 
                    padding: '15px 20px', 
                    borderRadius: '12px', 
                    fontSize: '1.1rem', 
                    lineHeight: '1.7', 
                    fontFamily: 'var(--font-cute)',
                    color: shouldShowStory ? '#333' : '#999',
                    fontStyle: shouldShowStory ? 'normal' : 'italic'
                  }}>
                    {shouldShowStory ? fullStory : '✏️ 친구들이 이야기를 흥미롭게 쓰고 있는 중입니다. 조금만 기다려 주세요!'}
                  </div>

                  {/* 작성 학생 태그 */}
                  <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#666' }}>
                    <strong>작가진:</strong> {room.studentOrder?.join(', ') || '대기 중'}
                  </div>

                  {/* 선생님 피드백 결과가 등록된 경우 (내 모둠이든 남 모둠이든 확인 가능) */}
                  {room.teacherEvaluation && (
                    <div style={{ marginTop: '15px', padding: '12px 15px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '10px', fontSize: '0.9rem' }}>
                      <strong>👨‍🏫 선생님 피드백 의견:</strong> "{room.teacherEvaluation.comment || '참 잘했습니다!'}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 오른쪽: 루브릭 평가 폼 입력 레이아웃 */}
        <div style={{ flex: '1', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {selectedRoomIdForEval ? (
            <div className="card" style={{ textAlign: 'left', position: 'sticky', top: '20px', borderStyle: 'solid', borderColor: 'var(--accent)' }}>
              <button 
                className="close-modal-btn" 
                style={{ top: '10px', right: '15px' }}
                onClick={() => setSelectedRoomIdForEval(null)}
              >
                ×
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                <Award size={20} color="var(--accent)" />
                <h3 style={{ margin: 0 }}>
                  [{roomsForEvaluation.find(r => r.id === selectedRoomIdForEval)?.title}] 평가하기
                </h3>
              </div>

              {submittedRoomIds[selectedRoomIdForEval] && (
                <div style={{ background: '#e8f5e9', border: '1.5px solid #81c784', padding: '8px 12px', borderRadius: '8px', color: '#2e7d32', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '15px' }}>
                  ✓ 이미 동료 평가 제출이 완료된 모둠입니다.
                </div>
              )}

              <form onSubmit={handleSubmitEval}>
                {currentRoom.rubrics.map((rubric: Rubric) => (
                  <div key={rubric.id} className="rubric-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{rubric.name}</span>
                    <div className="star-rating" style={{ fontSize: '1.5rem', gap: '4px' }}>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <span
                          key={num}
                          className={(scores[rubric.id] || 0) >= num ? 'active' : ''}
                          onClick={() => handleScoreChange(rubric.id, num)}
                          style={{ cursor: submittedRoomIds[selectedRoomIdForEval] ? 'default' : 'pointer' }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="input-group" style={{ marginTop: '15px' }}>
                  <label className="input-label" style={{ fontSize: '0.95rem' }}>💬 이 모둠 글에 남기는 응원의 한마디</label>
                  <textarea
                    className="input-field"
                    rows={3}
                    placeholder="친구들의 소설을 읽고 재미있었던 점이나 느낀 점을 칭찬해 주세요!"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={submittedRoomIds[selectedRoomIdForEval]}
                  />
                </div>

                {!submittedRoomIds[selectedRoomIdForEval] ? (
                  <button type="submit" className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }}>
                    평가 제출하기 🗳️
                  </button>
                ) : (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ width: '100%', justifyContent: 'center', boxShadow: 'none' }}
                    onClick={() => setSelectedRoomIdForEval(null)}
                  >
                    확인 완료
                  </button>
                )}
              </form>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: '#999', borderStyle: 'dashed', position: 'sticky', top: '20px' }}>
              <MessageSquare size={36} style={{ color: '#ccc', marginBottom: '10px' }} />
              <h3>동료 평가를 시작해 보세요</h3>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                왼쪽 목록에서 아직 완료되지 않았거나 완료된 다른 모둠의 **[⭐ 동료 평가하기]** 버튼을 클릭하면 평가 양식이 이곳에 나타납니다.
              </p>
            </div>
          )}

          {/* 우리 모둠에 친구들이 써준 동료 평가 현황 피드백 (우리 모둠방에 달린 평가 확인) */}
          <div className="card" style={{ textAlign: 'left', background: '#f9f9f9' }}>
            <h3 style={{ borderBottom: '2px dashed #ddd', paddingBottom: '8px', marginBottom: '12px' }}>
              💬 친구들이 우리 모둠에 남긴 한마디
            </h3>
            
            {(() => {
              // evaluations 노드에서 내 방(roomId)에 들어온 모든 평가 목록 조회
              const myRoomEvals = currentRoom.evaluations?.[currentRoom.id] || [];
              if (myRoomEvals.length === 0) {
                return (
                  <p style={{ color: '#999', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
                    아직 친구들이 남긴 피드백이 없습니다. 다른 방 친구들이 별점을 남기면 이곳에 표시됩니다! ⏳
                  </p>
                );
              }
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                  {myRoomEvals.map((ev: Evaluation) => {
                    if (!ev.comment?.trim()) return null;
                    return (
                      <div key={ev.evaluatorNickname} style={{ background: '#fff', border: '1px solid #eee', padding: '10px 12px', borderRadius: '10px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--primary-hover)', display: 'block', marginBottom: '3px' }}>
                          ✍️ {ev.evaluatorNickname} 친구의 의견:
                        </span>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: '#333' }}>
                          "{ev.comment}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

        </div>

      </div>
    </div>
  );
};
