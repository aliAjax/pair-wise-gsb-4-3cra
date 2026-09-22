// 学生视角：接力顺序、领取/取消、录音提交、受阻原因、我的版本。
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Flag,
  Lock,
  Mic,
  Pause,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import type { Outcome, SegmentView } from '../domain/relay';
import {
  cancelClaim,
  claimSegment,
  getLessonView,
  lessonStats,
  studentStats,
  submitRecording,
} from '../domain/relay';
import type { Lesson, RelayState, Student } from '../domain/types';
import { Avatar, RECORDING_STATUS_META, StatusPill, Wave } from './bits';
import { fmtClock, fmtDuration } from './format';

interface Props {
  state: RelayState;
  lesson: Lesson;
  me: Student;
  apply: (outcome: Outcome, successText?: string) => boolean;
}

export default function StudentView({ state, lesson, me, apply }: Props) {
  const views = useMemo(() => getLessonView(state, lesson), [state, lesson]);
  const stats = lessonStats(state, lesson);
  const mine = studentStats(state, lesson, me.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    views.find((v) => v.segment.id === selectedId) ??
    views.find((v) => v.claim?.studentId === me.id && v.status !== 'passed') ??
    stats.vacancy ??
    views[0];

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">班级朗读接力 · 学生视角</p>
          <h1>{lesson.title}</h1>
          <p className="sub">
            {lesson.author} · {lesson.grade} · {lesson.source}
          </p>
        </div>
        <div className="identity">
          <Avatar student={me} size={34} />
          <div>
            <strong>{me.name}</strong>
            <span>按顺序领取片段，读好你这一棒</span>
          </div>
        </div>
      </header>

      <section className="stats four">
        <div>
          <span>接力进度</span>
          <strong>
            {stats.passed} <em>/ {stats.total} 已通过</em>
          </strong>
          <div className="progress">
            <i style={{ width: `${(stats.passed / stats.total) * 100}%` }} />
          </div>
        </div>
        <div>
          <span>当前空缺</span>
          <strong>{stats.vacancy ? `片段 ${stats.vacancy.segment.order}` : '无'}</strong>
          <small>{stats.vacancy ? '只能领取首个空缺片段' : '等待前序片段通过'}</small>
        </div>
        <div>
          <span>我的有效录音</span>
          <strong>{mine.activeRecordings} <em>条</em></strong>
          <small>同一片段只保留一条有效录音</small>
        </div>
        <div>
          <span>待我重录</span>
          <strong className={mine.toRedo > 0 ? 'warn-text' : ''}>{mine.toRedo} <em>段</em></strong>
          <small>{mine.waitingReview} 段待教师点评</small>
        </div>
      </section>

      <div className="content-grid">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>接力顺序</h2>
              <p>前一片段通过后，下一片段才会解锁</p>
            </div>
          </div>
          <div className="relay-list">
            {views.map((v) => (
              <RelayRow
                key={v.segment.id}
                view={v}
                me={me}
                selected={selected?.segment.id === v.segment.id}
                onSelect={() => setSelectedId(v.segment.id)}
              />
            ))}
          </div>
        </section>

        {selected && (
          <SegmentDetail key={selected.segment.id} view={selected} state={state} lesson={lesson} me={me} apply={apply} />
        )}
      </div>
    </>
  );
}

function RelayRow({
  view,
  me,
  selected,
  onSelect,
}: {
  view: SegmentView;
  me: Student;
  selected: boolean;
  onSelect: () => void;
}) {
  const mineClaim = view.claim?.studentId === me.id;
  return (
    <button
      className={`relay-row${selected ? ' selected' : ''}${view.status === 'locked' ? ' is-locked' : ''}`}
      onClick={onSelect}
    >
      <span className={`order-badge s-${view.status}`}>
        {view.status === 'passed' ? <Check size={14} /> : view.status === 'locked' ? <Lock size={12} /> : view.segment.order}
      </span>
      <span className="relay-copy">
        <strong>{view.segment.text}</strong>
        <span className="relay-meta">
          <StatusPill status={view.status} />
          {view.claimer && (
            <i>
              {view.claimer.name}
              {mineClaim ? '（我）' : ''}
            </i>
          )}
          {view.recording?.status === 'passed' && <em>{view.recording.score} 分</em>}
        </span>
      </span>
      {mineClaim && view.status !== 'passed' && <Flag size={14} className="my-flag" />}
    </button>
  );
}

