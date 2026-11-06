import { useState, useEffect, useRef } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  Sun,
  CheckCheck,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpRight,
  X,
  Trash2,
  Check,
  Flag,
  Clock,
  MoreHorizontal,
  Menu,
  BookOpen,
  PanelRightClose,
  ArrowRight,
  Download,
} from "lucide-react";
import { BackupPanel } from "./BackupPanel";
import {
  loadRecords,
  saveRecord,
  deleteRecord,
  subscribeToChanges,
} from "./storage";
import { routes, pageFromHash, type Page, type RecordItem as R } from "./model";
const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(s + "T12:00:00");
const add = (d: Date, n: number) => {
  const v = new Date(d);
  v.setDate(v.getDate() + n);
  return v;
};
const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const hh = (v: string) =>
  Number(v?.split(":")[0] || 0) + Number(v?.split(":")[1] || 0) / 60;
const time = (v: number) =>
  `${String(Math.floor(v)).padStart(2, "0")}:${v % 1 ? "30" : "00"}`;
export default function Tempo() {
  const [backupOpen, setBackupOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const today = day(now);
  const [date, setDate] = useState(() => new Date()),
    [page, updatePage] = useState<Page>(() =>
      pageFromHash(window.location.hash),
    ),
    [view, setView] = useState("周"),
    [rows, setRows] = useState<R[]>([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false),
    [reload, setReload] = useState(0),
    [msg, setMsg] = useState(""),
    [modal, setModal] = useState<R | null>(null),
    [saving, setSaving] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("全部"),
    [priority, setPriority] = useState("全部优先级"),
    [sort, setSort] = useState("截止日期"),
    [dueFilter, setDueFilter] = useState("全部日期"),
    [visible, setVisible] = useState(["task", "session", "event"]),
    [menu, setMenu] = useState(false),
    [agenda, setAgenda] = useState(true),
    [selected, setSelected] = useState(today);
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60000);
    Promise.resolve().then(() => {
      setNow(new Date());
      setDate(new Date());
      setSelected(day(new Date()));
    });
    return () => clearInterval(tick);
  }, []);
  const dialog = useRef<HTMLDialogElement>(null);
  const calendarScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (calendarScroll.current) calendarScroll.current.scrollTop = 7 * 68;
  }, [page, view]);
  const notify = (s: string) => {
    setMsg(s);
    setTimeout(() => setMsg(""), 3500);
  };

  const onAccount = () => setBackupOpen(true);
  useEffect(() => subscribeToChanges(() => setReload((n) => n + 1)), []);
  function setPage(next: string) {
    const p = next as Page;
    if (routes[p]) window.location.hash = routes[p];
  }
  useEffect(() => {
    const change = () => updatePage(pageFromHash(window.location.hash));
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setLoadError(false);
      }
    });
    loadRecords()
      .then((data) => {
        if (active) setRows(data);
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
          notify("本机数据读取失败，请检查浏览器存储权限后重试");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const isModalOpen = !!modal;
  useEffect(() => {
    if (isModalOpen) {
      dialog.current?.showModal();
      setTimeout(() => dialog.current?.querySelector("input")?.focus(), 40);
    } else dialog.current?.close();
  }, [isModalOpen]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPage("全部任务");
        setTimeout(() => document.getElementById("search")?.focus(), 50);
      }
      if (e.key === "Escape") {
        setModal(null);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const tasks = rows.filter((r) => r.kind === "task");
  const urgent = (r: R) => r.urgent || (!!r.due && r.due <= day(add(now, 1)));
  const quadrant = (r: R) =>
    r.important ? (urgent(r) ? 0 : 1) : urgent(r) ? 2 : 3;
  const titles = ["立即行动", "计划安排", "尽快处理", "低优先级"];
  const newItem = (kind: R["kind"] = "task", d = selected, s?: string) =>
    setModal({
      id: "",
      kind,
      title: "",
      due: kind === "task" ? d : "",
      date: d,
      start: s || "09:00",
      end: hh(s || "09:00") >= 23 ? "23:59" : time(hh(s || "09:00") + 1),
      color: "blue",
    });
  async function save(r: R, close = true) {
    if (!r.title.trim()) return notify("请输入标题");
    if (
      r.kind !== "task" &&
      !r.allDay &&
      (!r.start || !r.end || r.end <= r.start)
    )
      return notify("结束时间必须晚于开始时间");
    setSaving(true);
    try {
      const saved = await saveRecord(r);
      setRows((rs) => [...rs.filter((x) => x.id !== saved.id), saved]);
      if (close) setModal(null);
      notify("已保存到本机");
    } catch (e: unknown) {
      notify((e instanceof Error ? e.message : "") || "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }
  async function remove(r: R) {
    if (!confirm("删除此记录？关联学习时段也会一并移除。")) return;
    try {
      await deleteRecord(r);
      setRows((v) => v.filter((x) => x.id !== r.id && x.taskId !== r.id));
      setModal(null);
      notify("已删除");
    } catch {
      notify("删除失败，请重试");
    }
  }
  const complete = (r: R) =>
    save(
      {
        ...r,
        completed: !r.completed,
        completedAt: !r.completed ? new Date().toISOString() : undefined,
      },
      false,
    );
  const dueToday = tasks.filter(
    (t) =>
      t.due === today ||
      rows.some((s) => s.taskId === t.id && s.date === today),
  );
  const pct = dueToday.length
    ? Math.round(
        (dueToday.filter((t) => t.completed).length / dueToday.length) * 100,
      )
    : 0;
  const entries = (d: string) =>
    rows.filter(
      (r) =>
        visible.includes(r.kind) &&
        (r.kind === "task" ? r.due === d : r.date === d),
    );
  const weekStart = add(date, -((date.getDay() + 6) % 7));
  const days =
    view === "日"
      ? [date]
      : Array.from({ length: 7 }, (_, i) => add(weekStart, i));
  function nav(n: number) {
    const next =
      view === "月"
        ? new Date(
            date.getFullYear(),
            date.getMonth() + n,
            Math.min(date.getDate(), 28),
          )
        : add(date, n * (view === "周" ? 7 : 1));
    setDate(next);
    setSelected(day(next));
  }
  const miniStart = add(
    new Date(date.getFullYear(), date.getMonth(), 1),
    -((new Date(date.getFullYear(), date.getMonth(), 1).getDay() + 6) % 7),
  );
  const openEntry = (r: R) => setModal(r);
  const TaskRow = ({ r }: { r: R }) => (
    <div className={"task-row " + (r.completed ? "done" : "")}>
      <button
        className="checkbox"
        aria-label={r.completed ? "重新打开任务" : "完成任务"}
        onClick={() => complete(r)}
      >
        {r.completed && <Check size={12} />}
      </button>
      <button className="task-content" onClick={() => openEntry(r)}>
        <span>{r.title}</span>
        <small>
          {r.due ? `${r.due.slice(5).replace("-", "月")}日` : "无截止日期"}
          {rows.some((s) => s.taskId === r.id) && " · 已安排学习时段"}
        </small>
      </button>
      <span className={"priority p" + quadrant(r)}>{titles[quadrant(r)]}</span>
    </div>
  );
  return (
    <div className="app" data-ui>
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("日历");
          }}
        >
          <svg width="30" height="32" viewBox="0 0 30 32">
            <path
              d="M4 8h22M15 8v20M8 16h14"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle cx="15" cy="3" r="2" fill="currentColor" />
          </svg>
          Tempo
          <span className="brand-dot" />
        </a>
        <div className="workspace">
          <span className="workspace-avatar">自</span>
          <div>
            个人空间<small>让每一天，有条不紊</small>
          </div>
        </div>
        <button
          className="sidebar-search"
          onClick={() => {
            setPage("全部任务");
            setTimeout(() => document.getElementById("search")?.focus(), 50);
          }}
        >
          <Search size={15} />
          搜索任务<span>⌘ K</span>
        </button>
        <nav>
          {(
            [
              [LayoutDashboard, "概览"],
              [Sun, "今日"],
              [CheckCheck, "全部任务"],
              [CalendarDays, "日历"],
            ] as [typeof CalendarDays, string][]
          ).map(([Icon, label]) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              onClick={() => {
                setPage(label);
                setMenu(false);
              }}
            >
              <Icon size={18} />
              {label}
              {label === "今日" && (
                <span className="nav-count">
                  {dueToday.filter((t) => !t.completed).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mini">
          <div className="mini-heading">
            <b>
              {date.getFullYear()}年 {date.getMonth() + 1}月
            </b>
            <button
              aria-label="上个月"
              onClick={() =>
                setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={14} />
            </button>
            <button
              aria-label="下个月"
              onClick={() =>
                setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="mini-grid">
            {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
              <span key={w}>{w}</span>
            ))}
            {Array.from({ length: 42 }, (_, i) => {
              const d = add(miniStart, i);
              return (
                <button
                  key={i}
                  className={
                    (day(d) === today ? "today " : "") +
                    (day(d) === selected ? "selected " : "") +
                    (d.getMonth() !== date.getMonth() ? "other" : "")
                  }
                  onClick={() => {
                    setSelected(day(d));
                    setDate(d);
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
        <div className="calendars">
          <div className="side-label">我的日历</div>
          {[
            ["session", "学习计划", "blue"],
            ["task", "任务截止", "green"],
            ["event", "个人日程", "orange"],
          ].map(([k, l, c]) => (
            <button
              key={k}
              onClick={() =>
                setVisible((v) =>
                  v.includes(k) ? v.filter((a) => a !== k) : [...v, k],
                )
              }
            >
              <span
                className={
                  "legend-check " + c + (visible.includes(k) ? "" : " off")
                }
              >
                <Check size={10} />
              </span>
              {l}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="quiet-note">
            <BookOpen size={18} />
            <p>
              留一点空白，
              <br />
              给更好的自己。
            </p>
          </div>
          <button className="profile" onClick={onAccount}>
            <span className="avatar">我</span>
            <span>
              我的工作空间
              <small>本机保存 · 导入 / 导出</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <button
              className="mobile-menu"
              aria-label="打开导航"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              个人空间 <ChevronRight size={13} /> <strong>{page}</strong>
            </span>
          </div>
          <div className="top-actions">
            <span className="cloud-dot" />
            {loading ? "正在读取" : loadError ? "读取失败" : "已保存在此浏览器"}
            <button className="outline" onClick={onAccount}>
              <Download size={13} />
              备份
            </button>
            <button
              className="top-avatar"
              aria-label="本机数据与备份"
              onClick={onAccount}
            >
              我
            </button>
          </div>
        </header>
        <div className="page-heading">
          <div>
            <h1>
              {page === "日历"
                ? "把时间，留给重要的事。"
                : page === "概览"
                  ? "每一步，都算数。"
                  : page === "今日"
                    ? "今天，从容开始。"
                    : "所有想做的事，都在这里。"}
            </h1>
            <p>
              {page === "日历"
                ? "看见你的安排，找到自己的节奏。"
                : `${now.getMonth() + 1}月${now.getDate()}日，${["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][now.getDay()]} · 按自己的节奏，向前一点。`}
            </p>
          </div>
          <button
            className="primary"
            onClick={() => newItem(page === "日历" ? "event" : "task")}
          >
            <Plus size={17} />
            新建{page === "日历" ? "日程" : "任务"}
          </button>
        </div>
        {loadError && (
          <div className="welcome" role="alert">
            <span>无法读取本机记录。请检查浏览器存储权限后重试。</span>
            <button onClick={() => setReload((v) => v + 1)}>重试</button>
          </div>
        )}
        {!loading && !loadError && !rows.length && (
          <div className="welcome">
            <span>一个新的开始。创建第一项任务，安排自己的节奏。</span>
            <button onClick={() => newItem("task")}>
              新建任务 <ArrowRight size={14} />
            </button>
          </div>
        )}
        {page === "日历" ? (
          <>
            <div className="calendar-toolbar">
              <div className="date-nav">
                <h2>
                  {date.getFullYear()}年 {date.getMonth() + 1}月
                </h2>
                <div className="arrows">
                  <button aria-label="上一时间段" onClick={() => nav(-1)}>
                    <ChevronLeft size={17} />
                  </button>
                  <button aria-label="下一时间段" onClick={() => nav(1)}>
                    <ChevronRight size={17} />
                  </button>
                </div>
                <button
                  className="outline"
                  onClick={() => {
                    setDate(now);
                    setSelected(today);
                  }}
                >
                  今天
                </button>
                <label className="jump-date">
                  <CalendarDays size={15} />
                  <input
                    aria-label="跳转日期"
                    type="date"
                    value={day(date)}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDate(parse(e.target.value));
                        setSelected(e.target.value);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="toolbar-right">
                <div className="segmented">
                  {["月", "周", "日"].map((v) => (
                    <button
                      className={view === v ? "chosen" : ""}
                      key={v}
                      onClick={() => setView(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <button
                  aria-label="显示或隐藏当日安排"
                  className="icon-button"
                  onClick={() => setAgenda(!agenda)}
                >
                  <PanelRightClose size={18} />
                </button>
              </div>
            </div>
            <div className={"calendar-layout " + (!agenda ? "wide" : "")}>
              <section className="calendar-panel" aria-label="学习日历">
                {view === "月" ? (
                  <div className="month-view">
                    <div className="month-week">
                      {weekdays.map((w) => (
                        <span key={w}>{w}</span>
                      ))}
                    </div>
                    <div className="month-grid">
                      {Array.from({ length: 42 }, (_, i) => {
                        const d = add(miniStart, i),
                          ds = day(d);
                        return (
                          <div
                            key={ds}
                            className={
                              "month-cell " +
                              (d.getMonth() !== date.getMonth()
                                ? "muted-cell"
                                : "")
                            }
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const r = rows.find(
                                (a) => a.id === e.dataTransfer.getData("text"),
                              );
                              if (r)
                                save(
                                  {
                                    ...r,
                                    ...(r.kind === "task"
                                      ? { due: ds }
                                      : { date: ds }),
                                  },
                                  false,
                                );
                            }}
                          >
                            <button
                              className={
                                "month-number " +
                                (ds === today ? "is-today" : "")
                              }
                              onClick={() => {
                                setSelected(ds);
                                newItem("event", ds);
                              }}
                            >
                              {d.getDate()}
                            </button>
                            {entries(ds).map((r) => (
                              <button
                                key={r.id}
                                draggable
                                onDragStart={(e) =>
                                  e.dataTransfer.setData("text", r.id)
                                }
                                className={
                                  "month-event " +
                                  (r.kind === "task"
                                    ? "deadline"
                                    : r.color || "blue") +
                                  (r.completed ? " completed" : "")
                                }
                                onClick={() => openEntry(r)}
                              >
                                {r.kind === "task" ? "◇ " : r.start + " "}
                                {r.title}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="week-scroll" ref={calendarScroll}>
                    <div
                      className="week-inner"
                      style={{ minWidth: view === "日" ? 250 : 650 }}
                    >
                      <div
                        className="week-head"
                        style={{
                          gridTemplateColumns: `54px repeat(${days.length},1fr)`,
                        }}
                      >
                        <div className="timezone">
                          GMT
                          <br />+{-(now.getTimezoneOffset() / 60)}
                        </div>
                        {days.map((d) => (
                          <button
                            className={
                              "day-heading " +
                              (day(d) === today ? "current" : "")
                            }
                            key={day(d)}
                            onClick={() => {
                              setSelected(day(d));
                              setDate(d);
                              setView("日");
                            }}
                          >
                            <span>{weekdays[(d.getDay() + 6) % 7]}</span>
                            <b>{d.getDate()}</b>
                          </button>
                        ))}
                      </div>
                      <div
                        className="all-day"
                        style={{
                          gridTemplateColumns: `54px repeat(${days.length},1fr)`,
                        }}
                      >
                        <span>全天</span>
                        {days.map((d) => (
                          <div
                            key={day(d)}
                            onDoubleClick={() => newItem("task", day(d))}
                          >
                            {entries(day(d))
                              .filter((r) => r.kind === "task" || r.allDay)
                              .map((r) => (
                                <button
                                  key={r.id}
                                  className={
                                    "deadline " +
                                    (r.completed ? "completed" : "")
                                  }
                                  onClick={() => openEntry(r)}
                                >
                                  <span>◇</span> {r.title}
                                </button>
                              ))}
                          </div>
                        ))}
                      </div>
                      <div
                        className="time-grid"
                        style={{
                          gridTemplateColumns: `54px repeat(${days.length},1fr)`,
                        }}
                      >
                        <div className="time-labels">
                          {Array.from({ length: 24 }, (_, i) => (
                            <span key={i} style={{ top: i * 68 }}>
                              {String(i).padStart(2, "0")}:00
                            </span>
                          ))}
                        </div>
                        {days.map((d) => {
                          const ds = day(d);
                          return (
                            <div
                              className={
                                "day-column " +
                                (ds === today ? "current-column" : "")
                              }
                              key={ds}
                            >
                              {Array.from({ length: 48 }, (_, i) => (
                                <button
                                  className="time-slot"
                                  key={i}
                                  aria-label={`${ds} ${time(i / 2)} 新建日程`}
                                  onClick={() => {
                                    setSelected(ds);
                                    newItem("event", ds, time(i / 2));
                                  }}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const r = rows.find(
                                      (a) =>
                                        a.id === e.dataTransfer.getData("text"),
                                    );
                                    if (r) {
                                      const duration =
                                        hh(r.end || "10:00") -
                                        hh(r.start || "09:00");
                                      save(
                                        {
                                          ...r,
                                          date: ds,
                                          start: time(i / 2),
                                          end: time(i / 2 + duration),
                                        },
                                        false,
                                      );
                                    }
                                  }}
                                />
                              ))}
                              {entries(ds)
                                .filter((r) => r.kind !== "task" && !r.allDay)
                                .map((r, i, all) => {
                                  const overlaps = all.filter(
                                    (a) =>
                                      hh(a.start!) < hh(r.end!) &&
                                      hh(a.end!) > hh(r.start!),
                                  );
                                  const idx = overlaps.findIndex(
                                    (a) => a.id === r.id,
                                  );
                                  const task = tasks.find(
                                    (t) => t.id === r.taskId,
                                  );
                                  return (
                                    <button
                                      draggable
                                      onDragStart={(e) =>
                                        e.dataTransfer.setData("text", r.id)
                                      }
                                      key={r.id}
                                      className={
                                        "calendar-event " +
                                        r.color +
                                        (task?.completed ? " completed" : "")
                                      }
                                      style={{
                                        top: hh(r.start!) * 68 + 3,
                                        height: Math.max(
                                          30,
                                          (hh(r.end!) - hh(r.start!)) * 68 - 6,
                                        ),
                                        left: `calc(${(idx / overlaps.length) * 100}% + 5px)`,
                                        width: `calc(${100 / overlaps.length}% - 9px)`,
                                      }}
                                      onClick={() => openEntry(r)}
                                    >
                                      <span className="event-time">
                                        {r.start} – {r.end}
                                      </span>
                                      <strong>{r.title}</strong>
                                      <span className="event-kind">
                                        {r.kind === "session"
                                          ? "↗ 学习计划"
                                          : "个人日程"}
                                      </span>
                                    </button>
                                  );
                                })}
                              {ds === today && true && (
                                <div
                                  className="now-line"
                                  style={{
                                    top:
                                      (now.getHours() + now.getMinutes() / 60) *
                                      68,
                                  }}
                                >
                                  <i />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                <div className="calendar-footer">
                  <span>
                    <i className="dot blue" />
                    学习计划
                  </span>
                  <span>
                    <i className="diamond" />
                    任务截止
                  </span>
                  <span>
                    <i className="dot orange" />
                    个人日程
                  </span>
                  <small>点击空白时段，安排新日程</small>
                </div>
              </section>
              {agenda && (
                <aside className="agenda">
                  <div className="agenda-heading">
                    <h3>当日安排</h3>
                    <span>
                      {parse(selected).getMonth() + 1}月
                      {parse(selected).getDate()}日
                    </span>
                  </div>
                  <div className="daily-progress">
                    <div>
                      <span>任务进度</span>
                      <b>
                        {
                          tasks.filter((t) => t.due === selected && t.completed)
                            .length
                        }
                        <small>
                          {" "}
                          / {tasks.filter((t) => t.due === selected).length}
                        </small>
                      </b>
                    </div>
                    <div className="progress-track">
                      <i
                        style={{
                          width: `${tasks.filter((t) => t.due === selected).length ? (tasks.filter((t) => t.due === selected && t.completed).length / tasks.filter((t) => t.due === selected).length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <h4>
                    日程{" "}
                    <span>
                      {
                        rows.filter(
                          (r) => r.kind !== "task" && r.date === selected,
                        ).length
                      }
                    </span>
                  </h4>
                  <div className="agenda-list">
                    {rows
                      .filter((r) => r.kind !== "task" && r.date === selected)
                      .sort((a, b) =>
                        (a.start || "").localeCompare(b.start || ""),
                      )
                      .map((r) => (
                        <button
                          key={r.id}
                          className="agenda-item"
                          onClick={() => openEntry(r)}
                        >
                          <span className={"agenda-marker " + r.color} />
                          <div>
                            <small>
                              {r.allDay ? "全天" : r.start + " – " + r.end}
                            </small>
                            <strong>{r.title}</strong>
                            <span>
                              {r.kind === "session" ? "学习计划" : "个人日程"}
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                  <button
                    className="add-dashed"
                    onClick={() => newItem("event", selected)}
                  >
                    <Plus size={14} />
                    添加日程
                  </button>
                  <h4 className="deadline-title">
                    待办与截止{" "}
                    <span>
                      {tasks.filter((t) => t.due === selected).length}
                    </span>
                  </h4>
                  {tasks
                    .filter((t) => t.due === selected)
                    .map((r) => (
                      <div
                        className={"agenda-task " + (r.completed ? "done" : "")}
                        key={r.id}
                      >
                        <button
                          className="checkbox"
                          onClick={() => complete(r)}
                          aria-label="切换任务完成状态"
                        >
                          {r.completed && <Check size={11} />}
                        </button>
                        <button onClick={() => openEntry(r)}>
                          {r.title}
                          <small>
                            {r.completed
                              ? "已完成"
                              : urgent(r)
                                ? "今日优先处理"
                                : "等待开始"}
                          </small>
                        </button>
                      </div>
                    ))}
                  {!entries(selected).length && (
                    <p className="empty-small">
                      今天还没有安排。
                      <br />
                      为重要的事留出时间吧。
                    </p>
                  )}
                  <div className="breathing-room">
                    <span>时间有序，心里有余。</span>
                    <p>
                      不必填满每一分钟，
                      <br />
                      也别忘了给自己一点休息。
                    </p>
                    <svg viewBox="0 0 180 66" aria-hidden="true">
                      <path
                        d="M5 55 Q30 5 55 37 T105 30 T170 20"
                        fill="none"
                        stroke="#b7c2ba"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M5 62 Q45 21 70 45 T170 40"
                        fill="none"
                        stroke="#d3d9d4"
                      />
                    </svg>
                  </div>
                </aside>
              )}
            </div>
          </>
        ) : (
          <div className="other-page">
            {page === "概览" ? (
              <>
                <div className="stats">
                  {[
                    ["待完成", tasks.filter((t) => !t.completed).length],
                    ["已完成", tasks.filter((t) => t.completed).length],
                    ["今日截止", tasks.filter((t) => t.due === today).length],
                    [
                      "已逾期",
                      tasks.filter(
                        (t) => !t.completed && t.due && t.due < today,
                      ).length,
                    ],
                  ].map(([l, n]) => (
                    <div key={l}>
                      <span>{l}</span>
                      <b>{n}</b>
                    </div>
                  ))}
                </div>
                <div className="overview-progress">
                  <div>
                    <h2>今天的进展</h2>
                    <p>每完成一件，就离目标更近一点。</p>
                  </div>
                  <strong>{pct}%</strong>
                  <div className="progress-track">
                    <i style={{ width: pct + "%" }} />
                  </div>
                </div>
                <div className="section-title">
                  <h2>重要的事，优先安排</h2>
                  <button onClick={() => newItem()}>
                    <Plus size={15} />
                    新建任务
                  </button>
                </div>
                <div className="matrix">
                  {titles.map((t, i) => (
                    <section key={t}>
                      <h3>
                        <Flag size={15} />
                        {t}
                        <span>
                          {
                            tasks.filter(
                              (r) => quadrant(r) === i && !r.completed,
                            ).length
                          }
                        </span>
                      </h3>
                      <p>
                        {
                          [
                            "重要且紧急",
                            "重要，不紧急",
                            "紧急，不重要",
                            "不紧急，不重要",
                          ][i]
                        }
                      </p>
                      {tasks
                        .filter((r) => quadrant(r) === i && !r.completed)
                        .map((r) => (
                          <TaskRow key={r.id} r={r} />
                        ))}
                      {!tasks.some(
                        (r) => quadrant(r) === i && !r.completed,
                      ) && <p className="empty-small">暂时没有待办任务</p>}
                    </section>
                  ))}
                </div>
                <div className="overview-bottom">
                  <section>
                    <h2>即将截止</h2>
                    {tasks
                      .filter((t) => t.due && !t.completed)
                      .sort((a, b) => a.due!.localeCompare(b.due!))
                      .slice(0, 5)
                      .map((r) => (
                        <TaskRow key={r.id} r={r} />
                      ))}
                  </section>
                  <section>
                    <div className="section-title">
                      <h2>接下来的安排</h2>
                      <button onClick={() => setPage("日历")}>
                        打开日历 <ArrowUpRight size={14} />
                      </button>
                    </div>
                    {rows
                      .filter((r) => r.kind !== "task" && r.date! >= today)
                      .sort((a, b) =>
                        (a.date + a.start!).localeCompare(b.date + b.start!),
                      )
                      .slice(0, 4)
                      .map((r) => (
                        <button
                          className="schedule-row"
                          key={r.id}
                          onClick={() => openEntry(r)}
                        >
                          <Clock size={16} />
                          <span>
                            {r.title}
                            <small>
                              {r.date} · {r.start}–{r.end}
                            </small>
                          </span>
                        </button>
                      ))}
                    <button
                      className="add-dashed"
                      onClick={() => newItem("event")}
                    >
                      ＋ 新建日程
                    </button>
                  </section>
                </div>
              </>
            ) : (
              <>
                <div className="task-tools">
                  <div className="tabs">
                    {["全部", "待完成", "已完成"].map((s) => (
                      <button
                        className={status === s ? "selected" : ""}
                        key={s}
                        onClick={() => setStatus(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="filters">
                    <label className="search-input">
                      <Search size={15} />
                      <input
                        id="search"
                        placeholder="搜索任务或描述…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="优先级筛选"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      {["全部优先级", ...titles].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                    <select
                      aria-label="截止日期筛选"
                      value={dueFilter}
                      onChange={(e) => setDueFilter(e.target.value)}
                    >
                      {["全部日期", "今日截止", "已逾期", "无截止日期"].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                    <select
                      aria-label="排序"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      {["截止日期", "创建日期", "优先级"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="task-table">
                  <div className="task-table-heading">
                    <span>任务名称</span>
                    <span>优先级</span>
                  </div>
                  {tasks
                    .filter(
                      (r) =>
                        (page !== "今日" ||
                          r.due === today ||
                          (r.due && r.due < today && !r.completed) ||
                          rows.some(
                            (s) => s.taskId === r.id && s.date === today,
                          )) &&
                        (status === "全部" ||
                          (status === "已完成") === !!r.completed) &&
                        (priority === "全部优先级" ||
                          titles[quadrant(r)] === priority) &&
                        (dueFilter === "全部日期" ||
                          (dueFilter === "今日截止" && r.due === today) ||
                          (dueFilter === "已逾期" &&
                            r.due &&
                            r.due < today &&
                            !r.completed) ||
                          (dueFilter === "无截止日期" && !r.due)) &&
                        (r.title + " " + r.description)
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )
                    .sort((a, b) =>
                      sort === "优先级"
                        ? quadrant(a) - quadrant(b)
                        : sort === "创建日期"
                          ? (b.createdAt || "").localeCompare(a.createdAt || "")
                          : (a.due || "9999").localeCompare(b.due || "9999"),
                    )
                    .map((r) => (
                      <TaskRow key={r.id} r={r} />
                    ))}
                  <button className="add-task-row" onClick={() => newItem()}>
                    <Plus size={16} />
                    添加一个新任务
                  </button>
                </div>
                {page === "今日" && (
                  <section className="today-events">
                    <h2>今天的日程</h2>
                    {rows
                      .filter((r) => r.kind === "event" && r.date === today)
                      .sort((a, b) =>
                        (a.start || "").localeCompare(b.start || ""),
                      )
                      .map((r) => (
                        <button
                          className="schedule-row"
                          key={r.id}
                          onClick={() => openEntry(r)}
                        >
                          <Clock size={16} />
                          <span>
                            {r.title}
                            <small>
                              {r.start}–{r.end}
                            </small>
                          </span>
                        </button>
                      ))}
                    <button
                      className="add-dashed"
                      onClick={() => newItem("event", today)}
                    >
                      ＋ 添加日程
                    </button>
                  </section>
                )}
              </>
            )}
          </div>
        )}
        <footer className="page-footer">
          <span>Tempo — 找到你的节奏</span>
          <span>本机保存 · 请定期备份</span>
        </footer>
      </main>
      {backupOpen && <BackupPanel onClose={() => setBackupOpen(false)} />}
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setModal(null);
        }}
      >
        {modal && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(modal);
            }}
          >
            <div className="modal-heading">
              <h2>
                {modal.id ? "编辑" : "新建"}
                {modal.kind === "task"
                  ? "任务"
                  : modal.kind === "session"
                    ? "学习时段"
                    : "日程"}
              </h2>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            {!modal.id && (
              <div className="modal-tabs">
                {[
                  ["task", "任务"],
                  ["event", "日程"],
                  ["session", "安排已有任务"],
                ].map(([k, l]) => (
                  <button
                    type="button"
                    key={k}
                    className={modal.kind === k ? "selected" : ""}
                    onClick={() =>
                      setModal({
                        ...modal,
                        kind: k as R["kind"],
                        due: modal.due || selected,
                        date: modal.date || selected,
                      })
                    }
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
            {modal.kind === "session" && (
              <label>
                关联任务
                <select
                  required
                  value={modal.taskId || ""}
                  onChange={(e) => {
                    const t = tasks.find((a) => a.id === e.target.value);
                    setModal({
                      ...modal,
                      taskId: e.target.value,
                      title: t?.title || "",
                    });
                  }}
                >
                  <option value="">选择需要安排的任务</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              标题
              <input
                required
                maxLength={300}
                placeholder={
                  modal.kind === "task"
                    ? "想要完成什么？"
                    : "为这段时间起个名字"
                }
                value={modal.title}
                onChange={(e) => setModal({ ...modal, title: e.target.value })}
              />
            </label>
            <label>
              描述与笔记
              <textarea
                rows={3}
                placeholder="添加一些细节…"
                value={modal.description || ""}
                onChange={(e) =>
                  setModal({ ...modal, description: e.target.value })
                }
              />
            </label>
            {modal.kind === "task" ? (
              <>
                <div className="form-two">
                  <label>
                    截止日期
                    <input
                      type="date"
                      value={modal.due || ""}
                      onChange={(e) =>
                        setModal({ ...modal, due: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    截止时间
                    <input
                      type="time"
                      value={modal.dueTime || ""}
                      onChange={(e) =>
                        setModal({ ...modal, dueTime: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="check-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={!!modal.important}
                      onChange={(e) =>
                        setModal({ ...modal, important: e.target.checked })
                      }
                    />
                    重要
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!modal.urgent}
                      onChange={(e) =>
                        setModal({ ...modal, urgent: e.target.checked })
                      }
                    />
                    手动设为紧急
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!modal.completed}
                      onChange={(e) =>
                        setModal({ ...modal, completed: e.target.checked })
                      }
                    />
                    已完成
                  </label>
                </div>
                <p className="form-help">
                  截止时间不足一天的任务会自动进入紧急象限。
                </p>
                {modal.id && (
                  <div className="linked-sessions">
                    <h3>学习时段</h3>
                    {rows
                      .filter((s) => s.taskId === modal.id)
                      .map((s) => (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => setModal(s)}
                        >
                          {s.date} · {s.start}–{s.end}{" "}
                          <ChevronRight size={14} />
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() =>
                        setModal({
                          id: "",
                          kind: "session",
                          taskId: modal.id,
                          title: modal.title,
                          date: selected,
                          start: "09:00",
                          end: "10:00",
                          color: "blue",
                        })
                      }
                    >
                      ＋ 安排学习时段
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="form-two">
                  <label>
                    日期
                    <input
                      required
                      type="date"
                      value={modal.date || ""}
                      onChange={(e) =>
                        setModal({ ...modal, date: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    类别
                    <select
                      value={modal.color || "blue"}
                      onChange={(e) =>
                        setModal({ ...modal, color: e.target.value })
                      }
                    >
                      <option value="blue">蓝 · 学习</option>
                      <option value="green">绿 · 阅读</option>
                      <option value="orange">橙 · 个人</option>
                    </select>
                  </label>
                </div>
                <label className="check-inline">
                  <input
                    type="checkbox"
                    checked={!!modal.allDay}
                    onChange={(e) =>
                      setModal({ ...modal, allDay: e.target.checked })
                    }
                  />
                  全天日程
                </label>
                {!modal.allDay && (
                  <div className="form-two">
                    <label>
                      开始时间
                      <input
                        required
                        type="time"
                        value={modal.start || ""}
                        onChange={(e) =>
                          setModal({ ...modal, start: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      结束时间
                      <input
                        required
                        type="time"
                        value={modal.end || ""}
                        onChange={(e) =>
                          setModal({ ...modal, end: e.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
                {modal.kind === "session" && (
                  <p className="form-help">
                    学习时段独立于截止日期。修改此时段不会改变任务截止日期。
                  </p>
                )}
                {modal.taskId && (
                  <button
                    type="button"
                    className="linked-task"
                    onClick={() =>
                      setModal(tasks.find((t) => t.id === modal.taskId) || null)
                    }
                  >
                    打开关联任务 <ArrowUpRight size={14} />
                  </button>
                )}
              </>
            )}
            <div className="modal-footer">
              {modal.id && (
                <button
                  type="button"
                  className="delete"
                  onClick={() => remove(modal)}
                >
                  <Trash2 size={16} />
                  删除
                </button>
              )}
              <button
                type="button"
                className="outline"
                onClick={() => setModal(null)}
              >
                取消
              </button>
              <button className="primary" disabled={saving}>
                {saving
                  ? "保存中…"
                  : "保存" + (modal.kind === "task" ? "任务" : "日程")}
              </button>
            </div>
          </form>
        )}
      </dialog>
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </div>
  );
}
