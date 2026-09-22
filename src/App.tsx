// 界面壳：侧栏（角色、课文、身份、重置）+ 学生/教师视角。数据与判定分别来自 data/ 与 domain/。
import { useState } from 'react';
import { BookOpen, GraduationCap, Mic, RotateCcw, Volume2 } from 'lucide-react';
import { lessonStats } from './domain/relay';
import { useRelayStore } from './ui/useRelayStore';
import { Avatar, Toasts } from './ui/bits';
import StudentView from './ui/StudentView';
import TeacherView from './ui/TeacherView';

type Role = 'student' | 'teacher';

export default function App() {
  const { state, apply, reset, toasts } = useRelayStore();
  const [role, setRole] = useState<Role>('student');
  const [studentId, setStudentId] = useState(state.students[0]?.id ?? '');
  const [lessonId, setLessonId] = useState(state.lessons[0]?.id ?? '');

  const lesson = state.lessons.find((l) => l.id === lessonId) ?? state.lessons[0];
  const me = state.students.find((s) => s.id === studentId) ?? state.students[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Volume2 size={19} /></div>
          <div>
            <strong>班级朗读接力台</strong>
            <span>Reading relay</span>
          </div>
        </div>

        <div className="side-label">视角</div>
        <nav>
          <button
            className={role === 'student' ? 'side-link active' : 'side-link'}
            onClick={() => setRole('student')}
          >
            <Mic size={16} /> 学生接力
          </button>
          <button
            className={role === 'teacher' ? 'side-link active' : 'side-link'}
            onClick={() => setRole('teacher')}
          >
            <GraduationCap size={16} /> 教师点评
          </button>
        </nav>

        <div className="side-label">课文</div>
        <nav>
          {state.lessons.map((l) => {
            const s = lessonStats(state, l);
            return (
              <button
                key={l.id}
                className={l.id === lesson.id ? 'side-link active' : 'side-link'}
                onClick={() => setLessonId(l.id)}
              >
                <BookOpen size={16} />
                <span className="lesson-name">{l.title}</span>
                <b>{s.passed}/{s.total}</b>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          {role === 'student' && (
            <div className="identity-picker">
              <span className="side-label">当前学生</span>
              <div className="student-chips">
                {state.students.map((s) => (
                  <button
                    key={s.id}
                    className={s.id === me.id ? 'student-chip active' : 'student-chip'}
                    onClick={() => setStudentId(s.id)}
                    title={s.name}
                  >
                    <Avatar student={s} size={22} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="ghost reset-btn" onClick={reset}>
            <RotateCcw size={14} /> 重置演示数据
          </button>
        </div>
      </aside>

      <main className="main">
        {role === 'student' ? (
          <StudentView state={state} lesson={lesson} me={me} apply={apply} />
        ) : (
          <TeacherView state={state} lesson={lesson} apply={apply} />
        )}
      </main>

      <Toasts toasts={toasts} />
    </div>
  );
}