function SegmentDetail({ view, state, lesson, me, apply }: Props & { view: SegmentView }) {
  const { segment, status } = view;
  const mineClaim = view.claim?.studentId === me.id;
  const myVersions = view.versions.filter((v) => v.studentId === me.id);
  const nextVersion = myVersions.reduce((m, v) => Math.max(m, v.version), 0) + 1;

  const doClaim = () =>
    apply(claimSegment(state, lesson.id, segment.id, me.id), `已领取片段 ${segment.order}，轮到你了。`);
  const doCancel = () =>
    view.claim && apply(cancelClaim(state, view.claim.id), `已取消领取，片段 ${segment.order} 的位置已释放。`);
  const doSubmit = (seconds: number) =>
    apply(
      submitRecording(state, segment.id, me.id, seconds),
      `片段 ${segment.order} 第 ${nextVersion} 版录音已提交，等待教师点评。`,
    );

  return (
    <section className="panel detail">
      <div className="section-head">
        <div>
          <h2>片段 {segment.order}</h2>
          <p>{segment.hint}</p>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="focus-card">
        <div className="focus-tag">
          {lesson.title} · 第 {segment.order} / {lesson.segments.length} 段
        </div>
        <p className="focus-text">{segment.text}</p>
      </div>

      {status === 'locked' && (
        <div className="notice blocked">
          <AlertTriangle size={16} />
          <div>
            <strong>暂时不能领取或录音</strong>
            {view.blockers.map((b, i) => (
              <p key={i}>
                受阻对象：{b.objectName}
                <br />
                规则：{b.rule}
              </p>
            ))}
          </div>
        </div>
      )}

      {status === 'open' && (
        <div className="notice open-note">
          <Flag size={16} />
          <div>
            <strong>这是当前首个空缺片段</strong>
            <p>领取后即可录音；取消领取会释放位置，让其他同学接力。</p>
          </div>
        </div>
      )}

      {status === 'claimed' && !mineClaim && (
        <div className="notice">
          <Avatar student={view.claimer!} size={22} />
          <div>
            <strong>{view.claimer?.name} 已领取，正在准备录音</strong>
            <p>等这一棒通过后，下一片段才会解锁。</p>
          </div>
        </div>
      )}

      {status === 'submitted' && (
        <div className="notice">
          <Avatar student={view.claimer!} size={22} />
          <div>
            <strong>
              {mineClaim ? '你的录音已提交，等待教师点评' : `${view.claimer?.name} 的录音待教师点评`}
            </strong>
            <p>点评期间不能取消领取；通过后下一片段自动解锁。</p>
          </div>
        </div>
      )}

      {status === 'returned' && (
        <div className="notice returned-note">
          <RotateCcw size={16} />
          <div>
            <strong>{mineClaim ? '教师退回了你的录音，请重读' : `${view.claimer?.name} 的录音被退回，待重录`}</strong>
            {view.recording?.comment && <p>教师评语：{view.recording.comment}</p>}
            <p>重录会另存为新版本，旧版本和旧成绩都会保留。</p>
          </div>
        </div>
      )}

      {status === 'passed' && view.recording && (
        <div className="notice passed-note">
          <Check size={16} />
          <div>
            <strong>
              {view.claimer?.name} 已通过 · {view.recording.score} 分
            </strong>
            {view.recording.comment && <p>教师评语：{view.recording.comment}</p>}
          </div>
        </div>
      )}

      {status === 'open' && (
        <div className="detail-actions">
          <button className="primary" onClick={doClaim}>
            <Flag size={15} /> 领取这一棒
          </button>
        </div>
      )}

      {mineClaim && (status === 'claimed' || status === 'returned') && (
        <>
          <Recorder
            key={`${segment.id}-${status}-${view.recording?.id ?? 'new'}`}
            label={status === 'returned' ? `重新录音（将保存为第 ${nextVersion} 版）` : '准备好后开始录音'}
            onDone={doSubmit}
          />
          <div className="detail-actions">
            <button className="ghost danger" onClick={doCancel}>
              <Undo2 size={14} /> 取消领取，释放位置
            </button>
          </div>
        </>
      )}

      {myVersions.length > 0 && (
        <div className="versions">
          <h3>我的录音版本</h3>
          {myVersions.map((v) => {
            const meta = RECORDING_STATUS_META[v.status];
            return (
              <div key={v.id} className={`version-row${v.active ? ' active' : ''}`}>
                <span className="v-no">第 {v.version} 版</span>
                <span className={meta.className}>{meta.label}</span>
                {v.active && <span className="active-badge">有效</span>}
                <span className="v-time">{fmtClock(v.createdAt)} · {fmtDuration(v.seconds)}</span>
                {v.score != null && <span className="v-score">{v.score} 分</span>}
                {v.comment && <span className="v-comment">“{v.comment}”</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Recorder({ label, onDone }: { label: string; onDone: (seconds: number) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const toggle = () => {
    if (recording) {
      window.clearInterval(timer.current);
      setRecording(false);
      onDone(Math.max(1, seconds));
      setSeconds(0);
      return;
    }
    setSeconds(0);
    setRecording(true);
    timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  return (
    <div className="record-card">
      <div className="record-top">
        <div>
          <span className="label">YOUR RECORDING</span>
          <h3>{label}</h3>
        </div>
        <span className="record-time">{fmtDuration(seconds)}</span>
      </div>
      <Wave live={recording} tall />
      <div className="record-actions">
        <button className={recording ? 'record-button recording' : 'record-button'} onClick={toggle}>
          <span>{recording ? <Pause size={15} /> : <Mic size={15} />}</span>
          {recording ? '结束并提交' : '开始录音'}
        </button>
      </div>
    </div>
  );
}
