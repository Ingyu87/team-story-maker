import { create } from 'zustand';
import { db } from '../firebase';
import { ref, set as dbSet, update as dbUpdate, onValue, off, get as dbGet, remove as dbRemove } from 'firebase/database';
import type { DatabaseReference } from 'firebase/database';
import type { Room, RoomStatus, LayoutMode, Sentence, Student, Rubric, Project } from '../types/game';

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
  }) => Promise<string>;
  
  joinRoom: (roomId: string, nickname: string) => Promise<boolean>;
  leaveRoom: (roomId: string, nickname: string) => Promise<void>;
  startRoom: (roomId: string) => Promise<void>;
  submitSentence: (roomId: string, nickname: string, text: string) => Promise<void>;
  skipTurn: (roomId: string) => Promise<void>;
  updateTypingStatus: (roomId: string, nickname: string, text: string, isTyping: boolean) => Promise<void>;
  submitEvaluation: (roomId: string, targetRoomId: string, evaluatorNickname: string, scores: { [key: string]: number }, comment?: string) => Promise<void>;
  submitTeacherEvaluation: (roomId: string, scores: { [key: string]: number }, comment?: string) => Promise<void>;
  completeRoom: (roomId: string) => Promise<void>;
  
  subscribeRoom: (roomId: string) => void;
  unsubscribeRoom: (roomId: string) => void;
  setError: (error: string | null) => void;

  // Project Actions (Folder Management)
  loadProjects: (teacherId: string) => Promise<void>;
  createProject: (teacherId: string, name: string, description?: string) => Promise<void>;
  deleteProject: (teacherId: string, projectId: string) => Promise<void>;
  loadRoomsByProject: (teacherId: string, projectId: string) => Promise<void>;
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
      };

      // 1. 최상위 방 생성
      await dbSet(roomRef, newRoom);

      // 2. 프로젝트 하위에 방 매핑 기록
      const mappingRef = ref(db, `teachers/${config.teacherId}/projects/${config.projectId}/roomIds/${roomId}`);
      await dbSet(mappingRef, true);

      set({ loading: false });
      return roomId;
    } catch (err: any) {
      set({ error: err.message || '방 생성에 실패했습니다.', loading: false });
      throw err;
    }
  },

  joinRoom: async (roomId, nickname) => {
    set({ loading: true, error: null });
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      const snapshot = await dbGet(roomRef);

      if (!snapshot.exists()) {
        set({ error: '방을 찾을 수 없습니다.', loading: false });
        return false;
      }

      const roomData = snapshot.val() as Room;

      if (roomData.status !== 'waiting') {
        set({ error: '이미 글쓰기가 시작된 방입니다.', loading: false });
        return false;
      }

      const currentStudents = roomData.students || {};
      const studentKeys = Object.keys(currentStudents);

      if (studentKeys.length >= roomData.maxStudents) {
        set({ error: '정원이 가득 찬 방입니다.', loading: false });
        return false;
      }

      if (currentStudents[nickname]) {
        set({ error: '이미 존재하는 닉네임입니다. 다른 닉네임을 사용해주세요.', loading: false });
        return false;
      }

      const newStudent: Student = {
        nickname,
        joinedAt: Date.now(),
        isOnline: true,
      };

      const updatedStudents = {
        ...currentStudents,
        [nickname]: newStudent,
      };

      const updatedOrder = [...(roomData.studentOrder || []), nickname];

      await dbUpdate(roomRef, {
        students: updatedStudents,
        studentOrder: updatedOrder,
      });

      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message || '방 입장에 실패했습니다.', loading: false });
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
          students: updatedStudents,
          studentOrder: updatedOrder,
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

      const shuffledOrder = [...order].sort(() => Math.random() - 0.5);

      await dbUpdate(roomRef, {
        status: 'writing',
        studentOrder: shuffledOrder,
        currentTurnIndex: 0,
      });
    } catch (err: any) {
      set({ error: err.message || '시작에 실패했습니다.' });
    }
  },

  submitSentence: async (roomId, nickname, text) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      const roomRef = ref(db, `rooms/${formattedRoomId}`);
      const snapshot = await dbGet(roomRef);
      if (!snapshot.exists()) return;

      const room = snapshot.val() as Room;
      const sentences = room.sentences || [];
      const order = room.studentOrder || [];

      const newSentence: Sentence = {
        id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        writer: nickname,
        text,
        timestamp: Date.now(),
      };
      
      const updatedSentences = [...sentences, newSentence];

      const typingStatus = room.typingStatus || {};
      if (typingStatus[nickname]) {
        typingStatus[nickname] = {
          text: '',
          isTyping: false,
          updatedAt: Date.now(),
        };
      }

      let nextStatus: RoomStatus = 'writing';
      if (room.endCondition === 'limit' && updatedSentences.length >= room.sentenceLimit) {
        nextStatus = 'evaluating';
      }

      const nextTurnIndex = (room.currentTurnIndex + 1) % order.length;

      await dbUpdate(roomRef, {
        sentences: updatedSentences,
        currentTurnIndex: nextTurnIndex,
        status: nextStatus,
        typingStatus,
      });
    } catch (err: any) {
      set({ error: err.message || '문장 전송에 실패했습니다.' });
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
    } catch (err: any) {
      set({ error: err.message || '차례 넘기기에 실패했습니다.' });
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
      const snapshot = await dbGet(evaluationsRef);
      const currentEvaluations: any[] = snapshot.exists() ? snapshot.val() : [];

      const newEval = {
        evaluatorNickname,
        scores,
        comment: comment || '',
      };

      const existingIdx = currentEvaluations.findIndex(e => e.evaluatorNickname === evaluatorNickname);
      let updatedEvaluations = [...currentEvaluations];
      if (existingIdx > -1) {
        updatedEvaluations[existingIdx] = newEval;
      } else {
        updatedEvaluations.push(newEval);
      }

      await dbSet(evaluationsRef, updatedEvaluations);
    } catch (err: any) {
      set({ error: err.message || '동료 평가 등록에 실패했습니다.' });
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
    } catch (err: any) {
      set({ error: err.message || '교사 평가 등록에 실패했습니다.' });
    }
  },

  completeRoom: async (roomId) => {
    const formattedRoomId = roomId.toUpperCase();
    try {
      await dbUpdate(ref(db, `rooms/${formattedRoomId}`), {
        status: 'completed',
      });
    } catch (err: any) {
      set({ error: err.message || '방 완료 전환에 실패했습니다.' });
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
        const roomData = snapshot.val() as Room;
        if (!roomData.sentences) roomData.sentences = [];
        if (!roomData.studentOrder) roomData.studentOrder = [];
        if (!roomData.students) roomData.students = {};
        if (!roomData.typingStatus) roomData.typingStatus = {};
        if (!roomData.evaluations) roomData.evaluations = {};

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
        const data = snapshot.val();
        const projectList: Project[] = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          name: val.name,
          description: val.description,
          createdAt: val.createdAt,
        }));
        set({ projects: projectList, loading: false });
      } else {
        set({ projects: [], loading: false });
      }
    } catch (err: any) {
      set({ error: err.message || '프로젝트 폴더를 불러오는데 실패했습니다.', loading: false });
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
    } catch (err: any) {
      set({ error: err.message || '프로젝트 폴더 생성 실패.', loading: false });
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
        const val = snapshot.val();
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
    } catch (err: any) {
      set({ error: err.message || '프로젝트 삭제 실패.', loading: false });
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
    } catch (err: any) {
      set({ error: err.message || '방 목록 로드 실패.', loading: false });
    }
  },
}));
