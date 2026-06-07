import { create } from 'zustand';
import { db, firebaseDiagnostics } from '../firebase';
import { ref, set as dbSet, update as dbUpdate, onValue, off, get as dbGet, remove as dbRemove, runTransaction } from 'firebase/database';
import type { DatabaseReference } from 'firebase/database';
import type { Room, RoomStatus, LayoutMode, Sentence, Student, Rubric, Project, WarningLog, Evaluation } from '../types/game';

interface GameState {
  currentRoom: Room | null;
  projects: Project[];
  projectRooms: Room[];
  loading: boolean;
  error: string | null;
  activeListenerRef: DatabaseReference | null;

  // Actions
  createRoom: (config: {
    title: string;
    maxStudents: number;
    layoutMode: LayoutMode;
    endCondition: 'limit' | 'free';
    sentenceLimit: number;
    rubrics: Rubric[];
    teacherId: string;
    projectId: string;
    turnMode: 'random' | 'sequence' | 'free';
    writeUnit?: 'sentence' | 'paragraph';
  }) => Promise<string>;
  
  joinRoom: (roomId: string, nickname: string) => Promise<boolean>;
  leaveRoom: (roomId: string, nickname: string) => Promise<void>;
  removeStudent: (roomId: string, nickname: string) => Promise<void>;
  startRoom: (roomId: string) => Promise<void>;
  submitSentence: (roomId: string, nickname: string, text: string) => Promise<void>;
  updateSentenceText: (roomId: string, sentenceId: string, text: string) => Promise<void>;
  deleteLastSentence: (roomId: string) => Promise<void>;
  skipTurn: (roomId: string) => Promise<void>;
  updateTypingStatus: (roomId: string, nickname: string, text: string, isTyping: boolean) => Promise<void>;
  submitEvaluation: (roomId: string, targetRoomId: string, evaluatorNickname: string, scores: { [key: string]: number }, comment?: string) => Promise<void>;
  submitTeacherEvaluation: (roomId: string, scores: { [key: string]: number }, comment?: string) => Promise<void>;
  completeRoom: (roomId: string) => Promise<void>;
  finishWriting: (roomId: string) => Promise<void>;
  
  subscribeRoom: (roomId: string) => void;
  unsubscribeRoom: (roomId: string) => void;
  setError: (error: string | null) => void;
 
  // Project Actions (Folder Management)
  loadProjects: (teacherId: string) => Promise<void>;
  createProject: (teacherId: string, name: string, description?: string) => Promise<void>;
  deleteProject: (teacherId: string, projectId: string) => Promise<void>;
  loadRoomsByProject: (teacherId: string, projectId: string) => Promise<void>;
  
