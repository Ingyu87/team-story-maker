import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';
import { TeacherAuth } from './TeacherAuth';
import type { LayoutMode, Rubric, Room } from '../types/game';
import { 
  Play, 
  SkipForward, 
  Users, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  ClipboardList, 
  BookOpen, 
  Folder, 
  FolderPlus, 
  LogOut, 
  CheckCircle2, 
  Eye 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Auth Store
  const { user, loading: authLoading, initializeAuth, logOut } = useAuthStore();

  // Game Store
  const { 
    createRoom, 
    currentRoom, 
    subscribeRoom, 
    unsubscribeRoom, 
    startRoom, 
    skipTurn, 
    submitTeacherEvaluation, 
    completeRoom,
    projects,
    projectRooms,
    loadProjects,
    createProject,
    deleteProject,
    loadRoomsByProject
  } = useGameStore();

  // Navigation / Selection State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Modals & Creation UI State
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [showCreateRoomForm, setShowCreateRoomForm] = useState(false);

  // 방 생성 Form State
  const [title, setTitle] = useState('');
  const [maxStudents, setMaxStudents] = useState(4);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('chat');
  const [endCondition, setEndCondition] = useState<'limit' | 'free'>('limit');
  const [sentenceLimit, setSentenceLimit] = useState(10);
  const [rubrics, setRubrics] = useState<Rubric[]>([
    { id: 'r1', name: '창의성 (재미있는 상상력)', maxScore: 5 },
    { id: 'r2', name: '협동성 (앞 문장과 이어지는 내용)', maxScore: 5 },
    { id: 'r3', name: '올바른 언어 (맞춤법과 바른말)', maxScore: 5 },
  ]);
  const [newRubricName, setNewRubricName] = useState('');

  // 교사 평가 Form State
  const [evalScores, setEvalScores] = useState<{ [rubricId: string]: number }>({});
  const [evalComment, setEvalComment] = useState('');

  // 아카이브 뷰어 상태
  const [viewingArchiveRoom, setViewingArchiveRoom] = useState<Room | null>(null);

  // 1. Auth 세션 감지
  useEffect(() => {
    const unsubscribe = initializeAuth();
    return () => unsubscribe();
  }, []);

  // 2. 로그인 시 프로젝트 로드
  useEffect(() => {
    if (user) {
      loadProjects(user.uid);
    }
  }, [user]);

  // 3. 프로젝트 선택 시 해당 프로젝트의 방 목록 로드
  useEffect(() => {
    if (user && selectedProjectId) {
      loadRoomsByProject(user.uid, selectedProjectId);
    }
  }, [selectedProjectId, currentRoom?.status]); // 방 상태 변경 시 리로드

  // 4. 이야기방 실시간 구독 동기화
  useEffect(() => {
    if (activeRoomId) {
      subscribeRoom(activeRoomId);
    }
    return () => {
      if (activeRoomId) {
        unsubscribeRoom(activeRoomId);
      }
    };
  }, [activeRoomId]);

  // 평가 기본값 세팅
  useEffect(() => {
    if (currentRoom && rubrics.length > 0) {
      const initialScores: { [key: string]: number } = {};
      currentRoom.rubrics.forEach(r => {
        initialScores[r.id] = 5;
      });
      setEvalScores(initialScores);
    }
  }, [currentRoom?.status]);

  // 프로젝트 생성 처리
  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newProjectName.trim()) return;

    try {
      await createProject(user.uid, newProjectName.trim(), newProjectDesc.trim());
      setNewProjectName('');
      setNewProjectDesc('');
      setShowNewProjectModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  // 프로젝트 삭제 처리
  const handleDeleteProject = async (projId: string, name: string) => {
    if (!user) return;
    if (confirm(`⚠️ [${name}] 프로젝트 폴더를 삭제하시겠습니까?\n폴더 내의 모든 이야기방 및 기록들이 함께 삭제됩니다. 되돌릴 수 없습니다.`)) {
      await deleteProject(user.uid, projId);
      if (selectedProjectId === projId) {
        setSelectedProjectId(null);
      }
    }
  };

  // 이야기방 생성 제출 처리
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProjectId || !title.trim()) return;

    try {
      const id = await createRoom({
        title: title.trim(),
        maxStudents,
        layoutMode,
        endCondition,
        sentenceLimit,
        rubrics,
        teacherId: user.uid,
        projectId: selectedProjectId,
      });
      setActiveRoomId(id);
      setShowCreateRoomForm(false);
      setTitle('');
    } catch (err) {
      console.error(err);
    }
  };

  const addRubric = () => {
    if (!newRubricName.trim()) return;
    const newRubric: Rubric = {
      id: `r-${Date.now()}`,
      name: newRubricName.trim(),
      maxScore: 5,
    };
    setRubrics([...rubrics, newRubric]);
    setNewRubricName('');
  };

  const removeRubric = (id: string) => {
    setRubrics(rubrics.filter(r => r.id !== id));
  };

  const handleTeacherEvalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoomId || !user || !selectedProjectId) return;

    await submitTeacherEvaluation(activeRoomId, evalScores, evalComment);
    await completeRoom(activeRoomId);
    alert('모둠 평가가 완료되었습니다!');
    
    // 리스트 리로드
    await loadRoomsByProject(user.uid, selectedProjectId);
  };

  // 로딩 분기
  if (authLoading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p>선생님 인증 세션을 확인 중입니다... ⏳</p>
      </div>
    );
  }

  // 로그인 분기
  if (!user) {
    return <TeacherAuth />;
  }

  const joinedStudents = currentRoom?.students ? Object.values(currentRoom.students) : [];
  const activeProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="app-container">
      
      {/* 교사 계정 정보 & 상단 바 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '2px solid #ddd', paddingBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1rem', fontWeight: 'bold', background: '#d1c4e9', border: '1.5px solid #333', padding: '5px 12px', borderRadius: '25px' }}>
            📧 {user.email} (선생님)
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.95rem' }} onClick={() => navigate('/join')}>
            로비로 가기
          </button>
          <button className="btn btn-accent" style={{ padding: '8px 16px', fontSize: '0.95rem', background: '#e53935' }} onClick={logOut}>
            <LogOut size={16} /> 로그아웃
          </button>
        </div>
      </div>

      {/* 상황 1: 특정 룸 실시간 제어화면 활성화 상태 */}
      {activeRoomId && currentRoom && (
        <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
          {/* 뒤로 가기 */}
          <div>
            <button className="btn btn-secondary" onClick={() => setActiveRoomId(null)}>
              <ArrowLeft size={18} /> 프로젝트 폴더로 돌아가기
            </button>
          </div>

          {/* 상단 방 정보 */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <span style={{ background: '#ffdd67', border: '2px solid #333', padding: '5px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem', marginRight: '10px' }}>
                방 코드: {currentRoom.id}
              </span>
              <h2 style={{ display: 'inline', margin: 0 }}>{currentRoom.title}</h2>
              <p style={{ color: '#666', marginTop: '5px' }}>
                레이아웃: {currentRoom.layoutMode === 'chat' ? '💬 채팅' : currentRoom.layoutMode === 'note' ? '📝 줄글' : '📖 동화책'} |{' '}
                종료 조건: {currentRoom.endCondition === 'limit' ? `${currentRoom.sentenceLimit}문장` : '자유 글쓰기'}
              </p>
            </div>

            {/* 링크 안내 */}
            <div style={{ textAlign: 'right', border: '2px dashed #999', padding: '12px 18px', borderRadius: '15px', background: '#fafafa' }}>
              <span style={{ fontSize: '0.9rem', color: '#666', display: 'block', marginBottom: '5px' }}>학생들 접속 주소:</span>
              <code style={{ fontSize: '1rem', background: '#eee', padding: '4px 8px', borderRadius: '5px' }}>
                {window.location.origin}/join?code={currentRoom.id}
              </code>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', marginLeft: '10px', fontSize: '0.85rem', boxShadow: 'none' }}
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/join?code=${currentRoom.id}`);
                  alert('주소가 복사되었습니다!');
                }}
              >
                주소 복사
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            
            {/* 왼쪽: 학생 리스트 */}
            <div className="card" style={{ flex: '1', minWidth: '300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <Users size={20} />
                <h2>참여 학생 ({joinedStudents.length}/{currentRoom.maxStudents}명)</h2>
              </div>

              {joinedStudents.length === 0 ? (
                <div style={{ padding: '40px 10px', textAlign: 'center', color: '#999' }}>
                  입장을 기다리고 있습니다... ⏳
                </div>
              ) : (
                <div>
                  <div className="student-grid" style={{ marginBottom: '20px' }}>
                    {joinedStudents.map((st) => (
                      <div key={st.nickname} className="student-tag">
                        <span className={st.isOnline ? 'student-online-dot' : 'student-offline-dot'} />
                        {st.nickname}
                      </div>
                    ))}
                  </div>

                  {currentRoom.status === 'waiting' && (
                    <button
                      onClick={() => startRoom(currentRoom.id)}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Play size={18} /> 글쓰기 활동 시작하기! 🎬
                    </button>
                  )}
                </div>
              )}

              {currentRoom.status === 'writing' && (
                <div style={{ borderTop: '2px dashed #ddd', paddingTop: '20px', marginTop: '20px', textAlign: 'left' }}>
                  <h3>💡 턴 컨트롤</h3>
                  <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '15px' }}>
                    작성이 너무 지체될 경우 차례를 넘겨줍니다.
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#ffebee', borderRadius: '12px', border: '1px solid #ef9a9a' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', color: '#e53935', display: 'block', fontWeight: 'bold' }}>현재 차례:</span>
                      <strong style={{ fontSize: '1.1rem' }}>
                        {currentRoom.studentOrder[currentRoom.currentTurnIndex] || '대기 중'}
                      </strong>
                    </div>
                    
                    <button className="btn btn-accent" onClick={() => skipTurn(currentRoom.id)}>
                      <SkipForward size={18} /> 턴 강제 넘기기
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 오른쪽: 모니터링 */}
            <div className="card" style={{ flex: '2', minWidth: '350px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <BookOpen size={20} />
                <h2>실시간 작성 본문 모니터링</h2>
              </div>

              {currentRoom.status === 'waiting' && (
                <div style={{ padding: '60px 10px', textAlign: 'center', color: '#999' }}>
                  수업 시작 버튼을 누르면 실시간 본문이 집계됩니다.
                </div>
              )}

              {currentRoom.status !== 'waiting' && (
                <div>
                  <div className="note-container">
                    {currentRoom.sentences && currentRoom.sentences.length > 0 ? (
                      currentRoom.sentences.map((sent) => (
                        <span key={sent.id} className="note-sentence">
                          {sent.text} <strong>({sent.writer})</strong>{' '}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#999' }}>첫 문장 작성 대기 중...</span>
                    )}

                    {Object.entries(currentRoom.typingStatus || {}).map(([name, status]) => {
                      if (status.isTyping && status.text) {
                        return (
                          <div key={name} style={{ display: 'block', marginTop: '10px' }}>
                            <span className="typing-indicator">
                              {name}님이 입력 중: "{status.text}"
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* 평가 단계 */}
          {(currentRoom.status === 'evaluating' || currentRoom.status === 'completed') && (
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <ClipboardList size={24} />
                <h2>👨‍🏫 교사 최종 평가 피드백 등록</h2>
              </div>

              {currentRoom.status === 'completed' && currentRoom.teacherEvaluation ? (
                <div style={{ textAlign: 'left', padding: '20px', background: '#f9f9f9', borderRadius: '15px', border: '2px solid #333' }}>
                  <h3>평가 기록 완료됨</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                    {currentRoom.rubrics.map(rubric => (
                      <div key={rubric.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>⭐ {rubric.name}</strong>
                        <span>{currentRoom.teacherEvaluation?.scores[rubric.id]} / 5 점</span>
                      </div>
                    ))}
                  </div>
                  <p><strong>종합 의견:</strong> {currentRoom.teacherEvaluation.comment || '의견 없음'}</p>
                </div>
              ) : (
                <form onSubmit={handleTeacherEvalSubmit} style={{ textAlign: 'left' }}>
                  <p style={{ color: '#666', marginBottom: '20px' }}>
                    이야기 릴레이가 완료되었습니다. 점수와 피드백을 전달해 주세요.
                  </p>

                  {currentRoom.rubrics.map((rubric) => (
                    <div key={rubric.id} className="rubric-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 'bold' }}>⭐ {rubric.name}</span>
                      <div className="star-rating">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <span
                            key={num}
                            className={(evalScores[rubric.id] || 0) >= num ? 'active' : ''}
                            onClick={() => setEvalScores({ ...evalScores, [rubric.id]: num })}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="input-group" style={{ marginTop: '20px' }}>
                    <label className="input-label">교사 피드백 종합 의견</label>
                    <textarea
                      rows={4}
                      className="input-field"
                      placeholder="내용을 채워주세요."
                      value={evalComment}
                      onChange={(e) => setEvalComment(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }}>
                    모둠 평가 전송하기 🎓
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* 상황 2: 프로젝트 폴더 상세 화면 (특정 폴더가 선택되어 있고 룸 상세가 열리지 않은 상태) */}
      {!activeRoomId && selectedProjectId && (
        <div>
          {/* 뒤로 가기 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <button className="btn btn-secondary" onClick={() => setSelectedProjectId(null)}>
              <ArrowLeft size={18} /> 프로젝트 목록으로
            </button>
            <h2 style={{ margin: 0 }}>📁 폴더: {activeProject?.name}</h2>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
            {/* 새 이야기방 개설 버튼 토글 */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>이 프로젝트 아래의 이야기방 관리</h3>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '5px', textAlign: 'left' }}>
                    수업 내의 모둠별로 방을 추가로 개설할 수 있습니다.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateRoomForm(!showCreateRoomForm)}>
                  {showCreateRoomForm ? '개설 창 닫기' : '➕ 새 이야기방 만들기'}
                </button>
              </div>

              {/* 새 방 만들기 폼 */}
              {showCreateRoomForm && (
                <form onSubmit={handleCreateRoom} style={{ borderTop: '2px dashed #ddd', marginTop: '20px', paddingTop: '20px', textAlign: 'left' }}>
                  <div className="input-group">
                    <label className="input-label">모둠/방 제목</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="예: 백두산 호랑이 모둠방"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div className="input-group" style={{ flex: '1', minWidth: '150px' }}>
                      <label className="input-label">최대 학생 수</label>
                      <input
                        type="number"
                        className="input-field"
                        min={1}
                        max={10}
                        value={maxStudents}
                        onChange={(e) => setMaxStudents(parseInt(e.target.value))}
                      />
                    </div>

                    <div className="input-group" style={{ flex: '1', minWidth: '150px' }}>
                      <label className="input-label">디자인 테마 레이아웃</label>
                      <select
                        className="select-field"
                        value={layoutMode}
                        onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
                      >
                        <option value="chat">💬 채팅방 레이아웃</option>
                        <option value="note">📝 줄글 종합 공책</option>
                        <option value="storybook">📖 동화책 넘기기</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="input-group" style={{ flex: '1', minWidth: '200px' }}>
                      <label className="input-label">글쓰기 종료 조건</label>
                      <select
                        className="select-field"
                        value={endCondition}
                        onChange={(e) => setEndCondition(e.target.value as 'limit' | 'free')}
                      >
                        <option value="limit">📏 설정된 목표 문장 수 도달 시 종료</option>
                        <option value="free">🔓 자유로운 글쓰기 (직접 완료 클릭)</option>
                      </select>
                    </div>

                    {endCondition === 'limit' && (
                      <div className="input-group" style={{ flex: '1', minWidth: '150px' }}>
                        <label className="input-label">목표 문장 수</label>
                        <input
                          type="number"
                          className="input-field"
                          min={2}
                          max={50}
                          value={sentenceLimit}
                          onChange={(e) => setSentenceLimit(parseInt(e.target.value))}
                        />
                      </div>
                    )}
                  </div>

                  {/* 평가 루브릭 설정 */}
                  <div className="input-group" style={{ borderTop: '2px dashed #ddd', paddingTop: '20px', marginTop: '20px' }}>
                    <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>📊 동료 평가 루브릭 설정</span>
                      <span style={{ fontSize: '0.85rem', color: '#999' }}>최대 5점 기준</span>
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                      {rubrics.map((rubric) => (
                        <div key={rubric.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 15px', background: '#f5f5f5', borderRadius: '10px', border: '1px solid #ddd' }}>
                          <span style={{ fontWeight: 'bold' }}>⭐ {rubric.name}</span>
                          <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', boxShadow: 'none' }} onClick={() => removeRubric(rubric.id)}>
                            <Trash2 size={16} color="red" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="새로운 평가 기준 항목 입력..."
                        value={newRubricName}
                        onChange={(e) => setNewRubricName(e.target.value)}
                      />
                      <button type="button" className="btn btn-secondary" onClick={addRubric}>
                        <Plus size={18} /> 추가
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-accent" style={{ width: '100%', justifyContent: 'center', marginTop: '20px' }}>
                    이야기방 개설하기 🚀
                  </button>
                </form>
              )}
            </div>

            {/* 개설된 이야기방 리스트 */}
            <div className="card">
              <h2>개설된 이야기방 목록 ({projectRooms.length}개)</h2>
              {projectRooms.length === 0 ? (
                <div style={{ padding: '40px 10px', textAlign: 'center', color: '#999' }}>
                  이 폴더 하위에 개설된 이야기방이 아직 없습니다. '새 이야기방 만들기'로 방을 만들어 주세요.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                  {projectRooms.map((room) => (
                    <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', border: '2.5px solid #333', borderRadius: '15px', background: '#fff', boxShadow: '3px 3px 0 #333' }}>
                      <div style={{ textAlign: 'left' }}>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          fontWeight: 'bold', 
                          color: '#fff',
                          background: room.status === 'completed' ? '#4caf50' : room.status === 'writing' ? '#2196f3' : '#ff9800',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          marginRight: '10px'
                        }}>
                          {room.status === 'waiting' && '대기 중'}
                          {room.status === 'writing' && '진행 중'}
                          {room.status === 'evaluating' && '평가 대기'}
                          {room.status === 'completed' && '완료됨'}
                        </span>
                        <strong style={{ fontSize: '1.15rem' }}>{room.title} (코드: {room.id})</strong>
                        <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '5px' }}>
                          테마: {room.layoutMode} | {room.sentences?.length || 0}개 문장 작성됨
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        {room.status !== 'completed' ? (
                          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => setActiveRoomId(room.id)}>
                            {room.status === 'evaluating' ? '평가 기록' : '입장/모니터링'}
                          </button>
                        ) : (
                          <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', borderColor: '#4caf50' }} onClick={() => setViewingArchiveRoom(room)}>
                            <Eye size={16} color="#4caf50" /> 기록 조회 (아카이브)
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 상황 3: 프로젝트 폴더 목록 화면 (기본 화면) */}
      {!selectedProjectId && !activeRoomId && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h2 style={{ margin: 0 }}>📁 나의 학급/프로젝트 폴더 관리</h2>
              <p style={{ color: '#666', fontSize: '0.95rem', marginTop: '5px', textAlign: 'left' }}>
                여러 교실이나 수업을 폴더로 나누어 관리하고 릴레이 소설 기록을 관리합니다.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowNewProjectModal(true)}>
              <FolderPlus size={18} /> 새 프로젝트 폴더 만들기
            </button>
          </div>

          {/* 프로젝트 리스트 그리드 */}
          {projects.length === 0 ? (
            <div className="card" style={{ padding: '80px 10px', textAlign: 'center', color: '#999' }}>
              <Folder size={48} style={{ color: '#bbb', marginBottom: '15px' }} />
              <h2>만들어진 폴더가 아직 없습니다.</h2>
              <p>우측 상단의 '새 프로젝트 폴더 만들기' 버튼을 눌러 수업 폴더를 먼저 생성해 주세요.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {projects.map((proj) => (
                <div key={proj.id} className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '180px', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }} onClick={() => setSelectedProjectId(proj.id)}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <Folder size={36} color="#ffe082" fill="#ffe082" style={{ stroke: '#333', strokeWidth: '2.5px' }} />
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 8px', boxShadow: 'none', border: 'none', background: 'none' }}
                        onClick={(e) => {
                          e.stopPropagation(); // 카드 이동 막기
                          handleDeleteProject(proj.id, proj.name);
                        }}
                      >
                        <Trash2 size={18} color="red" />
                      </button>
                    </div>
                    <h3 style={{ margin: '0 0 5px 0' }}>{proj.name}</h3>
                    {proj.description && <p style={{ color: '#666', fontSize: '0.85rem', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{proj.description}</p>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '15px', borderTop: '1px dashed #eee', paddingTop: '10px' }}>
                    생성일: {new Date(proj.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 모달 1: 새 프로젝트 폴더 만들기 모달 */}
      {showNewProjectModal && (
        <div className="modal-overlay" onClick={() => setShowNewProjectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <button className="close-modal-btn" onClick={() => setShowNewProjectModal(false)}>×</button>
            <h2>📁 새 학급/수업 폴더 생성</h2>
            <form onSubmit={handleCreateProjectSubmit} style={{ textAlign: 'left', marginTop: '20px' }}>
              <div className="input-group">
                <label className="input-label">폴더명 (학급/프로젝트명)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="예: 4학년 2반 국어"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">폴더 설명 (간단히)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="예: 2026학년도 1학기 이야기 릴레이"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                폴더 생성하기 📂
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 모달 2: 아카이브 이야기방 조회 모달 */}
      {viewingArchiveRoom && (
        <div className="modal-overlay" onClick={() => setViewingArchiveRoom(null)}>
          <div className="modal-content modal-terms-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button className="close-modal-btn" onClick={() => setViewingArchiveRoom(null)}>×</button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
              <CheckCircle2 color="#4caf50" size={24} />
              <h2>완성작 아카이브: "{viewingArchiveRoom.title}"</h2>
            </div>
            
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '15px' }}>
              방 코드: {viewingArchiveRoom.id} | 완성일시: {new Date(viewingArchiveRoom.createdAt).toLocaleString()}
            </p>

            <div className="note-container" style={{ maxHeight: '250px', fontSize: '1.2rem', marginBottom: '20px' }}>
              {viewingArchiveRoom.sentences && viewingArchiveRoom.sentences.length > 0
                ? viewingArchiveRoom.sentences.map(s => s.text).join(' ')
                : '기록된 글이 없습니다.'}
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {/* 참여 작가 */}
              <div style={{ flex: '1', minWidth: '220px', background: '#f5f5f5', padding: '15px', borderRadius: '12px', border: '1px solid #ddd' }}>
                <h3 style={{ fontSize: '1rem', margin: '0 0 10px 0' }}>✏️ 참여 학생 작가</h3>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {viewingArchiveRoom.studentOrder?.map((name, i) => (
                    <span key={name} style={{ background: '#fff', border: '1px solid #ccc', padding: '3px 8px', borderRadius: '15px', fontSize: '0.85rem' }}>
                      {i + 1}. {name}
                    </span>
                  ))}
                </div>
              </div>

              {/* 교사 평가 피드백 */}
              {viewingArchiveRoom.teacherEvaluation && (
                <div style={{ flex: '1.5', minWidth: '280px', background: '#fff9c4', padding: '15px', borderRadius: '12px', border: '1px solid #fbc02d' }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 10px 0' }}>👨‍🏫 선생님 평가 피드백</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', fontSize: '0.85rem' }}>
                    {viewingArchiveRoom.rubrics.map(rub => (
                      <div key={rub.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>⭐ {rub.name}</span>
                        <strong>{viewingArchiveRoom.teacherEvaluation?.scores[rub.id]} / 5 점</strong>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontStyle: 'italic', fontSize: '0.9rem', color: '#555', borderTop: '1px dashed #d7ccc8', paddingTop: '8px' }}>
                    "{viewingArchiveRoom.teacherEvaluation.comment || '의견 없음'}"
                  </p>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: '25px' }}>
              <button className="btn btn-secondary" onClick={() => setViewingArchiveRoom(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
