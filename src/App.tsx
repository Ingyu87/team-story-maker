import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Lobby } from './pages/Lobby';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { StudentApp } from './pages/StudentApp';
import { EvaluationBoard } from './pages/EvaluationBoard';
import { Footer } from './components/Footer';
import { useAuthStore } from './store/useAuthStore';
import { BookOpen } from 'lucide-react';

function App() {
  const { initializeAuth } = useAuthStore();

  // 앱 최상위 마운트 시 Firebase Auth 세션 실시간 초기화 및 대기
  useEffect(() => {
    const unsubscribe = initializeAuth();
    return () => unsubscribe();
  }, [initializeAuth]);

  return (
    <Router>
      <header className="header-bar">
        <div className="logo-container" onClick={() => window.location.href = '/'}>
          <div style={{ display: 'flex', padding: '6px', background: '#ffe082', borderRadius: '50%', border: '2px solid #333' }}>
            <BookOpen size={20} color="#333" />
          </div>
          <span>우리들의 이야기 릴레이</span>
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#666' }}>
          초등 협동 글쓰기 도우미 ✏️
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/join" element={<Lobby />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/student/:roomId/:nickname" element={<StudentApp />} />
          <Route path="/evaluation/:roomId/:nickname" element={<EvaluationBoard />} />
        </Routes>
      </main>

      <Footer />
    </Router>
  );
}

export default App;
