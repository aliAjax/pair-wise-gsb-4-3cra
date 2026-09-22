// 界面层：只负责渲染与交互，规则判定走 relay/engine，数据来自 data/lessons，持久化走 store/persistence。
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BookOpen, Check, GraduationCap, History, Lock, Mic,
  RotateCcw, Square, UserCheck, Users, X,
} from 'lucide-react';
import { lesson, studentName, students } from './data/lessons';
import {
  activeRecordingMap, activeRecordingsFor, canRecord, cancelClaim, claimSegment,
  emptyRelayState, firstOpenSegmentId, isBlock, orderedSegments, relayProgress,
  returnCascadeCount, reviewRecording, segmentStatus, submitRecording,
  type Recording, type RelayState, type RuleBlock, type SegmentStatus,
} from './relay/engine';
import { loadRelayState, resetRelayState, saveRelayState } from './store/persistence';

type Role = { kind: 'student'; id: string } | { kind: 'teacher' };
type Flash = { kind: 'block'; block: RuleBlock } | { kind: 'ok'; text: string };

const statusMeta: Record<SegmentStatus, { label: string; cls: string }> = {
  passed: { label: '已通过', cls: 'st-passed' },
  pending: { label: '待审核', cls: 'st-pending' },
  returned: { label: '退回重录', cls: 'st-returned' },
  claimed: { label: '已领取', cls: 'st-claimed' },
  open: { label: '可领取', cls: 'st-open' },
  locked: { label: '未解锁', cls: 'st-locked' },
};

const recStatusMeta: Record<Recording['status'], { label: string; cls: string }> = {
  pending: { label: '待审核', cls: 'st-pending' },
  passed: { label: '已通过', cls: 'st-passed' },
  returned: { label: '已退回', cls: 'st-returned' },
  superseded: { label: '已失效', cls: 'st-locked' },
};