  // Real-time operations
  logWarning: (roomId: string, nickname: string, text: string, reason: string) => Promise<void>;
  updateStudentOrder: (roomId: string, studentOrder: string[]) => Promise<void>;
  updateProjectRoomsConfig: (
    teacherId: string,
    projectId: string,
    config: {
      maxStudents: number;
      layoutMode: LayoutMode;
      endCondition: 'limit' | 'free';
      sentenceLimit: number;
      rubrics: Rubric[];
      turnMode: 'random' | 'sequence' | 'free';
      writeUnit?: 'sentence' | 'paragraph';
    }
  ) => Promise<void>;
  subscribeRoomsByProject: (teacherId: string, projectId: string) => (() => void);
  resetStudents: (roomId: string) => Promise<void>;
  resetActivity: (roomId: string) => Promise<void>;
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function normalizeRoom(roomData: Room): Room {
  return {
    ...roomData,
    sentences: roomData.sentences || [],
    studentOrder: roomData.studentOrder || [],
    students: roomData.students || {},
    typingStatus: roomData.typingStatus || {},
    evaluations: roomData.evaluations || {},
    warningLogs: roomData.warningLogs || [],
  };
}

function missingRoomMessage(roomId: string): string {
  return `방을 찾을 수 없습니다. 입력한 코드: ${roomId} / 연결 DB: ${firebaseDiagnostics.databaseURL} / 프로젝트: ${firebaseDiagnostics.projectId}`;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentRoom: null,
  projects: [],
  projectRooms: [],
  loading: false,
  error: null,
  activeListenerRef: null,

  setError: (error) => set({ error }),

  createRoom: async (config) => {
    set({ loading: true, error: null });
    try {
      let roomId = generateRoomId();
      let roomRef = ref(db, `rooms/${roomId}`);
      let snapshot = await dbGet(roomRef);
      
      while (snapshot.exists()) {
        roomId = generateRoomId();
        roomRef = ref(db, `rooms/${roomId}`);
        snapshot = await dbGet(roomRef);
      }

      const newRoom: Room = {
        id: roomId,
        title: config.title,
        maxStudents: config.maxStudents,
        layoutMode: config.layoutMode,
        endCondition: config.endCondition,
        sentenceLimit: config.sentenceLimit,
        status: 'waiting',
        rubrics: config.rubrics,
        createdAt: Date.now(),
        currentTurnIndex: 0,
        students: {},
        studentOrder: [],
        sentences: [],
        typingStatus: {},
        evaluations: {},
        teacherId: config.teacherId,
        projectId: config.projectId,
        turnMode: config.turnMode,
        writeUnit: config.writeUnit || 'sentence',
      };

      await dbUpdate(ref(db), {
        [`rooms/${roomId}`]: newRoom,
        [`teachers/${config.teacherId}/projects/${config.projectId}/roomIds/${roomId}`]: true,
      });

      set({ loading: false });
      return roomId;
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '방 생성에 실패했습니다.'), loading: false });
      throw err;
    }
  },

  joinRoom: async (roomId, nickname) => {
    set({ loading: true, error: null });
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      let joinError = '';

      const result = await runTransaction(roomRef, (currentData: Room | null) => {
        if (!currentData) {
          joinError = missingRoomMessage(formattedRoomId);
          return;
        }

        const roomData = normalizeRoom(currentData);
        if (roomData.status !== 'waiting') {
          joinError = '이미 글쓰기가 시작된 방입니다.';
          return;
        }

        const studentKeys = Object.keys(roomData.students);
        if (studentKeys.length >= roomData.maxStudents) {
          joinError = '정원이 가득 찬 방입니다.';
          return;
        }

        if (roomData.students[nickname]) {
          joinError = '이미 존재하는 닉네임입니다. 다른 닉네임을 사용해주세요.';
          return;
        }

        const newStudent: Student = {
          nickname,
          joinedAt: Date.now(),
          isOnline: true,
        };

        joinError = '';
        return {
          ...roomData,
          students: {
            ...roomData.students,
            [nickname]: newStudent,
          },
          studentOrder: [...roomData.studentOrder, nickname],
        };
      });

      if (!result.committed) {
        set({ error: joinError || '방 입장에 실패했습니다. 다시 시도해 주세요.', loading: false });
        return false;
      }

      set({ loading: false });
      return true;
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '방 입장에 실패했습니다.'), loading: false });
      return false;
    }
  },

  leaveRoom: async (roomId, nickname) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      const snapshot = await dbGet(roomRef);
      if (!snapshot.exists()) return;

      const roomData = snapshot.val() as Room;
      if (roomData.status === 'waiting') {
        const updatedStudents = { ...(roomData.students || {}) };
        delete updatedStudents[nickname];

        const updatedOrder = (roomData.studentOrder || []).filter(name => name !== nickname);

        await dbUpdate(roomRef, {
          students: Object.keys(updatedStudents).length > 0 ? updatedStudents : null,
          studentOrder: updatedOrder.length > 0 ? updatedOrder : null,
        });
      } else {
        if (roomData.students && roomData.students[nickname]) {
          await dbSet(ref(db, `rooms/${formattedRoomId}/students/${nickname}/isOnline`), false);
        }
      }
    } catch (err) {
      console.error('Leave room error:', err);
    }
  },

  removeStudent: async (roomId, nickname) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      const snapshot = await dbGet(roomRef);
      if (!snapshot.exists()) return;

      const room = normalizeRoom(snapshot.val() as Room);
      const updatedStudents = { ...room.students };
      const updatedTypingStatus = { ...room.typingStatus };
      const oldOrder = room.studentOrder || [];
      const removedIndex = oldOrder.indexOf(nickname);
      const updatedOrder = oldOrder.filter(name => name !== nickname);

      delete updatedStudents[nickname];
      delete updatedTypingStatus[nickname];

      let nextTurnIndex = room.currentTurnIndex || 0;
      if (updatedOrder.length === 0) {
        nextTurnIndex = 0;
      } else if (removedIndex > -1 && removedIndex < nextTurnIndex) {
        nextTurnIndex -= 1;
      } else if (nextTurnIndex >= updatedOrder.length) {
        nextTurnIndex = 0;
      }

      await dbUpdate(roomRef, {
        students: Object.keys(updatedStudents).length > 0 ? updatedStudents : null,
        studentOrder: updatedOrder.length > 0 ? updatedOrder : null,
        typingStatus: Object.keys(updatedTypingStatus).length > 0 ? updatedTypingStatus : null,
        currentTurnIndex: nextTurnIndex,
        status: updatedOrder.length === 0 && room.status === 'writing' ? 'waiting' : room.status,
      });
    } catch (err) {
      console.error('Failed to remove student:', err);
    }
  },

  startRoom: async (roomId) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      const snapshot = await dbGet(roomRef);
      if (!snapshot.exists()) return;

      const roomData = snapshot.val() as Room;
      const order = roomData.studentOrder || [];

      if (order.length === 0) {
        throw new Error('접속한 학생이 없어 시작할 수 없습니다.');
      }

      const turnMode = roomData.turnMode || 'random';
      const finalOrder = turnMode === 'random' ? [...order].sort(() => Math.random() - 0.5) : [...order];

      await dbUpdate(roomRef, {
        status: 'writing',
        studentOrder: finalOrder,
        currentTurnIndex: 0,
      });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '시작에 실패했습니다.') });
    }
  },

  submitSentence: async (roomId, nickname, text) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      const newSentence: Sentence = {
        id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        writer: nickname,
        text,
        timestamp: Date.now(),
      };

      await runTransaction(roomRef, (currentData: Room | null) => {
        if (!currentData) return;

        const room = normalizeRoom(currentData);
        if (room.status !== 'writing') return room;

        const order = room.studentOrder;
        const currentTurnPlayer = order[room.currentTurnIndex];
        const isMyTurn = room.turnMode === 'free' || currentTurnPlayer === nickname;
        if (!isMyTurn) return room;

        const updatedSentences = [...room.sentences, newSentence];
        const typingStatus = {
          ...room.typingStatus,
          [nickname]: {
            text: '',
            isTyping: false,
            updatedAt: Date.now(),
          },
        };

        let nextStatus: RoomStatus = 'writing';
        if (room.endCondition === 'limit' && updatedSentences.length >= room.sentenceLimit) {
          nextStatus = 'evaluating';
        }

        const nextTurnIndex = order.length > 0 ? (room.currentTurnIndex + 1) % order.length : 0;

        return {
          ...room,
          sentences: updatedSentences,
          currentTurnIndex: nextTurnIndex,
          status: nextStatus,
          typingStatus,
        };
      });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '문장 전송에 실패했습니다.') });
    }
  },

  updateSentenceText: async (roomId, sentenceId, text) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      const snapshot = await dbGet(roomRef);
      if (!snapshot.exists()) return;

      const room = snapshot.val() as Room;
      const sentences = room.sentences || [];
      const updatedSentences = sentences.map((s) => 
        s.id === sentenceId ? { ...s, text } : s
      );

      await dbUpdate(roomRef, {
        sentences: updatedSentences
      });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '문장 수정에 실패했습니다.') });
    }
  },

  deleteLastSentence: async (roomId) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      const snapshot = await dbGet(roomRef);
      if (!snapshot.exists()) return;

      const room = snapshot.val() as Room;
      const sentences = room.sentences || [];
      if (sentences.length === 0) return;

      const updatedSentences = sentences.slice(0, -1);
      const order = room.studentOrder || [];
      
      // 턴을 이전 사람으로 돌림
      const prevTurnIndex = (room.currentTurnIndex - 1 + order.length) % order.length;

      // 만약 평가 대기중으로 상태가 바뀌었었다면 다시 writing 상태로 돌려놓음
      let nextStatus = room.status;
      if (room.status === 'evaluating') {
        nextStatus = 'writing';
      }

      await dbUpdate(roomRef, {
        sentences: updatedSentences,
        currentTurnIndex: prevTurnIndex,
        status: nextStatus
      });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '문장 삭제에 실패했습니다.') });
    }
  },

  skipTurn: async (roomId) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      const snapshot = await dbGet(roomRef);
      if (!snapshot.exists()) return;

      const room = snapshot.val() as Room;
      const order = room.studentOrder || [];
      if (order.length === 0) return;

      const nextTurnIndex = (room.currentTurnIndex + 1) % order.length;

      await dbUpdate(roomRef, {
        currentTurnIndex: nextTurnIndex,
      });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '차례 넘기기에 실패했습니다.') });
    }
  },

  updateTypingStatus: async (roomId, nickname, text, isTyping) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const typingRef = ref(db, `rooms/${formattedRoomId}/typingStatus/${nickname}`);
      await dbSet(typingRef, {
        text,
        isTyping,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error('Typing status update error:', err);
    }
  },

  submitEvaluation: async (roomId, targetRoomId, evaluatorNickname, scores, comment) => {
    const formattedRoomId = roomId.toUpperCase();
    const formattedTargetRoomId = targetRoomId.toUpperCase();
    try {
      const evaluationsRef = ref(db, `rooms/${formattedRoomId}/evaluations/${formattedTargetRoomId}`);
      const newEval: Evaluation = {
        evaluatorNickname,
        scores,
        comment: comment || '',
      };

      await runTransaction(evaluationsRef, (currentData: Evaluation[] | null) => {
        const currentEvaluations = Array.isArray(currentData) ? currentData : [];
        const existingIdx = currentEvaluations.findIndex(e => e.evaluatorNickname === evaluatorNickname);
        const updatedEvaluations = [...currentEvaluations];
        if (existingIdx > -1) {
          updatedEvaluations[existingIdx] = newEval;
        } else {
          updatedEvaluations.push(newEval);
        }

        return updatedEvaluations;
      });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '동료 평가 등록에 실패했습니다.') });
    }
  },

  submitTeacherEvaluation: async (roomId, scores, comment) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const evaluationRef = ref(db, `rooms/${formattedRoomId}/teacherEvaluation`);
      await dbSet(evaluationRef, {
        scores,
        comment: comment || '',
      });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '교사 평가 등록에 실패했습니다.') });
    }
  },

  completeRoom: async (roomId) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      await dbUpdate(ref(db, `rooms/${formattedRoomId}`), {
        status: 'completed',
      });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '방 완료 전환에 실패했습니다.') });
    }
  },

  finishWriting: async (roomId) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      await runTransaction(roomRef, (currentData: Room | null) => {
        if (!currentData) return;
        const room = normalizeRoom(currentData);
        if (room.status !== 'writing') return room;
        return {
          ...room,
          status: 'evaluating',
        };
      });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '이야기 완성 전환에 실패했습니다.') });
    }
  },

  subscribeRoom: (roomId) => {
    const formattedRoomId = roomId.toUpperCase();
    const roomRef = ref(db, `rooms/${formattedRoomId}`);
    
    const currentListener = get().activeListenerRef;
    if (currentListener) {
      off(currentListener);
    }

    set({ activeListenerRef: roomRef });

    onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = normalizeRoom(snapshot.val() as Room);

        set({ currentRoom: roomData, error: null });
      } else {
        set({ currentRoom: null, error: '존재하지 않거나 삭제된 방입니다.' });
      }
    }, (err) => {
      set({ error: err.message });
    });
  },

  unsubscribeRoom: (roomId) => {
    const formattedRoomId = roomId.toUpperCase();
    const roomRef = ref(db, `rooms/${formattedRoomId}`);
    off(roomRef);
    set({ currentRoom: null, activeListenerRef: null });
  },

  // --- Project Actions (Folder Management) ---
  loadProjects: async (teacherId) => {
    set({ loading: true, error: null });
    try {
      const projectsRef = ref(db, `teachers/${teacherId}/projects`);
      const snapshot = await dbGet(projectsRef);
      if (snapshot.exists()) {
        const data = snapshot.val() as Record<string, Partial<Project>>;
        const projectList: Project[] = Object.entries(data).map(([id, val]) => ({
          id,
          name: val.name || '이름 없는 프로젝트',
          description: val.description,
          createdAt: val.createdAt || 0,
        }));
        set({ projects: projectList, loading: false });
      } else {
        set({ projects: [], loading: false });
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '프로젝트 폴더를 불러오는데 실패했습니다.'), loading: false });
    }
  },

  createProject: async (teacherId, name, description) => {
    set({ loading: true, error: null });
    try {
      const projectId = `p-${Date.now()}`;
      const projectRef = ref(db, `teachers/${teacherId}/projects/${projectId}`);
      const newProject = {
        name,
        description: description || '',
        createdAt: Date.now(),
      };
      await dbSet(projectRef, newProject);
      
      // 프로젝트 목록 새로고침
      await get().loadProjects(teacherId);
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '프로젝트 폴더 생성 실패.'), loading: false });
      throw err;
    }
  },

  deleteProject: async (teacherId, projectId) => {
    set({ loading: true, error: null });
    try {
      // 1. 해당 프로젝트 아래의 룸 연계 데이터 삭제
      const projectRef = ref(db, `teachers/${teacherId}/projects/${projectId}`);
      const snapshot = await dbGet(projectRef);
      
      if (snapshot.exists()) {
        const val = snapshot.val() as { roomIds?: Record<string, true> };
        const roomIds = val.roomIds ? Object.keys(val.roomIds) : [];
        
        // 연쇄 삭제: 각 룸 데이터 삭제
        for (const rId of roomIds) {
          await dbRemove(ref(db, `rooms/${rId}`));
        }
      }

      // 2. 프로젝트 폴더 노드 자체 삭제
      await dbRemove(projectRef);
      
      // 목록 새로고침
      await get().loadProjects(teacherId);
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '프로젝트 삭제 실패.'), loading: false });
    }
  },

  loadRoomsByProject: async (teacherId, projectId) => {
    set({ loading: true, error: null, projectRooms: [] });
    try {
      const mappingRef = ref(db, `teachers/${teacherId}/projects/${projectId}/roomIds`);
      const snapshot = await dbGet(mappingRef);
      
      if (snapshot.exists()) {
        const roomIdsMap = snapshot.val();
        const roomIds = Object.keys(roomIdsMap);
        const rooms: Room[] = [];
        
        for (const rId of roomIds) {
          const roomSnap = await dbGet(ref(db, `rooms/${rId}`));
          if (roomSnap.exists()) {
            rooms.push(roomSnap.val() as Room);
          }
        }
        
        set({ projectRooms: rooms, loading: false });
      } else {
        set({ projectRooms: [], loading: false });
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '방 목록 로드 실패.'), loading: false });
    }
  },

  logWarning: async (roomId, nickname, text, reason) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      const newWarning: WarningLog = {
        id: `w-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        nickname,
        text,
        reason,
        timestamp: Date.now()
      };

      await runTransaction(roomRef, (currentData: Room | null) => {
        if (!currentData) return;
        const room = normalizeRoom(currentData);
        return {
          ...room,
          warningLogs: [...(room.warningLogs || []), newWarning],
        };
      });
    } catch (err) {
      console.error('Warning logging failed:', err);
    }
  },

  updateStudentOrder: async (roomId, studentOrder) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      await dbUpdate(ref(db, `rooms/${formattedRoomId}`), {
        studentOrder
      });
    } catch (err) {
      console.error('Failed to update student order:', err);
    }
  },

  updateProjectRoomsConfig: async (teacherId, projectId, config) => {
    set({ loading: true, error: null });
    try {
      const mappingRef = ref(db, `teachers/${teacherId}/projects/${projectId}/roomIds`);
      const snapshot = await dbGet(mappingRef);
      if (snapshot.exists()) {
        const roomIds = Object.keys(snapshot.val());
        for (const rId of roomIds) {
          const roomRef = ref(db, `rooms/${rId}`);
          await dbUpdate(roomRef, {
            maxStudents: config.maxStudents,
            layoutMode: config.layoutMode,
            endCondition: config.endCondition,
            sentenceLimit: config.sentenceLimit,
            rubrics: config.rubrics,
            turnMode: config.turnMode,
            writeUnit: config.writeUnit || 'sentence'
          });
        }
      }
      set({ loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, '설정 수정에 실패했습니다.'), loading: false });
      throw err;
    }
  },

  subscribeRoomsByProject: (teacherId, projectId) => {
    const mappingRef = ref(db, `teachers/${teacherId}/projects/${projectId}/roomIds`);
    
    // To track individual room listener cleanups
    const roomCleanups: { [roomId: string]: () => void } = {};
    let roomDataMap: { [roomId: string]: Room } = {};
    
    const updateProjectRooms = () => {
      const roomsList = Object.values(roomDataMap).sort((a, b) => b.createdAt - a.createdAt);
      set({ projectRooms: roomsList });
    };

    const unsubscribeMapping = onValue(mappingRef, (snapshot) => {
      if (!snapshot.exists()) {
        Object.keys(roomCleanups).forEach((rId) => {
          roomCleanups[rId]();
          delete roomCleanups[rId];
        });
        roomDataMap = {};
        set({ projectRooms: [], loading: false });
        return;
      }

      const roomIdsMap = snapshot.val();
      const roomIds = Object.keys(roomIdsMap);

      // Remove listeners for rooms no longer in the project
      Object.keys(roomCleanups).forEach((rId) => {
        if (!roomIds.includes(rId)) {
          roomCleanups[rId]();
          delete roomCleanups[rId];
          delete roomDataMap[rId];
        }
      });

      // Add listeners for new rooms
      roomIds.forEach((rId) => {
        if (!roomCleanups[rId]) {
          const roomRef = ref(db, `rooms/${rId}`);
          const unsubscribeRoom = onValue(roomRef, (roomSnap) => {
            if (roomSnap.exists()) {
              const rData = normalizeRoom(roomSnap.val() as Room);
              roomDataMap[rId] = rData;
            } else {
              delete roomDataMap[rId];
            }
            updateProjectRooms();
          }, (err) => {
            console.error(`Error loading room ${rId}:`, err);
          });
          roomCleanups[rId] = unsubscribeRoom;
        }
      });
    }, (err) => {
      set({ error: err.message });
    });

    return () => {
      unsubscribeMapping();
      Object.keys(roomCleanups).forEach((rId) => {
        roomCleanups[rId]();
      });
    };
  },

  resetStudents: async (roomId) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      await dbUpdate(ref(db, `rooms/${formattedRoomId}`), {
        students: null,
        studentOrder: null,
        typingStatus: null,
        currentTurnIndex: 0,
        status: 'waiting'
      });
    } catch (err) {
      console.error('Failed to reset students:', err);
    }
  },

  resetActivity: async (roomId) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      await dbUpdate(ref(db, `rooms/${formattedRoomId}`), {
        sentences: null,
        currentTurnIndex: 0,
        status: 'waiting',
        typingStatus: null,
        evaluations: null,
        teacherEvaluation: null,
        warningLogs: null
      });
    } catch (err) {
      console.error('Failed to reset activity:', err);
    }
  },
}));
