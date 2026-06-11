import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { filterSentence } from '../utils/filter';
import type { FilterResult } from '../utils/filter';
import { PenTool, AlertCircle } from 'lucide-react';

export const StudentApp: React.FC = () => {
  const { roomId, nickname } = useParams<{ roomId: string; nickname: string }>();
  const navigate = useNavigate();
  const { 
    currentRoom, 
    subscribeRoom, 
    unsubscribeRoom, 
    joinRoom,
    submitSentence, 
    updateTypingStatus, 
    leaveRoom, 
    finishWriting,
    setError 
  } = useGameStore();

  // 로컬 자동 저장 키
  const localStorageKey = `relay-story-draft-${roomId}-${nickname}`;
  const [inputText, setInputText] = useState(() => localStorage.getItem(localStorageKey) || '');
  const [isAiChecking, setIsAiChecking] = useState(false);
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(null);
  
  // AI 필터링 경고 모달 상태
  const [filterAlert, setFilterAlert] = useState<FilterResult | null>(null);
  const removedFromRoomRef = useRef(false);

  // 1. 방 실시간 구독 및 탭 언로드 시 오프라인 처리
  useEffect(() => {
    if (roomId && nickname) {
      joinRoom(roomId, nickname);
      subscribeRoom(roomId);

      // 브라우저 새로고침/종료 시 오프라인 처리
      const handleBeforeUnload = () => {
        leaveRoom(roomId, nickname);
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('pagehide', handleBeforeUnload);
        unsubscribeRoom(roomId);
      };
    }
  }, [roomId, nickname, joinRoom, subscribeRoom, leaveRoom, unsubscribeRoom]);

  // 방 상태가 평가('evaluating' 또는 'completed')로 전환되면 평가 보드로 리다이렉트
  useEffect(() => {
    if (currentRoom && (currentRoom.status === 'evaluating' || currentRoom.status === 'completed')) {
      navigate(`/evaluation/${roomId}/${nickname}`);
    }
  }, [currentRoom, navigate, nickname, roomId]);

  useEffect(() => {
    if (!currentRoom || !nickname || removedFromRoomRef.current) return;
    if (!currentRoom.students?.[nickname]) {
      removedFromRoomRef.current = true;
      alert('선생님이 이야기방에서 내보냈습니다. 다시 참여하려면 선생님께 확인해 주세요.');
      navigate(`/join?code=${roomId || ''}`, { replace: true });
    }
  }, [currentRoom, navigate, nickname, roomId]);

  // 2. 실시간 타이핑 상태 Firebase 동기화 (간단한 디바운스 적용)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    // 로컬스토리지 임시 백업
    localStorage.setItem(localStorageKey, text);

    if (roomId && nickname) {
      updateTypingStatus(roomId, nickname, text, true);

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      typingTimerRef.current = setTimeout(() => {
        updateTypingStatus(roomId, nickname, text, false);
      }, 2000); // 2초간 입력이 없으면 타이핑 중이 아닌 것으로 표시
    }
  };

  // 붙여넣기(Paste) 원천 차단
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    alert('⚠️ 우리들의 이야기 릴레이는 직접 글씨를 써서 정성껏 이야기를 만들어야 해요! 복사/붙여넣기는 사용할 수 없어요.');
  };

  // 문장 전송 처리 (AI 필터 검사 포함)
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !nickname || !inputText.trim()) return;

    setIsAiChecking(true);
    setError(null);

    // AI 필터링 실행
    const filterResult = await filterSentence(inputText.trim());
    setIsAiChecking(false);

    if (!filterResult.isSafe) {
      // 비속어 또는 단순도배 검출 시 전송 차단 및 경고 팝업 활성화
      setFilterAlert(filterResult);
      // Firebase에 경고 기록 저장
      await useGameStore.getState().logWarning(
        roomId, 
        nickname, 
        inputText.trim(), 
        filterResult.reason || '부적절한 단어 사용 또는 의미 없는 나열'
      );
      return;
    }

    if (editingSentenceId) {
      await useGameStore.getState().updateSentenceText(roomId, editingSentenceId, inputText.trim());
      setEditingSentenceId(null);
      alert('문장이 수정되었습니다! ✏️');
    } else {
      // 통과 시 제출
      await submitSentence(roomId, nickname, inputText.trim());
    }
    
    // 상태 및 백업 비우기
    setInputText('');
    localStorage.removeItem(localStorageKey);
    updateTypingStatus(roomId, nickname, '', false);
  };

  // 마지막으로 쓴 문장 삭제 (다시 쓰기)
  const handleDeleteLast = async () => {
    if (!roomId) return;
    if (confirm('⚠️ 정말로 마지막으로 작성한 문장을 삭제하고 다시 쓰시겠습니까? (이전 사람의 차례로 돌아갑니다.)')) {
      await useGameStore.getState().deleteLastSentence(roomId);
      setInputText('');
      setEditingSentenceId(null);
      localStorage.removeItem(localStorageKey);
      alert('마지막 문장이 삭제되어 다시 쓸 수 있게 되었습니다.');
    }
  };

  // 이야기 완성하기 버튼 처리 (자유 모드 시)
  const handleCompleteStory = async () => {
    if (!roomId) return;
    if (confirm('이야기가 완성되었나요? 글쓰기를 끝마치고 친구들의 이야기 평가 화면으로 넘어갑니다.')) {
      await finishWriting(roomId);
    }
  };

  if (!currentRoom) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p>이야기방 정보를 실시간으로 연결하는 중입니다... ⏳</p>
      </div>
    );
  }

  const order = currentRoom.studentOrder || [];
  const currentTurnPlayer = order[currentRoom.currentTurnIndex];
  const isMyTurn = currentRoom.turnMode === 'free' || currentTurnPlayer === nickname;

  // 모둠원 목록
  const studentsList = currentRoom.students ? Object.values(currentRoom.students) : [];
  const writtenCount = currentRoom.sentences?.length || 0;
  const writeUnitLabel = currentRoom.writeUnit === 'paragraph' ? '문단' : '문장';
  const progressText = currentRoom.endCondition === 'limit'
    ? `${writtenCount}/${currentRoom.sentenceLimit}${writeUnitLabel}`
    : `${writtenCount}${writeUnitLabel} 작성`;
  const progressPercent = currentRoom.endCondition === 'limit'
    ? Math.min(100, Math.round((writtenCount / Math.max(currentRoom.sentenceLimit, 1)) * 100))
    : 0;
  const progressSteps = currentRoom.endCondition === 'limit'
    ? Array.from({ length: Math.min(currentRoom.sentenceLimit, 20) })
    : [];

  return (
    <div className="app-container" style={{ backgroundColor: currentRoom.layoutMode === 'storybook' ? '#FFF3E0' : undefined }}>
      
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '0.9rem', color: '#666', background: '#e0e0e0', border: '1.5px solid #333', padding: '3px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
            모둠: {currentRoom.title}
          </span>
          <h2 style={{ margin: '5px 0 0 0' }}>{nickname} 친구의 작문 공간 📝</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ background: '#4caf50', color: 'white', padding: '5px 12px', borderRadius: '15px', fontWeight: 'bold', fontSize: '0.85rem' }}>
            접속 중 🟢
          </span>
        </div>
      </div>

      {/* 턴 상태 배너 */}
      {currentRoom.status === 'writing' && (
        <div className={`turn-banner ${isMyTurn ? 'turn-active' : 'turn-waiting'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PenTool size={20} />
            <div>
              {currentRoom.turnMode === 'free' ? (
                <strong>🎉 자유 글쓰기 시간이에요! 모둠원들과 조율하며 원하는 문장을 적어 보세요.</strong>
              ) : isMyTurn ? (
                <strong>🎉 야호! 지금은 내 차례예요! 멋진 문장을 한 개 써 주세요.</strong>
              ) : (
                <span>
                  지금은 <strong>{currentTurnPlayer || '친구'}</strong>의 차례예요. 다음 순서를 즐겁게 기다려 봐요!
                </span>
              )}
            </div>
          </div>
          {(currentRoom.turnMode === 'free' || (isMyTurn && currentRoom.endCondition === 'free')) && (
            <button className="btn btn-accent" onClick={handleCompleteStory} style={{ padding: '8px 16px', fontSize: '0.95rem' }}>
              이야기 완성하기 🏁
            </button>
          )}
        </div>
      )}

      {currentRoom.status === 'waiting' && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <AlertCircle size={48} style={{ color: '#ffb703', marginBottom: '15px' }} />
          <h2>선생님이 글쓰기를 시작하기를 기다리고 있어요!</h2>
          <p>모든 모둠 친구들이 입장하면 선생님이 게임을 시작해 주실 거예요. 닉네임을 확인하며 기다려 주세요.</p>
          
          <h3 style={{ marginTop: '20px' }}>대기 중인 친구들:</h3>
          <div className="student-grid" style={{ justifyContent: 'center' }}>
            {studentsList.map((st) => (
              <div key={st.nickname} className="student-tag">
                <span className={st.isOnline ? 'student-online-dot' : 'student-offline-dot'} />
                {st.nickname} {st.nickname === nickname && '(나)'}
              </div>
            ))}
          </div>
        </div>
      )}

      {currentRoom.status === 'writing' && (
        <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
          <div style={{ background: '#fff', border: '2.5px solid #333', borderRadius: '16px', padding: '14px 18px', boxShadow: '3px 3px 0 #333', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <strong style={{ fontSize: '1rem' }}>✍️ 우리 모둠 작성 현황</strong>
              <span style={{ background: '#fff7d6', border: '1.5px solid #333', borderRadius: '14px', padding: '4px 10px', fontWeight: 'bold' }}>
                현재 {progressText}
              </span>
            </div>
            {currentRoom.endCondition === 'limit' ? (
              <>
                <div style={{ height: '12px', background: '#eee', border: '1.5px solid #333', borderRadius: '999px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{ width: `${progressPercent}%`, height: '100%', background: '#4caf50' }} />
                </div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {progressSteps.map((_, index) => (
                    <span
                      key={index}
                      title={`${index + 1}번째 ${writeUnitLabel}`}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1.5px solid #333',
                        background: index < writtenCount ? '#d9f99d' : '#fff',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                      }}
                    >
                      {index < writtenCount ? '✓' : index + 1}
                    </span>
                  ))}
                  {currentRoom.sentenceLimit > 20 && (
                    <span style={{ alignSelf: 'center', color: '#666', fontWeight: 'bold' }}>
                      +{currentRoom.sentenceLimit - 20}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                자유 작성 모드라 목표 개수 없이 완성할 때까지 이어 씁니다.
              </p>
            )}
          </div>
          
          {/* 레이아웃 1: 채팅 모드 */}
          {currentRoom.layoutMode === 'chat' && (
            <div className="chat-container">
              {currentRoom.sentences && currentRoom.sentences.length > 0 ? (
                currentRoom.sentences.map((sent) => (
                  <div key={sent.id} className={`chat-bubble ${sent.writer === nickname ? 'me' : 'other'}`}>
                    <div className="chat-writer">{sent.writer === nickname ? '나' : sent.writer}</div>
                    <div>{sent.text}</div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '40px 10px', textAlign: 'center', color: '#999' }}>
                  아직 작성된 이야기가 없어요. 첫 번째 친구가 문장을 시작해 볼까요? 🌟
                </div>
              )}
            </div>
          )}

          {/* 레이아웃 2: 노트 모드 */}
          {currentRoom.layoutMode === 'note' && (
            <div className="note-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentRoom.sentences && currentRoom.sentences.length > 0 ? (
                currentRoom.writeUnit === 'paragraph' ? (
                  currentRoom.sentences.map((sent) => (
                    <p 
                      key={sent.id} 
                      style={{ 
                        margin: 0,
                        textIndent: '10px',
                        backgroundColor: sent.writer === nickname ? '#e8f5e9' : 'transparent',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        borderBottom: '1.5px solid #eee',
                        lineHeight: '1.6',
                        fontSize: '1.05rem',
                        textAlign: 'left'
                      }}
                    >
                      {sent.text}
                    </p>
                  ))
                ) : (
                  <div style={{ textAlign: 'left', lineHeight: '1.6', fontSize: '1.05rem' }}>
                    {currentRoom.sentences.map((sent) => (
                      <span 
                        key={sent.id} 
                        className="note-sentence" 
                        style={{ 
                          backgroundColor: sent.writer === nickname ? '#e8f5e9' : 'transparent',
                          borderBottom: '2px solid #ddd',
                          marginRight: '6px',
                          display: 'inline-block'
                        }}
                      >
                        {sent.text}
                      </span>
                    ))}
                  </div>
                )
              ) : (
                <div style={{ padding: '40px 10px', textAlign: 'center', color: '#999' }}>
                  빈 공책이에요. 이야기의 첫 단추를 멋지게 채워보아요! ✏️
                </div>
              )}
            </div>
          )}

          {/* ...동화책 모드 */}
          {currentRoom.layoutMode === 'storybook' && (
            <div className="storybook-container">
              <div className="storybook-pages">
                {currentRoom.sentences && currentRoom.sentences.length > 0 ? (
                  <div className="storybook-page">
                    <p style={{ fontStyle: 'italic', color: '#777', fontSize: '0.95rem' }}>
                      바로 앞 친구({currentRoom.sentences[currentRoom.sentences.length - 1].writer})가 쓴 내용:
                    </p>
                    <p style={{ fontWeight: 'bold' }}>
                      "{currentRoom.sentences[currentRoom.sentences.length - 1].text}"
                    </p>
                    <div className="storybook-page-num">
                      앞 페이지 (P. {currentRoom.sentences.length})
                    </div>
                  </div>
                ) : (
                  <div className="storybook-page">
                    <p style={{ color: '#999' }}>이야기의 시작점입니다. 첫 페이지를 펼쳐보세요!</p>
                    <div className="storybook-page-num">P. 1</div>
                  </div>
                )}
                
                <div className="storybook-page" style={{ borderStyle: 'solid', borderColor: '#ffb703', background: '#fff' }}>
                  <p style={{ color: '#ffb703', fontWeight: 'bold' }}>새로운 이야기 페이지 📖</p>
                  {isMyTurn ? (
                    <p style={{ fontSize: '1.1rem', color: '#555' }}>여기에 다음 문장을 이어 써 보세요!</p>
                  ) : (
                    <p style={{ color: '#888' }}>
                      {currentTurnPlayer} 친구가 다음 이야기를 흥미롭게 구상하고 있는 중이에요!
                    </p>
                  )}
                  <div className="storybook-page-num">
                    현재 페이지 (P. {(currentRoom.sentences?.length || 0) + 1})
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 실시간 타이핑 중인 사람 표시 (나 제외) */}
          <div style={{ minHeight: '30px', textAlign: 'left' }}>
            {Object.entries(currentRoom.typingStatus || {}).map(([name, status]) => {
              if (name !== nickname && status.isTyping && status.text) {
                return (
                  <span key={name} className="typing-indicator" style={{ marginRight: '10px' }}>
                    {name}님이 타이핑 중...
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </span>
                );
              }
              return null;
            })}
          </div>

          {/* 내가 작성한 마지막 문장 수정/삭제 제어 배너 */}
          {currentRoom.sentences && currentRoom.sentences.length > 0 && currentRoom.sentences[currentRoom.sentences.length - 1].writer === nickname && (
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: '#e3f2fd', border: '2.5px solid #333', borderRadius: '12px', padding: '12px 18px', textAlign: 'left', boxShadow: '3px 3px 0 #333' }}>
              <span style={{ fontSize: '0.95rem', color: '#1565c0', flex: '1', fontWeight: '500' }}>
                🙋‍♂️ 내가 방금 전송한 문장: <strong>"{currentRoom.sentences[currentRoom.sentences.length - 1].text}"</strong>
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  style={{ padding: '4px 10px', fontSize: '0.85rem', boxShadow: 'none', background: '#fff', borderColor: '#333' }}
                  onClick={() => {
                    setInputText(currentRoom.sentences[currentRoom.sentences.length - 1].text);
                    setEditingSentenceId(currentRoom.sentences[currentRoom.sentences.length - 1].id);
                  }}
                >
                  ✏️ 수정하기
                </button>
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  style={{ padding: '4px 10px', fontSize: '0.85rem', boxShadow: 'none', background: '#ffebee', color: '#c62828', borderColor: '#ef9a9a' }}
                  onClick={handleDeleteLast}
                >
                  🔄 삭제 후 다시 쓰기
                </button>
              </div>
            </div>
          )}

          {/* 문장 입력 양식 */}
          <div className="card" style={{ padding: '20px' }}>
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ flex: '1', position: 'relative' }}>
                {currentRoom.writeUnit === 'paragraph' ? (
                  <textarea
                    className="input-field"
                    style={{ minHeight: '100px', resize: 'vertical', paddingRight: '70px', paddingTop: '10px', display: 'block', width: '100%' }}
                    placeholder={
                      editingSentenceId
                        ? '선택한 문단을 수정하여 다시 보내주세요.'
                        : isMyTurn 
                        ? '이야기에 이어질 다음 문단을 입력해 주세요. (줄바꿈 가능, 최대 500자)'
                        : `${currentTurnPlayer || '친구'}의 입력 순서입니다. 기다려 주세요.`
                    }
                    value={inputText}
                    onChange={handleInputChange}
                    onPaste={handlePaste}
                    disabled={(!isMyTurn && !editingSentenceId) || isAiChecking}
                    maxLength={500}
                  />
                ) : (
                  <input
                    type="text"
                    className="input-field"
                    placeholder={
                      editingSentenceId
                        ? '선택한 문장을 수정하여 다시 보내주세요.'
                        : isMyTurn 
                        ? '이야기에 이어질 다음 문장을 입력해 주세요. (예: 결국 호랑이는 도망을 쳤습니다.)'
                        : `${currentTurnPlayer || '친구'}의 입력 순서입니다. 기다려 주세요.`
                    }
                    value={inputText}
                    onChange={handleInputChange}
                    onPaste={handlePaste}
                    disabled={(!isMyTurn && !editingSentenceId) || isAiChecking}
                    maxLength={100}
                  />
                )}
                <span style={{ position: 'absolute', right: '15px', bottom: '15px', color: '#999', fontSize: '0.85rem' }}>
                  {inputText.length} / {currentRoom.writeUnit === 'paragraph' ? 500 : 100}자
                </span>
              </div>
              <button
                type="submit"
                className={`btn btn-primary ${((!isMyTurn && !editingSentenceId) || !inputText.trim() || isAiChecking) ? 'btn-disabled' : ''}`}
                style={{ whiteSpace: 'nowrap', background: editingSentenceId ? '#ffb703' : undefined }}
              >
                {isAiChecking ? 'AI 검사 중...' : editingSentenceId ? '✏️ 수정 완료' : '문장 전송 🚀'}
              </button>
              {editingSentenceId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ whiteSpace: 'nowrap', padding: '10px 16px', boxShadow: 'none', borderColor: '#333' }}
                  onClick={() => {
                    setEditingSentenceId(null);
                    setInputText('');
                    localStorage.removeItem(localStorageKey);
                  }}
                >
                  ❌ 취소
                </button>
              )}
            </form>
            <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '10px', textAlign: 'left' }}>
              💡 직접 손글씨를 적듯이 차근차근 문장을 입력해요. 붙여넣기는 금지되어 있어요.
            </p>
          </div>

        </div>
      )}

      {/* AI 필터링 비속어/의미 없는 단어 경고창 모달 */}
      {filterAlert && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderColor: 'red' }}>
            <div style={{ display: 'inline-flex', padding: '12px', background: '#ffebee', borderRadius: '50%', border: '2px solid red', marginBottom: '15px' }}>
              <AlertCircle size={32} color="red" />
            </div>
            
            <h2 style={{ color: 'red', margin: '0 0 10px 0' }}>안내해 드립니다!</h2>
            <p style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '15px' }}>
              {filterAlert.reason || '글 내용에 적절하지 않은 표현이나 반복되는 글자가 포함되어 있습니다.'}
            </p>
            
            {filterAlert.suggestedText && (
              <div style={{ background: '#f5f5f5', border: '1px solid #ddd', padding: '15px', borderRadius: '10px', marginBottom: '20px', textAlign: 'left' }}>
                <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>💡 인공지능 선생님 추천 문장:</p>
                <p style={{ fontSize: '1.05rem', color: '#333', fontWeight: 'bold', fontStyle: 'italic' }}>
                  "{filterAlert.suggestedText}"
                </p>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', padding: '6px 12px', fontSize: '0.85rem', marginTop: '10px', boxShadow: 'none' }}
                  onClick={() => {
                    setInputText(filterAlert.suggestedText || '');
                    setFilterAlert(null);
                  }}
                >
                  추천 문장 사용하기
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setFilterAlert(null)}
              >
                다시 쓰기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
