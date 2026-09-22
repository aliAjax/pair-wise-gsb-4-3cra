// 教师视角：待点评收件箱、通过/退回、接力板、版本档案（旧成绩保留可查）。
import { useMemo, useState } from 'react';
import { Check, ChevronRight, History, Inbox, Play, RotateCcw } from 'lucide-react';
import type { Outcome, SegmentView } from '../domain/relay';
import { getLessonView, lessonStats, reviewRecording } from '../domain/relay';
import type { Lesson, RecordingVersion, RelayState } from '../domain/types';
import { Avatar, Empty, RECORDING_STATUS_META, StatusPill } from './bits';
import { fmtClock, fmtDuration } from './format';

interface Props {
  state: RelayState;
  lesson: Lesson;
  apply: (outcome: Outcome, successText?: string) => boolean;
}

export default function TeacherView({ state, lesson, apply }: Props) {
  const views = useMemo(() => getLessonView(state, lesson), [state, lesson]);
  const stats = lessonStats(state, lesson);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pending = state.recordings.filter(
    (r) => r.active && r.status === 'pending' && lesson.segments.some((s) => s.id === r.segmentId),
  );
  const versionTotal = state.recordings.filter((r) =>
    lesson.segments.some((s) => s.id === r.segmentId),
  ).length;
  const participants = new Set(
    state.claims
      .filter((c) => lesson.segments.some((s) => s.id === c.segmentId))
      .map((c) => c.studentId),
  ).size;

  const selected = views.find((v) => v.segment.id === selectedId) ?? views[0];

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">班级朗读接力 · 教师视角</p>
          <h1>{lesson.title}</h1>
          <p className="sub">
            {lesson.author} · {lesson.grade} · {lesson.source}
          </p>
        </div>
      </header>

      <section className="stats four">
        <div>
          <span>待点评录音</span>
          <strong className={pending.length > 0 ? 'warn-text' : ''}>{pending.length} <em>条</em></strong>
          <small>通过会解锁下一片段</small>
        </div>
        <div>
          <span>接力进度</span>
          <strong>{stats.passed} <em>/ {stats.total} 已通过</em></strong>
          <div className="progress">
            <i style={{ width: `${(stats.passed / stats.total) * 100}%` }} />
          </div>
        </div>
        <div>
          <span>参与学生</span>
          <strong>{participants} <em>人</em></strong>
          <small>含已释放位置的领取记录</small>
        </div>
        <div>
          <span>录音版本总数</span>
          <strong>{versionTotal} <em>版</em></strong>
          <small>退回重读另存新版，旧成绩不覆盖</small>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2><Inbox size={17} /> 待点评</h2>
            <p>退回会要求学生重读，并把后续接力一并退回待重录</p>
          </div>
        </div>
        {pending.length === 0 && <Empty>暂时没有待点评的录音。</Empty>}
        <div className="review-list">
          {pending.map((r) => (
            <ReviewCard key={r.id} recording={r} state={state} lesson={lesson} apply={apply} />
          ))}
        </div>
      </section>

      <div className="content-grid teacher-grid">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>接力板</h2>
              <p>点击片段查看完整版本档案</p>
            </div>
          </div>
          <div className="relay-list">
            {views.map((v) => (
              <button
                key={v.segment.id}
                className={`relay-row${selected?.segment.id === v.segment.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(v.segment.id)}
              >
                <span className={`order-badge s-${v.status}`}>{v.segment.order}</span>
                <span className="relay-copy">
                  <strong>{v.segment.text}</strong>
                  <span className="relay-meta">
                    <StatusPill status={v.status} />
                    {v.claimer && <i>{v.claimer.name}</i>}
                    {v.recording?.status === 'passed' && <em>{v.recording.score} 分</em>}
                    {v.versions.length > 0 && <small>{v.versions.length} 个版本</small>}
                  </span>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </section>

        {selected && (
          <SegmentArchive
            view={selected}
            state={state}
            lesson={lesson}
            apply={apply}
          />
        )}
      </div>
    </>
  );
}

function ReviewCard({ recording, state, lesson, apply }: Props & { recording: RecordingVersion }) {
  const [score, setScore] = useState(88);
  const [comment, setComment] = useState('');
  const student = state.students.find((s) => s.id === recording.studentId);
  const segment = lesson.segments.find((s) => s.id === recording.segmentId);
  if (!student || !segment) return null;

  const pass = () =>
    apply(
      reviewRecording(state, recording.id, { pass: true, score, comment }),
      `已通过 ${student.name} 的片段 ${segment.order}（${score} 分），下一片段解锁。`,
    );
  const sendBack = () =>
    apply(
      reviewRecording(state, recording.id, { pass: false, comment }),
      `已退回 ${student.name} 的片段 ${segment.order}，后续接力已退回待重录。`,
    );

  return (
    <div className="review-card">
      <div className="review-head">
        <Avatar student={student} size={32} />
        <div className="review-title">
          <strong>{student.name} · 片段 {segment.order}（第 {recording.version} 版）</strong>
          <span>{fmtClock(recording.createdAt)} 提交 · {fmtDuration(recording.seconds)}</span>
        </div>
        <button className="round-btn" title="试听（演示）"><Play size={15} /></button>
      </div>
      <p className="review-text">“{segment.text}”</p>
      <div className="review-form">
        <label>
          成绩
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
          />
        </label>
        <label className="grow">
          评语（退回时必填）
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="例如：叠词读得再轻快一些"
          />
        </label>
        <button className="primary" onClick={pass}><Check size={15} /> 通过</button>
        <button className="secondary danger" onClick={sendBack}><RotateCcw size={14} /> 退回重读</button>
      </div>
    </div>
  );
}

function SegmentArchive({ view, state, lesson, apply }: Props & { view: SegmentView }) {
  const { segment } = view;
  const [returnComment, setReturnComment] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const rec = view.recording;

  const sendBack = () => {
    if (!rec) return;
    const okDone = apply(
      reviewRecording(state, rec.id, { pass: false, comment: returnComment }),
      `已退回片段 ${segment.order}，原片段及后续接力退回待重录，旧成绩保留。`,
    );
    if (okDone) {
      setShowReturn(false);
      setReturnComment('');
    }
  };

  return (
    <section className="panel detail">
      <div className="section-head">
        <div>
          <h2><History size={17} /> 片段 {segment.order} · 版本档案</h2>
          <p>{segment.hint}</p>
        </div>
        <StatusPill status={view.status} />
      </div>
      <p className="archive-text">“{segment.text}”</p>

      {view.claimer && (
        <div className="notice">
          <Avatar student={view.claimer} size={22} />
          <div>
            <strong>当前领取人：{view.claimer.name}</strong>
            <p>{view.claim ? `领取于 ${fmtClock(view.claim.claimedAt)}` : ''}</p>
          </div>
        </div>
      )}

      {view.versions.length === 0 && <Empty>这个片段还没有任何录音版本。</Empty>}
      <div className="versions">
        {view.versions.map((v) => {
          const student = state.students.find((s) => s.id === v.studentId);
          const meta = RECORDING_STATUS_META[v.status];
          return (
            <div key={v.id} className={`version-row${v.active ? ' active' : ''}`}>
              <span className="v-no">第 {v.version} 版</span>
              {student && (
                <span className="v-student">
                  <Avatar student={student} size={20} /> {student.name}
                </span>
              )}
              <span className={meta.className}>{meta.label}</span>
              {v.active ? <span className="active-badge">有效</span> : <span className="history-badge">历史</span>}
              <span className="v-time">{fmtClock(v.createdAt)} · {fmtDuration(v.seconds)}</span>
              {v.score != null && <span className="v-score">{v.score} 分</span>}
              {v.comment && <span className="v-comment">“{v.comment}”</span>}
            </div>
          );
        })}
      </div>

      {rec && (rec.status === 'pending' || rec.status === 'passed') && (
        <div className="detail-actions">
          {!showReturn ? (
            <button className="secondary danger" onClick={() => setShowReturn(true)}>
              <RotateCcw size={14} /> 退回重读（退回当前有效版本）
            </button>
          ) : (
            <div className="return-form">
              <input
                autoFocus
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                placeholder="写明退回原因，后续接力会一并退回待重录"
              />
              <button className="primary danger-bg" onClick={sendBack}>确认退回</button>
              <button className="ghost" onClick={() => setShowReturn(false)}>取消</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
