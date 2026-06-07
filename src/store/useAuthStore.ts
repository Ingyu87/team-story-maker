import { create } from 'zustand';
import { auth } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;

  signUp: (email: string, password: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  initializeAuth: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  signUp: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      set({ user: userCredential.user, loading: false });
    } catch (err: any) {
      let errorMessage = '회원가입에 실패했습니다.';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = '이미 사용 중인 이메일입니다.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = '비밀번호는 최소 6자 이상이어야 합니다.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = '유효하지 않은 이메일 주소 형식입니다.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = '파이어베이스 콘솔에서 이메일/비밀번호 로그인이 활성화되지 않았습니다. [저장] 버튼을 누르셨는지 확인해 주세요!';
      } else if (err.code === 'auth/invalid-api-key') {
        errorMessage = '파이어베이스 API Key 환경 변수가 올바르지 않습니다.';
      } else {
        errorMessage = `회원가입 실패: ${err.message || err.code}`;
      }
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  logIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      set({ user: userCredential.user, loading: false });
    } catch (err: any) {
      let errorMessage = '로그인에 실패했습니다.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = '이메일 또는 비밀번호가 잘못되었습니다.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = '파이어베이스 콘솔에서 이메일/비밀번호 로그인이 활성화되지 않았습니다. [저장] 버튼을 누르셨는지 확인해 주세요!';
      } else {
        errorMessage = `로그인 실패: ${err.message || err.code}`;
      }
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  logOut: async () => {
    set({ loading: true, error: null });
    try {
      await signOut(auth);
      set({ user: null, loading: false });
    } catch (err: any) {
      set({ error: '로그아웃 실패', loading: false });
    }
  },

  initializeAuth: () => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      set({ user: firebaseUser, loading: false });
    });
    return unsubscribe;
  }
}));