const bars = Array.from({ length: 56 }, (_, i) => 18 + ((i * 29) % 44));
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtSec = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function App() {
  const [relay, setRelay] = useState<RelayState>(() => loadRelayState(lesson, students) ?? emptyRelayState(lesson.id));
  const [role, setRole] = useState<Role>({ kind: 'student', id: students[0].id });
  const [flash, setFlash] = useState<Flash | null>(null);
  const [historySeg, setHistorySeg] = useState(lesson.segments[0].id);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => saveRelayState(relay), [relay]);
  useEffect(() => () => window.clearInterval(timer.current), []);
  useEffect(() => { setRecording(false); window.clearInterval(timer.current); }, [role]);

  const segs = orderedSegments(lesson);
  const segOrder = (id: string) => lesson.segments.find(s => s.id === id)?.order ?? 0;
  const activeMap = useMemo(() => activeRecordingMap(relay), [relay]);
  const progress = useMemo(() => relayProgress(relay, lesson), [relay]);
  const firstOpen = firstOpenSegmentId(relay, lesson);
  const myClaim = role.kind === 'student' ? relay.claims.find(c => c.studentId === role.id) : undefined;
  const mySegment = myClaim ? lesson.segments.find(s => s.id === myClaim.segmentId) : undefined;
  const recordCheck = role.kind === 'student' && mySegment
    ? canRecord(relay, lesson, students, role.id, mySegment.id)
    : null;
  const pendingReviews = useMemo(
    () => [...activeMap.values()].filter(r => r.status === 'pending').sort((a, b) => segOrder(a.segmentId) - segOrder(b.segmentId)),
    [activeMap],
  );
  const historyList = useMemo(
    () => relay.recordings.filter(r => r.segmentId === historySeg).sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt)),
    [relay, historySeg],
  );

  const run = (result: RelayState | RuleBlock, okText: string) => {
    if (isBlock(result)) setFlash({ kind: 'block', block: result });
    else { setRelay(result); setFlash({ kind: 'ok', text: okText }); }
  };

  const claim = (segmentId: string) => {
    if (role.kind !== 'student') return;
    run(claimSegment(relay, lesson, students, role.id, segmentId), `已领取片段 ${segOrder(segmentId)}，可以开始录音`);
  };
  const cancel = (segmentId: string) => {
    if (role.kind !== 'student') return;
    run(cancelClaim(relay, lesson, role.id, segmentId), `已取消领取，片段 ${segOrder(segmentId)} 的位置已释放`);
  };

  const toggleRecord = () => {
    if (role.kind !== 'student' || !mySegment) return;
    if (recording) {
      window.clearInterval(timer.current);
      setRecording(false);
      const result = submitRecording(relay, lesson, students, role.id, mySegment.id, Math.max(seconds, 1));
      if (isBlock(result)) setFlash({ kind: 'block', block: result });
      else {
        setRelay(result.state);
        setFlash({ kind: 'ok', text: `片段 ${mySegment.order} 第 ${result.recording.version} 版录音已提交，等待教师审核` });
      }
      setSeconds(0);
      return;
    }
    if (recordCheck && !recordCheck.ok) { setFlash({ kind: 'block', block: recordCheck }); return; }
    setSeconds(0);
    setRecording(true);
    timer.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
  };

  const review = (rec: Recording, decision: 'pass' | 'return') => {
    const score = scores[rec.id] ?? 80;
    const result = reviewRecording(relay, lesson, rec.id, decision, decision === 'pass' ? score : undefined, decision === 'return' ? '教师退回重读' : undefined);
    if (isBlock(result)) { setFlash({ kind: 'block', block: result }); return; }
    setRelay(result.state);
    setFlash({
      kind: 'ok',
      text: decision === 'pass'
        ? `片段 ${segOrder(rec.segmentId)} 已通过，成绩 ${score} 分，接力继续`
        : `片段 ${segOrder(rec.segmentId)} 及后续接力已退回待重录（${result.cascaded} 条有效录音退回，旧成绩保留）`,
    });
  };

  const resetAll = () => {
    resetRelayState();
    setRelay(emptyRelayState(lesson.id));
    setFlash({ kind: 'ok', text: '接力已重置，所有领取与录音版本已清空' });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><BookOpen size={19} /></div>
          <div><strong>班级朗读接力台</strong><span>Reading Relay</span></div>
        </div>
        <div className="side-label">当前角色</div>
        <nav className="role-list">
          {students.map(s => (
            <button
              key={s.id}
              className={role.kind === 'student' && role.id === s.id ? 'side-link active' : 'side-link'}
              onClick={() => setRole({ kind: 'student', id: s.id })}
            >
              <span className="dot" style={{ background: s.color }} />{s.name}<b>学生</b>
            </button>
          ))}
          <button
            className={role.kind === 'teacher' ? 'side-link active' : 'side-link'}
            onClick={() => setRole({ kind: 'teacher' })}
          >
            <GraduationCap size={16} />教师工作台<b>审核</b>
          </button>
        </nav>
        <div className="side-label">接力规则</div>
        <ul className="rules">
          <li>学生只能领取首个空缺片段</li>
          <li>前一片段未通过，后续不能录音</li>
          <li>退回后新录音另存版本，旧成绩保留</li>
          <li>同一片段每人只留一条有效录音</li>
          <li>取消领取即释放位置</li>
        </ul>
        <div className="sidebar-foot">
          <div className="streak">
            <span>接力进度</span>
            <strong>{progress.passed} <small>/ {progress.total} 段</small></strong>
            <i>{progress.pending} 段待审核 · {progress.returned} 段退回重录</i>
          </div>
          <button className="ghost reset" onClick={resetAll}><RotateCcw size={14} />重置接力</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{lesson.source}</p>
            <h1>{lesson.title}</h1>
          </div>
          <div className="top-actions">
            <div className="who">
              {role.kind === 'teacher'
                ? <><GraduationCap size={15} />教师 · 审核模式</>
                : <><UserCheck size={15} />{studentName(role.id)} · 学生模式</>}
            </div>
          </div>
        </header>

        {flash && (
          <div className={flash.kind === 'block' ? 'flash blocked' : 'flash ok'}>
            {flash.kind === 'block' ? <AlertTriangle size={17} /> : <Check size={17} />}
            <div className="flash-body">
              {flash.kind === 'block' ? (
                <>
                  <strong>受阻 · {flash.block.objectType}：{flash.block.objectLabel}</strong>
                  <span>规则：{flash.block.rule}。{flash.block.detail}</span>
                </>
              ) : <strong>{flash.text}</strong>}
            </div>
            <button className="icon-btn" onClick={() => setFlash(null)}><X size={15} /></button>
          </div>
        )}

        <section className="stats">
          <div>
            <span>接力进度</span>
            <strong>{progress.passed} <em>/ {progress.total}</em></strong>
            <div className="progress"><i style={{ width: `${(progress.passed / progress.total) * 100}%` }} /></div>
          </div>
          <div><span>待审核</span><strong>{progress.pending} <em>段</em></strong><small>{pendingReviews.length} 条有效录音待教师处理</small></div>
          <div><span>退回重录</span><strong>{progress.returned} <em>段</em></strong><small>旧版本与成绩保留在版本记录中</small></div>
          <div>
            <span>当前空缺</span>
            <strong>{firstOpen ? `片段 ${segOrder(firstOpen)}` : '无'}</strong>
            <small className="green">{firstOpen ? '学生可按顺序领取' : '全部片段已进行或完成'}</small>
          </div>
        </section>

        <div className="content-grid">
          <section className="track">
            <div className="section-head">
              <div><h2>接力轨道</h2><p>课文按顺序拆为 {segs.length} 个片段，依次领取、录音、审核</p></div>
              <span className="count"><Users size={14} />{progress.claimed} 人持有片段</span>
            </div>
            {segs.map((seg, i) => {
              const status = segmentStatus(relay, lesson, seg.id);
              const meta = statusMeta[status];
              const segClaim = relay.claims.find(c => c.segmentId === seg.id);
              const holder = segClaim ? students.find(s => s.id === segClaim.studentId) : undefined;
              const actives = activeRecordingsFor(relay, seg.id);
              const shown = actives.find(r => r.status === 'passed') ?? actives.find(r => r.status === 'pending') ?? actives[0];
              const mine = role.kind === 'student' && segClaim?.studentId === role.id;
              return (
                <article
                  key={seg.id}
                  className={`seg ${status} ${historySeg === seg.id ? 'selected' : ''}`}
                  onClick={() => setHistorySeg(seg.id)}
                >
                  <div className="seg-rail">
                    <div className="seg-num">{status === 'passed' ? <Check size={14} /> : status === 'locked' ? <Lock size={12} /> : seg.order}</div>
                    {i < segs.length - 1 && <div className="seg-line" />}
                  </div>
                  <div className="seg-body">
                    <div className="seg-head">
                      <span className={`status ${meta.cls}`}>{meta.label}</span>
                      {holder && <span className="holder"><i style={{ background: holder.color }} />{holder.name} 持有</span>}
                      {shown && (
                        <span className="rec">
                          v{shown.version} · {studentName(shown.studentId)}
                          {shown.score != null && ` · ${shown.score} 分`}
                        </span>
                      )}
                    </div>
                    <p className="seg-text">{seg.text}</p>
                    <p className="seg-hint">{seg.hint}</p>
                    {role.kind === 'student' && (
                      <div className="seg-actions" onClick={e => e.stopPropagation()}>
                        {(status === 'open' || status === 'returned' || status === 'locked') && !mine && (
                          <button className={status === 'locked' ? 'secondary locked-btn' : 'primary'} onClick={() => claim(seg.id)}>
                            {status === 'locked' ? <><Lock size={13} />领取</> : status === 'returned' ? '重新领取' : '领取片段'}
                          </button>
                        )}
                        {mine && (
                          <>
                            <span className="mine-tag">我已领取</span>
                            <button className="secondary" onClick={() => cancel(seg.id)}>取消领取</button>
                          </>
                        )}
                        {segClaim && !mine && <span className="wait">等待 {holder?.name} 完成或释放</span>}
                        {status === 'pending' && <span className="wait">录音审核中，暂不可领取</span>}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="panel-col">
            {role.kind === 'student' && (
              <section className="panel recorder">
                <div className="panel-head"><span className="label">RECORDING</span><h2>录音台</h2></div>
                {!mySegment && <div className="empty">尚未领取片段<br />请先在接力轨道领取首个空缺片段</div>}
                {mySegment && recordCheck && !recordCheck.ok && (
                  <div className="blocked-inline">
                    <AlertTriangle size={16} />
                    <div>
                      <strong>受阻 · {recordCheck.objectType}：{recordCheck.objectLabel}</strong>
                      <p>规则：{recordCheck.rule}。{recordCheck.detail}</p>
                    </div>
                  </div>
                )}
                {mySegment && recordCheck?.ok && (
                  <>
                    <div className="focus-card">
                      <div className="focus-tag">片段 {mySegment.order} · {mySegment.hint}</div>
                      <p className="focus-text">{mySegment.text}</p>
                      <p className="focus-translation">提交后由教师审核，通过即解锁下一片段</p>
                    </div>
                    <div className="record-card">
                      <div className="record-top">
                        <div><span className="label">YOUR RECORDING</span><h3>{recording ? '录音中…' : '准备好后开始录音'}</h3></div>
                        <span className="record-time">{fmtSec(seconds)}</span>
                      </div>
                      <div className="record-wave">
                        {bars.map((h, i) => <i key={i} className={recording ? 'live' : ''} style={{ height: `${h * (recording ? 0.4 + (i % 5) / 7 : 0.4)}%` }} />)}
                      </div>
                      <div className="record-actions">
                        <button className={recording ? 'record-button recording' : 'record-button'} onClick={toggleRecord}>
                          <span>{recording ? <Square size={14} /> : <Mic size={15} />}</span>
                          {recording ? '结束并提交' : '开始录音'}
                        </button>
                        {activeMap.get(`${mySegment.id}::${role.id}`) && (
                          <span className="wait">当前有效：v{activeMap.get(`${mySegment.id}::${role.id}`)!.version}（再录将另存新版本）</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </section>
            )}

            {role.kind === 'teacher' && (
              <section className="panel">
                <div className="panel-head"><span className="label">REVIEW</span><h2>审核队列 <b className="pill">{pendingReviews.length}</b></h2></div>
                {pendingReviews.length === 0 && <div className="empty">暂无待审核录音</div>}
                {pendingReviews.map(rec => {
                  const seg = lesson.segments.find(s => s.id === rec.segmentId)!;
                  const cascade = returnCascadeCount(relay, lesson, rec.id);
                  return (
                    <div className="review-item" key={rec.id}>
                      <div className="review-top">
                        <strong>片段 {seg.order} · v{rec.version}</strong>
                        <span>{studentName(rec.studentId)} · {fmtSec(rec.seconds)} · {fmtTime(rec.createdAt)}</span>
                      </div>
                      <p className="review-text">{seg.text}</p>
                      <div className="review-actions">
                        <input
                          type="number" min={0} max={100}
                          value={scores[rec.id] ?? 80}
                          onChange={e => setScores(s => ({ ...s, [rec.id]: Number(e.target.value) }))}
                        />
                        <span className="fen">分</span>
                        <button className="primary" onClick={() => review(rec, 'pass')}><Check size={14} />通过</button>
                        <button className="danger" onClick={() => review(rec, 'return')}><X size={14} />退回重读</button>
                      </div>
                      <p className="review-note">退回将使片段 {seg.order} 及后续接力的 {cascade} 条有效录音退回待重录，旧成绩保留不覆盖。</p>
                    </div>
                  );
                })}
              </section>
            )}

            <section className="panel">
              <div className="panel-head">
                <span className="label"><History size={11} /> VERSIONS</span>
                <h2>版本记录 · 片段 {segOrder(historySeg)}</h2>
              </div>
              {historyList.length === 0 && <div className="empty">该片段还没有录音版本</div>}
              {historyList.map(r => {
                const isActive = activeMap.get(`${r.segmentId}::${r.studentId}`)?.id === r.id;
                const meta = recStatusMeta[r.status];
                return (
                  <div className="ver" key={r.id}>
                    <div className="ver-main">
                      <strong>v{r.version}</strong>
                      <span>{studentName(r.studentId)}</span>
                      <span className={`status ${meta.cls}`}>{meta.label}</span>
                      {isActive && <em>有效</em>}
                    </div>
                    <div className="ver-meta">
                      {r.score != null ? `${r.score} 分` : '未评分'} · {fmtSec(r.seconds)} · {fmtTime(r.createdAt)}
                      {r.note ? ` · ${r.note}` : ''}
                    </div>
                  </div>
                );
              })}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
