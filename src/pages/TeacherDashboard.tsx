import React, { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';
import { TeacherAuth } from './TeacherAuth';
import type { LayoutMode, Rubric, Room } from '../types/game';
import { 
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
  Eye,
  Download,
  Copy
} from 'lucide-react';

const getWriteUnitLabel = (unit: 'sentence' | 'paragraph' = 'sentence') =>
  unit === 'paragraph' ? '문단' : '문장';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const TeacherDashboard: React.FC = () => {
  
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
    removeStudent,
    projects,
    projectRooms,
    loadProjects,
    createProject,
    deleteProject,
    loadRoomsByProject,
    updateStudentOrder,
    updateProjectRoomsConfig,
    subscribeRoomsByProject
  } = useGameStore();

  // Navigation / Selection State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Modals & Creation UI State
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [showCreateRoomForm, setShowCreateRoomForm] = useState(false);
  const [showEditRoomForm, setShowEditRoomForm] = useState(false);

  // 방 생성 및 수정 Form State
  const [groupCount, setGroupCount] = useState(4);
  const [maxStudents, setMaxStudents] = useState(4);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('chat');
  const [endCondition, setEndCondition] = useState<'limit' | 'free'>('limit');
  const [sentenceLimit, setSentenceLimit] = useState(10);
  const [turnMode, setTurnMode] = useState<'random' | 'sequence' | 'free'>('random');
  const [writeUnit, setWriteUnit] = useState<'sentence' | 'paragraph'>('sentence');
  const [rubrics, setRubrics] = useState<Rubric[]>([
    { id: 'r1', name: '창의성 (재미있는 상상력)', maxScore: 5 },
    { id: 'r2', name: '협동성 (앞 문장과 이어지는 내용)', maxScore: 5 },
    { id: 'r3', name: '올바른 언어 (맞춤법과 바른말)', maxScore: 5 },
  ]);
  const [newRubricName, setNewRubricName] = useState('');

  // 교사 평가 Form State
  const [evalScores, setEvalScores] = useState<{ [rubricId: string]: number }>({});
  const defaultEvalScores = useMemo(() => {
    const initialScores: { [key: string]: number } = {};
    currentRoom?.rubrics.forEach(r => {
      initialScores[r.id] = 5;
    });
    return initialScores;
  }, [currentRoom?.rubrics]);
  const effectiveEvalScores = Object.keys(evalScores).length > 0 ? evalScores : defaultEvalScores;
  const [evalComment, setEvalComment] = useState('');

  // 아카이브 뷰어 상태
  const [viewingArchiveRoom, setViewingArchiveRoom] = useState<Room | null>(null);

  // 로컬 방별 아코디언 펼침 상태
  const [expandedStoryRoomIds, setExpandedStoryRoomIds] = useState<{ [roomId: string]: boolean }>({});
  const [expandedWarningRoomIds, setExpandedWarningRoomIds] = useState<{ [roomId: string]: boolean }>({});

  // 1. Auth 세션 감지
  useEffect(() => {
    const unsubscribe = initializeAuth();
    return () => unsubscribe();
  }, [initializeAuth]);

  // 2. 로그인 시 프로젝트 로드
  useEffect(() => {
    if (user) {
      loadProjects(user.uid);
    }
  }, [user, loadProjects]);

  // 3. 프로젝트 선택 시 해당 프로젝트의 방 목록 실시간 구독
  useEffect(() => {
    if (user && selectedProjectId) {
      const unsubscribe = subscribeRoomsByProject(user.uid, selectedProjectId);
      return () => unsubscribe();
    }
  }, [user, selectedProjectId, subscribeRoomsByProject]);

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
  }, [activeRoomId, subscribeRoom, unsubscribeRoom]);

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
    if (!user || !selectedProjectId) return;

    try {
      // 모둠 개수만큼 루프를 돌며 일괄 생성
      for (let i = 1; i <= groupCount; i++) {
        await createRoom({
          title: `${i}모둠`,
          maxStudents,
          layoutMode,
          endCondition,
          sentenceLimit,
          rubrics,
          teacherId: user.uid,
          projectId: selectedProjectId,
          turnMode: turnMode || 'random',
          writeUnit,
        });
      }
      setShowCreateRoomForm(false);
      // 룸 리스트 새로고침
      await loadRoomsByProject(user.uid, selectedProjectId);
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

    await submitTeacherEvaluation(activeRoomId, effectiveEvalScores, evalComment);
    await completeRoom(activeRoomId);
    alert('모둠 평가가 완료되었습니다!');
  };

  // 모든 모둠 설정 일괄 업데이트
  const handleUpdateRoomsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProjectId) return;

    try {
      await updateProjectRoomsConfig(user.uid, selectedProjectId, {
        maxStudents,
        layoutMode,
        endCondition,
        sentenceLimit,
        rubrics,
        turnMode,
        writeUnit
      });
      setShowEditRoomForm(false);
      alert('이야기방 설정이 성공적으로 일괄 수정되었습니다! ⚙️');
    } catch (err: unknown) {
      alert(getErrorMessage(err, '설정 수정에 실패했습니다.'));
    }
  };

  // 학생 순서 바꾸기 (지정 순서 모드 시)
  const moveStudentOrder = async (index: number, direction: 'up' | 'down') => {
    if (!activeRoomId || !currentRoom) return;
    const order = [...(currentRoom.studentOrder || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= order.length) return;

    const temp = order[index];
    order[index] = order[targetIdx];
    order[targetIdx] = temp;

    await updateStudentOrder(activeRoomId, order);
  };

  const handleRemoveStudent = async (nickname: string) => {
    if (!activeRoomId) return;
    if (confirm(`⚠️ ${nickname} 학생을 이 이야기방에서 내보내시겠습니까?`)) {
      await removeStudent(activeRoomId, nickname);
      alert(`${nickname} 학생을 내보냈습니다.`);
    }
  };

  const getRoomStoryText = (room: Room) => {
    if (!room.sentences || room.sentences.length === 0) return '';
    return room.writeUnit === 'paragraph'
      ? room.sentences.map((sentence) => sentence.text).join('\n\n')
      : room.sentences.map((sentence) => sentence.text).join(' ');
  };

  const copyRoomStory = async (room: Room) => {
    const storyText = getRoomStoryText(room);
    if (!storyText) return;

    await navigator.clipboard.writeText(storyText);
    alert(`${room.title} 완성글이 복사되었습니다.`);
  };

  const downloadRoomActivityImage = (room: Room) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    const width = 1400;
    const padding = 70;
    const contentWidth = width - padding * 2;
    const lineHeight = 34;

    const wrapText = (text: string, maxWidth: number, font: string) => {
      context.font = font;
      const lines: string[] = [];
      let currentLine = '';

      for (const char of text) {
        const nextLine = currentLine + char;
        if (context.measureText(nextLine).width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = nextLine;
        }
      }

      if (currentLine) lines.push(currentLine);
      return lines;
    };

    const drawLines = (
      lines: string[],
      x: number,
      y: number,
      font: string,
      color = '#333',
      height = lineHeight
    ) => {
      context.font = font;
      context.fillStyle = color;
      lines.forEach((line, index) => {
        context.fillText(line, x, y + index * height);
      });
      return y + Math.max(lines.length, 1) * height;
    };

    const render = (height: number) => {
      canvas.width = width;
      canvas.height = height;

      context.fillStyle = '#fffdf0';
      context.fillRect(0, 0, width, height);

      context.strokeStyle = '#333';
      context.lineWidth = 8;
      context.strokeRect(18, 18, width - 36, height - 36);

      let y = 90;

      context.fillStyle = '#ffd966';
      context.beginPath();
      context.arc(padding + 28, y - 16, 26, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#333';
      context.lineWidth = 5;
      context.stroke();

      context.font = 'bold 42px Arial, sans-serif';
      context.fillStyle = '#222';
      context.fillText(room.title || '이야기 릴레이 활동', padding + 75, y);
      y += 60;

      context.font = '24px Arial, sans-serif';
      context.fillStyle = '#555';
      context.fillText(`방 코드: ${room.id}  |  상태: ${room.status}  |  저장일: ${new Date().toLocaleString()}`, padding, y);
      y += 58;

      const students = Object.keys(room.students || {});
      const settings = [
        `참여 학생: ${students.length > 0 ? students.join(', ') : '없음'}`,
        `작성 방식: ${getWriteUnitLabel(room.writeUnit)} / 순서: ${room.turnMode || 'random'} / 목표: ${room.endCondition === 'limit' ? `${room.sentenceLimit}${getWriteUnitLabel(room.writeUnit)}` : '자유'}`
      ];
      settings.forEach((text) => {
        y = drawLines(wrapText(text, contentWidth, '24px Arial, sans-serif'), padding, y, '24px Arial, sans-serif', '#333', 34);
      });
      y += 34;

      context.font = 'bold 30px Arial, sans-serif';
      context.fillStyle = '#111';
      context.fillText('작성 본문', padding, y);
      y += 44;

      if (room.sentences.length > 0) {
        room.sentences.forEach((sentence, index) => {
          const prefix = `${index + 1}. ${sentence.writer}: `;
          const lines = wrapText(`${prefix}${sentence.text}`, contentWidth, '24px Arial, sans-serif');
          y = drawLines(lines, padding, y, '24px Arial, sans-serif', '#222', 34) + 12;
        });
      } else {
        y = drawLines(['작성된 문장이 없습니다.'], padding, y, '24px Arial, sans-serif', '#777', 34) + 12;
      }

      y += 22;
      context.font = 'bold 30px Arial, sans-serif';
      context.fillStyle = '#111';
      context.fillText('경고 기록', padding, y);
      y += 44;

      if (room.warningLogs && room.warningLogs.length > 0) {
        room.warningLogs.forEach((log, index) => {
          const lines = wrapText(`${index + 1}. ${log.nickname}: "${log.text}" - ${log.reason}`, contentWidth, '23px Arial, sans-serif');
          y = drawLines(lines, padding, y, '23px Arial, sans-serif', '#c62828', 32) + 10;
        });
      } else {
        y = drawLines(['경고 기록 없음'], padding, y, '24px Arial, sans-serif', '#4caf50', 34) + 12;
      }

      if (room.teacherEvaluation) {
        y += 22;
        context.font = 'bold 30px Arial, sans-serif';
        context.fillStyle = '#111';
        context.fillText('교사 평가', padding, y);
        y += 44;

        room.rubrics.forEach((rubric) => {
          const score = room.teacherEvaluation?.scores[rubric.id] ?? '-';
          y = drawLines([`${rubric.name}: ${score} / 5`], padding, y, '24px Arial, sans-serif', '#333', 34);
        });

        if (room.teacherEvaluation.comment) {
          y += 8;
          y = drawLines(wrapText(`종합 의견: ${room.teacherEvaluation.comment}`, contentWidth, '24px Arial, sans-serif'), padding, y, '24px Arial, sans-serif', '#333', 34);
        }
      }

      return y + 70;
    };

    const finalHeight = Math.max(render(2600), 900);
    render(finalHeight);

    const link = document.createElement('a');
    link.download = `${room.title || room.id}-활동내용.png`.replace(/[\\/:*?"<>|]/g, '_');
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // AI 모둠 활동 분석 결과 모달은 API 재활성화 시 다시 사용합니다.
  const [aiReport, setAiReport] = useState<string | null>(null);

  // 마크다운 파서 및 렌더러
  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    return lines.map((line, idx) => {
      if (line.trim().startsWith('###')) {
        return <h3 key={idx} style={{ margin: '15px 0 8px 0', fontSize: '1.25rem', color: '#111', borderBottom: '1.5px solid #eee', paddingBottom: '4px' }}>{line.replace(/^###\s*/, '')}</h3>;
      }
      if (line.trim().startsWith('####')) {
        return <h4 key={idx} style={{ margin: '12px 0 6px 0', fontSize: '1.1rem', color: '#444' }}>{line.replace(/^####\s*/, '')}</h4>;
      }
      if (line.trim().startsWith('##')) {
        return <h2 key={idx} style={{ margin: '20px 0 10px 0', fontSize: '1.5rem', color: '#000', borderBottom: '2px solid #333', paddingBottom: '6px' }}>{line.replace(/^##\s*/, '')}</h2>;
      }
      if (line.trim().startsWith('>')) {
        return (
          <blockquote key={idx} style={{ borderLeft: '4px solid #b39ddb', margin: '10px 0', paddingLeft: '15px', color: '#555', fontStyle: 'italic', background: '#f3e5f5', padding: '10px 14px', borderRadius: '8px' }}>
            {line.replace(/^>\s*/, '')}
          </blockquote>
        );
      }
      if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        const text = line.replace(/^[-*]\s*/, '');
        return <li key={idx} style={{ marginLeft: '20px', marginBottom: '6px', fontSize: '1.05rem', textAlign: 'left' }}>{parseInlineMarkdown(text)}</li>;
      }
      if (!line.trim()) {
        return <div key={idx} style={{ height: '8px' }} />;
      }
      return <p key={idx} style={{ margin: '6px 0', fontSize: '1.05rem', textAlign: 'left' }}>{parseInlineMarkdown(line)}</p>;
    });
  };

  const parseInlineMarkdown = (text: string) => {
    const parts = text.split(/\*\*([\s\S]+?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} style={{ color: '#673ab7' }}>{part}</strong>;
      }
      return part;
    });
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

  const studentWarningCounts: { [nickname: string]: number } = {};
  if (currentRoom?.warningLogs) {
    currentRoom.warningLogs.forEach((log) => {
      studentWarningCounts[log.nickname] = (studentWarningCounts[log.nickname] || 0) + 1;
    });
  }

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
                종료 조건: {currentRoom.endCondition === 'limit' ? `${currentRoom.sentenceLimit}${getWriteUnitLabel(currentRoom.writeUnit)}` : '자유 글쓰기'}
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
                  {currentRoom.turnMode === 'sequence' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      {joinedStudents.map((st, idx) => (
                        <div key={st.nickname} className="student-tag" style={{ justifyContent: 'space-between', padding: '10px 16px', display: 'flex', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontStyle: 'italic', color: '#999', fontSize: '0.85rem' }}>{idx + 1}.</span>
                            <span className={st.isOnline ? 'student-online-dot' : 'student-offline-dot'} />
                            <strong>{st.nickname}</strong>
                            {studentWarningCounts[st.nickname] > 0 && (
                              <span style={{ 
                                fontSize: '0.75rem', 
                                fontWeight: 'bold', 
                                color: '#fff', 
                                background: '#e53935', 
                                padding: '1px 5px', 
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}>
                                ⚠️ 경고 {studentWarningCounts[st.nickname]}회
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                              type="button" 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '0.8rem', boxShadow: 'none', border: '1.5px solid #333' }}
                              disabled={idx === 0}
                              onClick={() => moveStudentOrder(idx, 'up')}
                            >
                              ▲
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '0.8rem', boxShadow: 'none', border: '1.5px solid #333' }}
                              disabled={idx === joinedStudents.length - 1}
                              onClick={() => moveStudentOrder(idx, 'down')}
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.8rem', boxShadow: 'none', border: '1.5px solid #ef9a9a', background: '#ffebee', color: '#c62828' }}
                              onClick={() => handleRemoveStudent(st.nickname)}
                            >
                              내보내기
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="student-grid" style={{ marginBottom: '20px' }}>
                      {joinedStudents.map((st) => (
                        <div key={st.nickname} className="student-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span className={st.isOnline ? 'student-online-dot' : 'student-offline-dot'} />
                          <strong>{st.nickname}</strong>
                          {studentWarningCounts[st.nickname] > 0 && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 'bold', 
                              color: '#fff', 
                              background: '#e53935', 
                              padding: '1px 5px', 
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}>
                              ⚠️ {studentWarningCounts[st.nickname]}회
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '2px 7px', fontSize: '0.75rem', boxShadow: 'none', border: '1.5px solid #ef9a9a', background: '#ffebee', color: '#c62828' }}
                            onClick={() => handleRemoveStudent(st.nickname)}
                          >
                            내보내기
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI 활동 분석 버튼 배치 */}
                  <button 
                    className="btn btn-primary btn-disabled"
                    style={{ width: '100%', justifyContent: 'center', background: '#9e9e9e', marginTop: '10px' }}
                    disabled
                    title="Gemini API 연결 후 다시 활성화할 예정입니다."
                  >
                    🤖 AI 모둠 활동 분석 (추후 업데이트)
                  </button>
                </div>
              )}

              {currentRoom.status === 'writing' && currentRoom.turnMode !== 'free' && (
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

              {currentRoom.status === 'writing' && currentRoom.turnMode === 'free' && (
                <div style={{ borderTop: '2px dashed #ddd', paddingTop: '20px', marginTop: '20px', textAlign: 'left' }}>
                  <h3>💡 자유 글쓰기 진행 중</h3>
                  <p style={{ color: '#666', fontSize: '0.85rem' }}>
                    순서 제약이 없어 모든 학생들이 동시에 내용을 이어 쓸 수 있습니다.
                  </p>
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
                  <div
                    className="note-container"
                    role={currentRoom.sentences.length > 0 ? 'button' : undefined}
                    tabIndex={currentRoom.sentences.length > 0 ? 0 : undefined}
                    title={currentRoom.sentences.length > 0 ? '클릭하면 작성된 글이 복사됩니다.' : undefined}
                    style={{ cursor: currentRoom.sentences.length > 0 ? 'copy' : 'default' }}
                    onClick={() => copyRoomStory(currentRoom)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && currentRoom.sentences.length > 0) {
                        e.preventDefault();
                        copyRoomStory(currentRoom);
                      }
                    }}
                  >
                    {currentRoom.sentences && currentRoom.sentences.length > 0 ? (
                      currentRoom.writeUnit === 'paragraph' ? (
                        currentRoom.sentences.map((sent) => (
                          <p key={sent.id} style={{ margin: '0 0 10px 0', textIndent: '10px', fontSize: '1.05rem', lineHeight: '1.6' }}>
                            {sent.text}
                          </p>
                        ))
                      ) : (
                        currentRoom.sentences.map((sent) => (
                          <span key={sent.id} className="note-sentence" style={{ fontSize: '1.05rem', lineHeight: '1.6', marginRight: '6px' }}>
                            {sent.text}
                          </span>
                        ))
                      )
                    ) : (
                      <span style={{ color: '#999' }}>첫 글 작성 대기 중...</span>
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

                  <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`btn btn-secondary ${(!currentRoom.sentences || currentRoom.sentences.length === 0) ? 'btn-disabled' : ''}`}
                      style={{ flex: '1 1 180px', justifyContent: 'center', background: '#e8f5e9', borderColor: '#81c784', color: '#2e7d32' }}
                      disabled={!currentRoom.sentences || currentRoom.sentences.length === 0}
                      onClick={() => downloadRoomActivityImage(currentRoom)}
                    >
                      <Download size={18} /> 활동 이미지 저장
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ flex: '1 1 180px', justifyContent: 'center', background: '#fff3e0', borderColor: '#ffb74d', color: '#e65100' }}
                      onClick={async () => {
                        if (confirm("⚠️ 정말로 작성된 모든 문장과 평가, 경고 내역을 비우고 처음부터 다시 시작하시겠습니까?")) {
                          await useGameStore.getState().resetActivity(currentRoom.id);
                          alert('글쓰기 활동이 초기화되었습니다.');
                        }
                      }}
                    >
                      🔄 글쓰기 활동 초기화
                    </button>
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
                            className={(effectiveEvalScores[rubric.id] || 0) >= num ? 'active' : ''}
                            onClick={() => setEvalScores({ ...effectiveEvalScores, [rubric.id]: num })}
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
            {/* 새 이야기방 개설 버튼 토글 또는 수정 버튼 토글 */}
            <div className="card">
              {projectRooms.length === 0 ? (
                <div>
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
                        <label className="input-label">생성할 모둠 개수</label>
                        <select
                          className="select-field"
                          value={groupCount}
                          onChange={(e) => setGroupCount(parseInt(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <option key={num} value={num}>{num}개 모둠 일괄 생성</option>
                          ))}
                        </select>
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

                        <div className="input-group" style={{ flex: '1', minWidth: '150px' }}>
                          <label className="input-label">글쓰기 진행 순서</label>
                          <select
                            className="select-field"
                            value={turnMode}
                            onChange={(e) => setTurnMode(e.target.value as 'random' | 'sequence' | 'free')}
                          >
                            <option value="random">🎲 랜덤 순서 (시작 시 자동 섞임)</option>
                            <option value="sequence">📋 지정/입장 순서 (교사 지정 가능)</option>
                            <option value="free">자유롭게 쓰기 (순서 제약 없음)</option>
                          </select>
                        </div>

                        <div className="input-group" style={{ flex: '1', minWidth: '150px' }}>
                          <label className="input-label">글쓰기 작성 단위</label>
                          <select
                            className="select-field"
                            value={writeUnit}
                            onChange={(e) => setWriteUnit(e.target.value as 'sentence' | 'paragraph')}
                          >
                            <option value="sentence">🔤 문장 단위로 작성 (최대 100자)</option>
                            <option value="paragraph">📄 문단 단위로 작성 (최대 500자)</option>
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
                            <option value="limit">📏 설정된 목표 {getWriteUnitLabel(writeUnit)} 수 도달 시 종료</option>
                            <option value="free">🔓 자유로운 글쓰기 (직접 완료 클릭)</option>
                          </select>
                        </div>

                        {endCondition === 'limit' && (
                          <div className="input-group" style={{ flex: '1', minWidth: '150px' }}>
                            <label className="input-label">목표 {getWriteUnitLabel(writeUnit)} 수</label>
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
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div style={{ textAlign: 'left' }}>
                      <h3 style={{ margin: 0 }}>이 프로젝트 아래의 이야기방 관리</h3>
                      <p style={{ color: '#4caf50', fontSize: '0.95rem', fontWeight: 'bold', marginTop: '5px' }}>
                        이미 활동방이 개설되어 운영 중입니다. 한 프로젝트에는 이야기방을 한 번만 개설하여 진행합니다.
                      </p>
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      style={{ borderColor: '#673ab7', color: '#673ab7' }}
                      onClick={() => {
                        const firstRoom = projectRooms[0];
                        if (firstRoom) {
                          setMaxStudents(firstRoom.maxStudents);
                          setLayoutMode(firstRoom.layoutMode);
                          setEndCondition(firstRoom.endCondition);
                          setSentenceLimit(firstRoom.sentenceLimit || 10);
                          setRubrics(firstRoom.rubrics || []);
                          setTurnMode(firstRoom.turnMode || 'random');
                          setWriteUnit(firstRoom.writeUnit || 'sentence');
                        }
                        setShowEditRoomForm(!showEditRoomForm);
                      }}
                    >
                      {showEditRoomForm ? '설정 수정 닫기' : '⚙️ 활동 설정 수정'}
                    </button>
                  </div>

                  {/* 방 설정 수정 폼 */}
                  {showEditRoomForm && (
                    <form onSubmit={handleUpdateRoomsConfig} style={{ borderTop: '2px dashed #ddd', marginTop: '20px', paddingTop: '20px', textAlign: 'left' }}>
                      <h3 style={{ color: '#673ab7', marginBottom: '15px' }}>⚙️ 이야기방 설정 수정 (모든 모둠에 일괄 적용)</h3>
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

                        <div className="input-group" style={{ flex: '1', minWidth: '150px' }}>
                          <label className="input-label">글쓰기 진행 순서</label>
                          <select
                            className="select-field"
                            value={turnMode}
                            onChange={(e) => setTurnMode(e.target.value as 'random' | 'sequence' | 'free')}
                          >
                            <option value="random">🎲 랜덤 순서 (시작 시 자동 섞임)</option>
                            <option value="sequence">📋 지정/입장 순서 (교사 지정 가능)</option>
                            <option value="free">자유롭게 쓰기 (순서 제약 없음)</option>
                          </select>
                        </div>

                        <div className="input-group" style={{ flex: '1', minWidth: '150px' }}>
                          <label className="input-label">글쓰기 작성 단위</label>
                          <select
                            className="select-field"
                            value={writeUnit}
                            onChange={(e) => setWriteUnit(e.target.value as 'sentence' | 'paragraph')}
                          >
                            <option value="sentence">🔤 문장 단위로 작성 (최대 100자)</option>
                            <option value="paragraph">📄 문단 단위로 작성 (최대 500자)</option>
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
                            <option value="limit">📏 설정된 목표 {getWriteUnitLabel(writeUnit)} 수 도달 시 종료</option>
                            <option value="free">🔓 자유로운 글쓰기 (직접 완료 클릭)</option>
                          </select>
                        </div>

                        {endCondition === 'limit' && (
                          <div className="input-group" style={{ flex: '1', minWidth: '150px' }}>
                            <label className="input-label">목표 {getWriteUnitLabel(writeUnit)} 수</label>
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

                      <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '20px', background: '#673ab7' }}>
                        설정 수정 저장하기 💾
                      </button>
                    </form>
                  )}
                </div>
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
                  {projectRooms.map((room) => {
                    const joinedCount = Object.keys(room.students || {}).length;
                    const onlineCount = Object.values(room.students || {}).filter(s => s.isOnline).length;
                    const warningCount = room.warningLogs?.length || 0;
                    const hasSentences = room.sentences && room.sentences.length > 0;
                    const students = room.students ? Object.values(room.students) : [];

                    return (
                      <div key={room.id} style={{ display: 'flex', flexDirection: 'column', padding: '20px', border: '2.5px solid #333', borderRadius: '15px', background: '#fff', boxShadow: '4px 4px 0 #333', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                          <div style={{ textAlign: 'left', flex: '1', minWidth: '280px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                              <span style={{ 
                                fontSize: '0.8rem', 
                                fontWeight: 'bold', 
                                color: '#fff',
                                background: room.status === 'completed' ? '#4caf50' : room.status === 'writing' ? '#2196f3' : room.status === 'evaluating' ? '#9c27b0' : '#ff9800',
                                padding: '3px 8px',
                                borderRadius: '10px'
                              }}>
                                {room.status === 'waiting' && '대기 중'}
                                {room.status === 'writing' && '진행 중'}
                                {room.status === 'evaluating' && '평가 대기'}
                                {room.status === 'completed' && '완료됨'}
                              </span>
                              
                              <span style={{ 
                                fontSize: '0.8rem', 
                                fontWeight: 'bold', 
                                color: '#333',
                                border: '1.5px solid #333',
                                background: '#e0f2f1',
                                padding: '2px 8px',
                                borderRadius: '10px'
                              }}>
                                👥 참여: {joinedCount}/{room.maxStudents}명 (접속: {onlineCount}명)
                              </span>

                              {warningCount > 0 && (
                                <span style={{ 
                                  fontSize: '0.8rem', 
                                  fontWeight: 'bold', 
                                  color: '#fff',
                                  background: '#e53935',
                                  padding: '3px 8px',
                                  borderRadius: '10px'
                                }}>
                                  ⚠️ 경고: {warningCount}회
                                </span>
                              )}
                            </div>
                            
                            <strong style={{ fontSize: '1.25rem' }}>{room.title} (코드: {room.id})</strong>
                            
                            <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '5px' }}>
                              테마: {room.layoutMode === 'chat' ? '💬 채팅' : room.layoutMode === 'note' ? '📝 줄글' : '📖 동화책'} |{' '}
                              순서: {room.turnMode === 'free' ? '자유' : room.turnMode === 'sequence' ? '지정' : '랜덤'} |{' '}
                              {room.sentences?.length || 0}개 {getWriteUnitLabel(room.writeUnit)} 작성됨
                            </div>

                            {/* 참여 학생 이름 목록 실시간 표시 */}
                            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>참여 학생:</span>
                              {students.length > 0 ? (
                                students.map((st) => (
                                  <span 
                                    key={st.nickname} 
                                    style={{ 
                                      fontSize: '0.8rem', 
                                      padding: '2px 8px', 
                                      borderRadius: '6px', 
                                      border: '1.5px solid #333',
                                      background: st.isOnline ? '#e8f5e9' : '#f5f5f5',
                                      color: st.isOnline ? '#2e7d32' : '#9e9e9e',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontWeight: '500'
                                    }}
                                  >
                                    <span style={{ 
                                      width: '6px', 
                                      height: '6px', 
                                      borderRadius: '50%', 
                                      background: st.isOnline ? '#4caf50' : '#bdbdbd',
                                      display: 'inline-block'
                                    }} />
                                    {st.nickname}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>대기 중인 학생 없음</span>
                              )}
                            </div>
                            
                            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <code style={{ fontSize: '0.85rem', background: '#eee', padding: '4px 8px', borderRadius: '5px' }}>
                                {window.location.origin}/join?code={room.id}
                              </code>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.8rem', boxShadow: 'none' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(`${window.location.origin}/join?code=${room.id}`);
                                  alert(`${room.title} 접속 링크가 복사되었습니다!`);
                                }}
                              >
                                링크 복사
                              </button>
                              
                              <button
                                type="button"
                                className={`btn btn-secondary ${!hasSentences ? 'btn-disabled' : ''}`}
                                style={{ padding: '4px 8px', fontSize: '0.8rem', boxShadow: 'none' }}
                                disabled={!hasSentences}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedStoryRoomIds(prev => ({ ...prev, [room.id]: !prev[room.id] }));
                                }}
                              >
                                {expandedStoryRoomIds[room.id] ? '📖 완성글 접기 ▲' : '📖 완성글 보기 ▼'}
                              </button>

                              {warningCount > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.8rem', boxShadow: 'none', background: '#ffebee', color: '#c62828', borderColor: '#ef9a9a' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedWarningRoomIds(prev => ({ ...prev, [room.id]: !prev[room.id] }));
                                  }}
                                >
                                  {expandedWarningRoomIds[room.id] ? '⚠️ 경고 접기 ▲' : '⚠️ 경고 기록 보기 ▼'}
                                </button>
                              )}

                              <button
                                type="button"
                                className={`btn btn-secondary ${!hasSentences ? 'btn-disabled' : ''}`}
                                style={{ padding: '4px 8px', fontSize: '0.8rem', boxShadow: 'none', background: '#e8f5e9', color: '#2e7d32', borderColor: '#81c784' }}
                                disabled={!hasSentences}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadRoomActivityImage(room);
                                }}
                              >
                                <Download size={14} /> 활동 이미지 저장
                              </button>

                              {joinedCount > 0 && room.status !== 'completed' && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.8rem', boxShadow: 'none', background: '#ffebee', color: '#c62828', borderColor: '#ef9a9a' }}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(`⚠️ 정말로 [${room.title}]의 모든 참여 학생 목록을 비우고 대기 상태로 초기화하시겠습니까?`)) {
                                      await useGameStore.getState().resetStudents(room.id);
                                      alert('학생 목록이 초기화되었습니다.');
                                    }
                                  }}
                                >
                                  🔄 학생 초기화
                                </button>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {room.status === 'waiting' && (
                              <button
                                className="btn btn-primary"
                                style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#4caf50' }}
                                onClick={() => startRoom(room.id)}
                              >
                                시작
                              </button>
                            )}
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

                        {/* 완성글 아코디언 */}
                        {expandedStoryRoomIds[room.id] && hasSentences && (
                          <div
                            role="button"
                            tabIndex={0}
                            title="클릭하면 완성글이 복사됩니다."
                            style={{ padding: '12px 18px', background: '#fffde7', border: '2px solid #333', borderRadius: '12px', textAlign: 'left', cursor: 'copy' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              copyRoomStory(room);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                copyRoomStory(room);
                              }
                            }}
                          >
                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.95rem', color: '#555', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              ✍️ 현재 작성된 이야기 내용:
                              <Copy size={14} />
                            </p>
                            {room.writeUnit === 'paragraph' ? (
                              room.sentences.map((s) => (
                                <p key={s.id} style={{ margin: '0 0 10px 0', textIndent: '10px', fontSize: '1.05rem', lineHeight: '1.6' }}>
                                  {s.text}
                                </p>
                              ))
                            ) : (
                              <div style={{ fontSize: '1.05rem', lineHeight: '1.6' }}>
                                {room.sentences.map((s) => (
                                  <span key={s.id} style={{ marginRight: '6px' }}>
                                    {s.text}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 경고 기록 아코디언 */}
                        {expandedWarningRoomIds[room.id] && room.warningLogs && room.warningLogs.length > 0 && (
                          <div style={{ padding: '12px 18px', background: '#ffebee', border: '2px solid #ef9a9a', borderRadius: '12px', textAlign: 'left' }}>
                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.95rem', color: '#c62828', marginBottom: '8px' }}>⚠️ 비속어 / 도배 차단 경고 내역:</p>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: '#333' }}>
                              {room.warningLogs.map((log) => (
                                <li key={log.id} style={{ marginBottom: '4px' }}>
                                  [학생: <strong>{log.nickname}</strong>] 차단된 텍스트: <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>"{log.text}"</span> ({log.reason})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
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

            <div
              className="note-container"
              role={viewingArchiveRoom.sentences.length > 0 ? 'button' : undefined}
              tabIndex={viewingArchiveRoom.sentences.length > 0 ? 0 : undefined}
              title={viewingArchiveRoom.sentences.length > 0 ? '클릭하면 완성글이 복사됩니다.' : undefined}
              style={{ maxHeight: '250px', fontSize: '1.2rem', marginBottom: '20px', cursor: viewingArchiveRoom.sentences.length > 0 ? 'copy' : 'default' }}
              onClick={() => copyRoomStory(viewingArchiveRoom)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && viewingArchiveRoom.sentences.length > 0) {
                  e.preventDefault();
                  copyRoomStory(viewingArchiveRoom);
                }
              }}
            >
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

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '25px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => downloadRoomActivityImage(viewingArchiveRoom)}>
                <Download size={18} /> 활동 이미지 저장
              </button>
              <button className="btn btn-secondary" onClick={() => setViewingArchiveRoom(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* AI 분석 결과 보고서 모달 */}
      {aiReport && (
        <div className="modal-overlay" onClick={() => setAiReport(null)}>
          <div className="modal-content modal-terms-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <button className="close-modal-btn" onClick={() => setAiReport(null)}>×</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <span style={{ fontSize: '2rem' }}>🤖</span>
              <h2>AI 모둠 활동 분석 보고서</h2>
            </div>

            <div style={{ 
              background: '#f9f9f9', 
              border: '2.5px solid #333', 
              borderRadius: '15px', 
              padding: '20px', 
              marginBottom: '20px',
              fontFamily: 'inherit',
              lineHeight: '1.6',
              boxShadow: '4px 4px 0px #333'
            }}>
              {renderMarkdown(aiReport)}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-primary" 
                style={{ background: '#4caf50' }}
                onClick={() => {
                  const commentMatch = aiReport.match(/#### 👨‍🏫 4\. 교사용 추천 종합 피드백\n([\s\S]+)$/) 
                                    || aiReport.match(/👨‍🏫 4\. 교사용 추천 종합 피드백\n([\s\S]+)$/)
                                    || aiReport.match(/종합 피드백 코멘트[\s\S]*?\n([\s\S]+)$/)
                                    || [null, aiReport];
                  let extractedText = commentMatch[1] ? commentMatch[1].trim() : aiReport;
                  extractedText = extractedText.replace(/^>\s*/gm, '').replace(/^\*\s*/gm, '').replace(/^- \s*/gm, '');
                  setEvalComment(extractedText);
                  setAiReport(null);
                  alert('👨‍🏫 AI 추천 코멘트가 하단 교사 피드백 종합 의견 란에 입력되었습니다!');
                }}
              >
                ✍️ 교사 평가 의견에 즉시 적용
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  navigator.clipboard.writeText(aiReport);
                  alert('분석 보고서 전체 내용이 클립보드에 복사되었습니다!');
                }}
              >
                📋 전체 복사
              </button>
              <button className="btn btn-secondary" onClick={() => setAiReport(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
