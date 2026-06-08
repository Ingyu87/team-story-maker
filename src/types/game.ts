export type LayoutMode = 'chat' | 'note' | 'storybook';
export type RoomStatus = 'waiting' | 'writing' | 'evaluating' | 'completed';

export interface Rubric {
  id: string;
  name: string;
  maxScore: number;
}

export interface Sentence {
  id: string;
  writer: string;
  text: string;
  timestamp: number;
}

export interface Student {
  nickname: string;
  joinedAt: number;
  isOnline: boolean;
}

export interface Evaluation {
  evaluatorNickname: string;
  scores: { [rubricId: string]: number };
  comment?: string;
}

export interface Room {
  id: string; // 방 코드 (예: AB12)
  title: string;
  maxStudents: number;
  layoutMode: LayoutMode;
  endCondition: 'limit' | 'free';
  sentenceLimit: number; // 작성 단위(문장/문단)별 목표 개수
  status: RoomStatus;
  rubrics: Rubric[];
  createdAt: number;
  currentTurnIndex: number; // 현재 차례인 학생의 인덱스
  students: { [nickname: string]: Student }; // 접속 학생 목록
  studentOrder: string[]; // 순서가 정해진 닉네임 리스트 (입장 순서 등)
  sentences: Sentence[]; // 작성된 이야기 문장들
  typingStatus: {
    [nickname: string]: {
      text: string;
      isTyping: boolean;
      updatedAt: number;
    };
  };
  evaluations: { [targetRoomId: string]: Evaluation[] }; // 모둠별 평가 결과 (동료 평가)
  teacherEvaluation?: {
    scores: { [rubricId: string]: number };
    comment?: string;
  };
  teacherId?: string; // 방을 개설한 교사 UID
  projectId?: string; // 소속된 프로젝트 폴더 ID
  warningLogs?: WarningLog[]; // AI 필터링에 걸린 경고 기록들
  turnMode?: 'random' | 'sequence' | 'free'; // 글쓰기 순서 방식
  writeUnit?: 'sentence' | 'paragraph'; // 글쓰기 단위 (문장 vs 문단)
}

export interface WarningLog {
  id: string;
  nickname: string;
  text: string;
  reason: string;
  timestamp: number;
}

export interface Project {
  id: string; // 프로젝트 고유 ID (UUID or Timestamp)
  name: string; // 학급 또는 프로젝트명 (예: 4학년 1반 국어시간)
  description?: string;
  createdAt: number;
}


