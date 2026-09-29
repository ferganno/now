/* ==========================================================================
   NOW — JavaScript Application Engine
   Single Next-Step Philosophy • Micro-Action Atomizer • Jony Ive Simplicity
   ========================================================================== */

// --- Default Seed Tasks: короткий гайд из двух шагов ---
const INITIAL_TASKS = [
  {
    id: "task-welcome",
    parentGoal: "Гайд · 1 из 2",
    action: "Нажми «Начать», а потом «Готово!»",
    reason: "Так работает NOW: одна карточка — одно действие. Заверши шаг, и он исчезнет.",
    durationMinutes: 1,
    lazyVersion: "Просто нажми «Начать» (5 сек)"
  },
  {
    id: "task-guide-dump",
    parentGoal: "Гайд · 2 из 2",
    action: "Нажми «+ Выгрузи мысль» внизу и напиши: «Позвонить маме завтра в 18:00, купить хлеб»",
    reason: "Каждое дело станет отдельной задачей. Срок пишется прямо в тексте — за час до него придёт уведомление. Все задачи, списки и сроки — в меню ☰ справа сверху.",
    durationMinutes: 2,
    lazyVersion: "Просто открой «+ Выгрузи мысль» внизу (5 сек)"
  }
];

const STORAGE = {
  tasks: "now_app_tasks",
  lists: "now_app_lists",
  theme: "now_app_theme",
  done: "now_done_today",
  pomo: "now_pomo_settings",
  notifAsked: "now_notif_asked",
  iosBanner: "now_ios_banner_dismissed"
};

// Безопасная работа с localStorage (приватный режим Safari может бросать ошибки)
const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage недоступен */ }
  }
};

// Ключевое слово совпадает только с НАЧАЛОМ слова ("виз" не ловит "телевизор")
const L = "а-яёa-z0-9";
function wordRegex(keywords) {
  return new RegExp(`(?:^|[^${L}])(?:${keywords.join("|")})`, "i");
}

// Категория только подписывает задачу — текст пользователя никогда не заменяется шаблоном
const PARENT_CATEGORIES = [
  { keys: ["купит", "куплю", "магазин", "заказат", "покупк"], label: "Покупки" },
  { keys: ["позвон", "написат", "ответит", "сообщ", "связат", "мам[аеуыо]?(?![а-яё])", "мамой", "пап[аеуыо]?(?![а-яё])", "папой", "бабушк", "дедушк", "друг"], label: "Общение" },
  { keys: ["убор", "убра", "постир", "стирк", "помыт", "посуд", "пылесос", "мусор"], label: "Порядок" },
  { keys: ["оплат", "сч[её]т", "банк", "деньг", "перевод", "интернет", "жкх"], label: "Финансы" },
  { keys: ["урок", "школ", "учеб", "учёб", "экзамен", "дз(?![а-яё])", "книг", "чита"], label: "Учёба" },
  { keys: ["работ", "проект", "презентац", "слайд", "отч[её]т", "клиент", "письм", "email"], label: "Работа" },
  { keys: ["спорт", "бег(?![а-яё])", "бегат", "зарядк", "трениров", "йог", "прогулк", "погулят"], label: "Здоровье" },
  { keys: ["приготов", "еда", "еду", "обед", "ужин", "завтрак", "рецепт"], label: "Готовка" },
  { keys: ["документ", "виз[аеуы](?![а-яё])", "паспорт", "справк", "заявлен"], label: "Документы" },
  { keys: ["подар", "праздник", "день рожден"], label: "Праздники" }
].map(c => ({ label: c.label, regex: wordRegex(c.keys) }));

const DEFAULT_LISTS = [
  { id: "inbox", name: "Входящие", emoji: "📥" },
  { id: "personal", name: "Личное", emoji: "🏠" },
  { id: "work", name: "Работа", emoji: "💼" },
  { id: "shopping", name: "Покупки", emoji: "🛒" }
];

// Умные списки (как «Мой день» / «Запланировано» / «Важное» в Microsoft To Do)
const SMART_VIEWS = [
  { id: "myday", name: "Мой день", emoji: "☀️" },
  { id: "planned", name: "Запланировано", emoji: "📅" },
  { id: "important", name: "Важное", emoji: "★" },
  { id: "all", name: "Все", emoji: "∞" },
  { id: "done", name: "Выполнено", emoji: "✓" }
];

const REPEAT_LABELS = { none: "Не повторять", daily: "Каждый день", weekdays: "По будням", weekly: "Каждую неделю", monthly: "Каждый месяц", yearly: "Каждый год" };
const PRIORITY_LABELS = ["Нет", "Низкий", "Средний", "Высокий"];

const TIMER_TICK_MS = 250;
const TIMER_CIRCUMFERENCE = 553; // 2 * PI * 88
const HOUR_MS = 3600000;
const DEADLINE_CHECK_MS = 20000;
const STALE_ALERT_MS = 12 * HOUR_MS; // старые просрочки при открытии не спамим уведомлениями

function pad2(n) { return String(n).padStart(2, "0"); }

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Срок хранится как местное время "YYYY-MM-DDTHH:MM" — без сдвигов из-за часовых поясов
function toLocalISO(d) {
  return `${localDateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseLocalISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s || "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // отбрасываем несуществующие даты вроде 31.02 и время вне 00:00–23:59
  if (d.getDate() !== +m[3] || +m[4] > 23 || +m[5] > 59) return null;
  return d;
}

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }

const WEEKDAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

// Время по умолчанию, когда выбрана только дата: сегодня — ближайший час, иначе 09:00
function defaultTimeFor(date, now = new Date()) {
  if (daysBetween(now, date) === 0) {
    const h = now.getHours() + 1;
    return h > 23 ? "23:59" : `${pad2(h)}:00`;
  }
  return "09:00";
}

function formatDue(iso, now = new Date()) {
  const d = parseLocalISO(iso);
  if (!d) return "";
  const diff = daysBetween(now, d);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  let day;
  if (diff === 0) day = "Сегодня";
  else if (diff === 1) day = "Завтра";
  else if (diff === -1) day = "Вчера";
  else {
    day = `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
    if (d.getFullYear() !== now.getFullYear()) day += ` ${d.getFullYear()}`;
  }
  return `${day}, ${time}`;
}

// overdue — срок прошёл, soon — меньше часа, today — сегодня, future — позже
function dueState(iso, now = new Date()) {
  const d = parseLocalISO(iso);
  if (!d) return null;
  const left = d - now;
  if (left <= 0) return "overdue";
  if (left <= HOUR_MS) return "soon";
  if (daysBetween(now, d) === 0) return "today";
  return "future";
}

// Следующий срок повторяющейся задачи (всегда в будущем)
function nextRepeat(iso, repeat, now = new Date()) {
  let d = parseLocalISO(iso) || now;
  const step = (x) => {
    const r = new Date(x);
    if (repeat === "daily") r.setDate(r.getDate() + 1);
    else if (repeat === "weekdays") { do { r.setDate(r.getDate() + 1); } while (r.getDay() === 0 || r.getDay() === 6); }
    else if (repeat === "weekly") r.setDate(r.getDate() + 7);
    else if (repeat === "monthly") {
      const day = r.getDate();
      r.setDate(1); r.setMonth(r.getMonth() + 1);
      r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
    } else if (repeat === "yearly") r.setFullYear(r.getFullYear() + 1);
    return r;
  };
  if (!REPEAT_LABELS[repeat] || repeat === "none") return null;
  let guard = 0;
  do { d = step(d); guard++; } while (d <= now && guard < 1000);
  return toLocalISO(d);
}

// Быстрый ввод в стиле Todoist: «Позвонить маме завтра в 15:00 !1 #Личное»
const WEEKDAY_FORMS = {
  "понедельник": 1, "пн": 1, "вторник": 2, "вт": 2, "среду": 3, "среда": 3, "ср": 3,
  "четверг": 4, "чт": 4, "пятницу": 5, "пятница": 5, "пт": 5, "субботу": 6, "суббота": 6, "сб": 6,
  "воскресенье": 0, "вс": 0
};
const WEEKDAY_RE = new RegExp(`\\s(?:во?\\s+)?(${Object.keys(WEEKDAY_FORMS).join("|")})(?=\\s)`, "i");

function parseQuickInput(text, now = new Date()) {
  let s = ` ${String(text || "").replace(/\s+/g, " ").trim()} `;
  let date = null, time = null, priority = 0, listName = null;
  const cut = (re, fn) => { s = s.replace(re, (...m) => { fn(m); return " "; }); };

  cut(/\s!([1-3])(?=\s)/, (m) => { priority = 4 - Number(m[1]); });           // !1 — высокий
  cut(/\s(!{1,3})(?=\s)/, (m) => { if (!priority) priority = m[1].length; });  // !!! — высокий
  cut(/\s#([^\s#]+)(?=\s)/, (m) => { listName = m[1].replace(/_/g, " "); });

  cut(/\s(?:в|к)\s+([01]?\d|2[0-3])[:.]([0-5]\d)(?=\s)/i, (m) => { time = [+m[1], +m[2]]; });
  if (!time) cut(/\s([01]?\d|2[0-3]):([0-5]\d)(?=\s)/, (m) => { time = [+m[1], +m[2]]; });
  if (!time) cut(/\s(?:в|к)\s+([01]?\d|2[0-3])(?:\s*(?:ч|час[а-я]*))?(?=\s*$)/i, (m) => { time = [+m[1], 0]; });

  const today = startOfDay(now);
  cut(/\s(послезавтра)(?=\s)/i, () => { date = addDays(today, 2); });
  cut(/\s(завтра)(?=\s)/i, () => { date = date || addDays(today, 1); });
  cut(/\s(сегодня)(?=\s)/i, () => { date = date || today; });
  cut(/\s(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?=\s)/, (m) => {
    let y = m[3] ? Number(m[3]) : now.getFullYear();
    if (y < 100) y += 2000;
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    if (d.getDate() === Number(m[1])) {
      if (!m[3] && d < today) d.setFullYear(d.getFullYear() + 1);
      date = d;
    }
  });
  cut(new RegExp(`\\s(\\d{1,2})\\s+(${MONTHS_GEN.join("|")})(?=\\s)`, "i"), (m) => {
    const d = new Date(now.getFullYear(), MONTHS_GEN.indexOf(m[2].toLowerCase()), Number(m[1]));
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    date = d;
  });
  if (!date) cut(WEEKDAY_RE, (m) => {
    const target = WEEKDAY_FORMS[m[1].toLowerCase()];
    let diff = (target - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // «в пятницу» в пятницу = следующая пятница
    date = addDays(today, diff);
  });

  let due = null;
  if (date || time) {
    if (!date) {
      date = today;
      if (time[0] * 60 + time[1] <= now.getHours() * 60 + now.getMinutes()) date = addDays(today, 1);
    }
    const [hh, mm] = time || defaultTimeFor(date, now).split(":").map(Number);
    due = toLocalISO(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm));
  }

  const title = s.replace(/\s+/g, " ").trim();
  return { title, due, priority, listName };
}

function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

let idCounter = 0;
function makeId(prefix = "task") {
  idCounter++;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

class NowApp {
  constructor() {
    this.tasks = [];
    this.currentId = null;          // текущая карточка хранится по id, а не по индексу
    this.activeTimeFilter = null;   // null или число минут
    this.isLazyModeActive = false;

    // Таймер задачи (по меткам времени — не «плывёт» в фоне)
    this.timerInterval = null;
    this.isTimerRunning = false;
    this.timerTaskId = null;
    this.timerEndAt = 0;
    this.timerRemainingMs = 0;      // используется на паузе
    this.totalTimerSeconds = 0;
    this.timerSecondsLeft = 0;
    this.isTimerPaused = false;
    this.isTimerExpired = false;

    // Audio synthesizer context (создаётся при первом касании)
    this.audioCtx = null;

    // Pomodoro state
    this.pomoWorkMinutes = 25;
    this.pomoBreakMinutes = 5;
    this.pomoLongBreakMinutes = 15;
    this.pomoCyclesBeforeLong = 4;
    this.pomoCurrentCycle = 0;
    this.pomoIsRunning = false;
    this.pomoPhase = "work"; // "work" | "break" | "longbreak"
    this.pomoInterval = null;
    this.pomoEndAt = 0;
    this.pomoRemainingMs = 0;
    this.pomoIsPaused = false;
    this.pomoSecondsLeft = 0;
    this.pomoTotalSeconds = 0;

    // Stats
    this.doneToday = 0;
    this.doneDate = localDateKey();

    this.confettiFrame = null;
    this.recognition = null;
    this.isRecordingVoice = false;

    // Списки задач и состояние экрана списка
    this.lists = [];
    this.view = "all";            // умный список или id своего списка
    this.searchQuery = "";
    this.editDraft = null;        // копия задачи в редакторе
    this.editIsNew = false;
    this.dumpListId = null;       // null — список подбирается автоматически
    this.lastRenderDay = localDateKey();

    this.initElements();
    this.loadState();
    this.attachEvents();
    this.render();
    this.startDeadlineWatcher();
  }

  initElements() {
    const $ = (id) => document.getElementById(id);

    // Stage elements
    this.stageQuestion = $("stageQuestion");
    this.taskCard = $("taskCard");
    this.cardContainer = $("cardContainer");
    this.cardParentTask = $("cardParentTask");
    this.cardDuration = $("cardDuration");
    this.cardActionTitle = $("cardActionTitle");
    this.cardReason = $("cardReason");
    this.lazyBanner = $("lazyBanner");
    this.lazyText = $("lazyText");

    // Timer elements
    this.timerDisplay = $("timerDisplay");
    this.timerDigits = $("timerDigits");
    this.timerProgressCircle = $("timerProgressCircle");
    this.timerStatusHint = $("timerStatusHint");
    this.idleButtons = $("idleButtons");
    this.runningButtons = $("runningButtons");
    this.startBtn = $("startBtn");
    this.pauseBtn = $("pauseBtn");
    this.finishBtn = $("finishBtn");

    // Secondary buttons
    this.gentleActions = $("gentleActions");
    this.lazyBtn = $("lazyBtn");
    this.skipBtn = $("skipBtn");
    this.allDoneView = $("allDoneView");
    this.allDoneTitle = $("allDoneTitle");
    this.allDoneDesc = $("allDoneDesc");
    this.emptyAddBtn = $("emptyAddBtn");
    this.showAllBtn = $("showAllBtn");

    // Top & Bottom Bar
    this.timeFilterBtn = $("timeFilterBtn");
    this.activeTimeBadge = $("activeTimeBadge");
    this.listToggleBtn = $("listToggleBtn");
    this.tasksCountBadge = $("tasksCountBadge");
    this.themeToggleBtn = $("themeToggleBtn");
    this.dumpTriggerBtn = $("dumpTriggerBtn");
    this.dumpMicBtn = $("dumpMicBtn");

    // Sheets & Drawers
    this.dumpSheetBackdrop = $("dumpSheetBackdrop");
    this.dumpCloseBtn = $("dumpCloseBtn");
    this.dumpForm = $("dumpForm");
    this.dumpTextarea = $("dumpTextarea");
    this.voiceInputBtn = $("voiceInputBtn");
    this.voiceBtnText = $("voiceBtnText");

    this.timeSheetBackdrop = $("timeSheetBackdrop");
    this.timeCloseBtn = $("timeCloseBtn");

    this.listDrawerBackdrop = $("listDrawerBackdrop");
    this.listCloseBtn = $("listCloseBtn");
    this.listBackBtn = $("listBackBtn");
    this.drawerTasksList = $("drawerTasksList");
    this.drawerTaskCounter = $("drawerTaskCounter");
    this.forceNotifBtn = $("forceNotifBtn");
    this.drawerAddBtn = $("drawerAddBtn");
    this.drawerExitBtn = $("drawerExitBtn");

    // Notification permission sheet
    this.notifSheetBackdrop = $("notifSheetBackdrop");
    this.notifAllowBtn = $("notifAllowBtn");
    this.notifLaterBtn = $("notifLaterBtn");

    // Toast & Confetti
    this.toast = $("toastMessage");
    this.confettiCanvas = $("confettiCanvas");

    // Pomodoro elements
    this.pomodoroBtn = $("pomodoroBtn");
    this.pomodoroBadge = $("pomodoroBadge");
    this.pomodoroSheetBackdrop = $("pomodoroSheetBackdrop");
    this.pomodoroCloseBtn = $("pomodoroCloseBtn");
    this.pomodoroSetup = $("pomodoroSetup");
    this.pomodoroRunning = $("pomodoroRunning");
    this.pomoWorkValueEl = $("pomoWorkValue");
    this.pomoBreakValueEl = $("pomoBreakValue");
    this.pomoLongValueEl = $("pomoLongValue");
    this.pomoStartSessionBtn = $("pomoStartSessionBtn");
    this.pomoPhaseLabel = $("pomoPhaseLabel");
    this.pomoTimerDigits = $("pomoTimerDigits");
    this.pomoProgressCircle = $("pomoProgressCircle");
    this.pomoDots = $("pomoDots");
    this.pomoPauseBtn = $("pomoPauseBtn");
    this.pomoSkipBtn = $("pomoSkipBtn");
    this.pomoStopBtn = $("pomoStopBtn");
    this.pomoCycleInfo = $("pomoCycleInfo");

    // Desktop sidebar elements
    this.sidebarTasksList = $("sidebarTasksList");
    this.statDoneToday = $("statDoneToday");
    this.sidebarAddBtn = $("sidebarAddBtn");

    this.themeColorMeta = $("theme-color-meta");

    // Список задач (To Do)
    this.cardDue = $("cardDue");
    this.drawerTitle = $("drawerTitle");
    this.listTabs = $("listTabs");
    this.listActions = $("listActions");
    this.taskSearch = $("taskSearch");
    this.quickAddForm = $("quickAddForm");
    this.quickAddInput = $("quickAddInput");
    this.quickAddHint = $("quickAddHint");
    this.dumpListChips = $("dumpListChips");
    this.sidebarNav = $("sidebarNav");

    // Редактор задачи
    this.editSheetBackdrop = $("editSheetBackdrop");
    this.editSheetTitle = $("editSheetTitle");
    this.editCloseBtn = $("editCloseBtn");
    this.editTitle = $("editTitle");
    this.editNotes = $("editNotes");
    this.editDate = $("editDate");
    this.editHour = $("editHour");
    this.editMinute = $("editMinute");
    this.editDueHint = $("editDueHint");
    this.editRepeat = $("editRepeat");
    this.editList = $("editList");
    this.editDuration = $("editDuration");
    this.editPriority = $("editPriority");
    this.editImportant = $("editImportant");
    this.editMyDay = $("editMyDay");
    this.editSubtasks = $("editSubtasks");
    this.subtaskForm = $("subtaskForm");
    this.subtaskInput = $("subtaskInput");
    this.editDeleteBtn = $("editDeleteBtn");
    this.editFocusBtn = $("editFocusBtn");
    this.editSaveBtn = $("editSaveBtn");
  }

  // --- State Persistence ---
  freshSeed() {
    return INITIAL_TASKS.map(t => this.normalizeTask({ ...t }));
  }

  isValidTask(t) {
    return t && typeof t === "object" && typeof t.id === "string" && typeof t.action === "string" && t.action.trim() !== "";
  }

  // Приводим задачу (в т.ч. из старых версий) к полной модели

  loadState() {
    // Списки
    try {
      const savedLists = JSON.parse(store.get(STORAGE.lists) || "null");
      this.lists = Array.isArray(savedLists) && savedLists.some(l => l && l.id === "inbox")
        ? savedLists.filter(l => l && typeof l.id === "string" && typeof l.name === "string")
        : DEFAULT_LISTS.map(l => ({ ...l }));
    } catch (e) {
      this.lists = DEFAULT_LISTS.map(l => ({ ...l }));
    }

    const saved = store.get(STORAGE.tasks);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) throw new Error("tasks is not an array");
        this.tasks = parsed.filter(t => this.isValidTask(t)).map(t => this.normalizeTask(t));
      } catch (e) {
        this.tasks = this.freshSeed();
      }
    } else {
      this.tasks = this.freshSeed();
    }
    this.saveState();

    // Theme: сохранённая, иначе системная
    const savedTheme = store.get(STORAGE.theme);
    const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    this.applyTheme(savedTheme === "dark" || savedTheme === "light" ? savedTheme : (systemDark ? "dark" : "light"));

    // Done today counter (сбрасывается в полночь по местному времени)
    try {
      const parsed = JSON.parse(store.get(STORAGE.done) || "null");
      if (parsed && parsed.date === this.doneDate) this.doneToday = Number(parsed.count) || 0;
    } catch (e) {
      this.doneToday = 0;
    }

    // Pomodoro settings
    try {
      const p = JSON.parse(store.get(STORAGE.pomo) || "null");
      if (p) {
        this.pomoWorkMinutes = this.clamp(p.work, 5, 60, 25);
        this.pomoBreakMinutes = this.clamp(p.brk, 1, 30, 5);
        this.pomoLongBreakMinutes = this.clamp(p.long, 5, 45, 15);
      }
    } catch (e) { /* defaults */ }
  }

  clamp(v, min, max, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  saveState() {
    store.set(STORAGE.tasks, JSON.stringify(this.tasks));
    store.set(STORAGE.lists, JSON.stringify(this.lists));
  }

  refreshDoneDay() {
    const today = localDateKey();
    if (today !== this.doneDate) {
      this.doneDate = today;
      this.doneToday = 0;
    }
  }

  saveDoneToday() {
    store.set(STORAGE.done, JSON.stringify({ date: this.doneDate, count: this.doneToday }));
  }

  savePomoSettings() {
    store.set(STORAGE.pomo, JSON.stringify({
      work: this.pomoWorkMinutes, brk: this.pomoBreakMinutes, long: this.pomoLongBreakMinutes
    }));
  }

  // --- Sound Synthesizer (Web Audio) ---
  getAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      try { this.audioCtx = new AudioContextClass(); } catch (e) { return null; }
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  playHapticTone(type = "tap") {
    try {
      const ctx = this.getAudio();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === "chime") {
        // Serene completion chord
        const notes = [659.25, 830.61, 987.77, 1318.51];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.06;
          const chordOsc = ctx.createOscillator();
          const chordGain = ctx.createGain();
          chordOsc.type = "sine";
          chordOsc.frequency.setValueAtTime(freq, t);
          chordGain.gain.setValueAtTime(0, t);
          chordGain.gain.linearRampToValueAtTime(0.15, t + 0.03);
          chordGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
          chordOsc.connect(chordGain);
          chordGain.connect(ctx.destination);
          chordOsc.start(t);
          chordOsc.stop(t + 1.0);
        });
        return;
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "zen") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.6);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (e) {
      console.warn("Audio unavailable:", e);
    }
  }

  // --- Filtering & Active Task Selection ---
  getActiveTasks() {
    const now = new Date();
    const urgent = (t) => { const st = dueState(t.due, now); return st === "overdue" || st === "soon" || st === "today"; };
    return this.getOpenTasks()
      .filter(t => !this.activeTimeFilter || t.durationMinutes <= this.activeTimeFilter)
      .map((t, i) => ({ t, i, u: urgent(t) }))
      .sort((a, b) =>
        (b.u - a.u) ||
        (a.u ? parseLocalISO(a.t.due) - parseLocalISO(b.t.due) : 0) ||
        (b.t.priority - a.t.priority) ||
        (a.i - b.i))
      .map(x => x.t);
  }

  getTaskById(id) {
    return this.tasks.find(t => t.id === id) || null;
  }

  getCurrentTask() {
    // Пока идёт таймер, карточка всегда показывает задачу таймера
    if (this.isTimerRunning) {
      const timerTask = this.getTaskById(this.timerTaskId);
      if (timerTask) return timerTask;
      this.stopTimer();
    }
    const list = this.getActiveTasks();
    if (list.length === 0) return null;
    let task = list.find(t => t.id === this.currentId);
    if (!task) {
      task = list[0];
      this.currentId = task.id;
    }
    return task;
  }

  // После удаления задачи выбираем ту, что стояла следующей
  selectNextAfterRemoval(oldIndex) {
    const list = this.getActiveTasks();
    this.currentId = list.length ? list[oldIndex < list.length ? oldIndex : 0].id : null;
  }

  // --- UI Rendering ---
  render() {
    this.refreshDoneDay();
    this.lastRenderDay = localDateKey();
    const current = this.getCurrentTask();
    const openCount = this.getOpenTasks().length;

    // Счётчики и списки обновляются всегда, даже на пустом экране
    this.tasksCountBadge.textContent = openCount;
    this.tasksCountBadge.style.display = openCount ? "flex" : "none";
    if (this.activeTimeFilter) {
      this.activeTimeBadge.style.display = "flex";
      this.activeTimeBadge.textContent = `${this.activeTimeFilter}м`;
    } else {
      this.activeTimeBadge.style.display = "none";
    }
    this.renderDrawer();
    this.renderSidebar();

    if (!current) {
      this.cardContainer.style.display = "none";
      this.gentleActions.style.display = "none";
      this.stageQuestion.style.display = "none";
      this.allDoneView.style.display = "flex";

      const filteredOut = openCount > 0 && this.activeTimeFilter;
      if (filteredOut) {
        this.allDoneTitle.textContent = `Нет дел до ${this.activeTimeFilter} минут`;
        this.allDoneDesc.textContent = `В списке ещё ${openCount} — но все они длиннее выбранного окна.`;
        this.showAllBtn.style.display = "inline-flex";
      } else {
        this.allDoneTitle.textContent = "Тишина и ясность";
        this.allDoneDesc.textContent = "Все дела завершены. Отдохни или выгрузи новые мысли.";
        this.showAllBtn.style.display = "none";
      }
      return;
    }

    this.allDoneView.style.display = "none";
    this.cardContainer.style.display = "block";
    this.gentleActions.style.display = "flex";
    this.stageQuestion.style.display = "block";

    this.cardParentTask.textContent = this.taskLabel(current);

    // Срок на карточке: нажатие открывает редактор
    const st = dueState(current.due);
    this.cardDue.className = `due-pill card-due-pill ${st ? "due-" + st : "due-empty"}`;
    this.cardDue.textContent = current.due ? `⏰ ${formatDue(current.due)}${current.repeat !== "none" ? " 🔁" : ""}` : "+ срок";

    if (this.isLazyModeActive) {
      this.cardActionTitle.textContent = current.lazyVersion || "Удели этому ровно 1 минуту — просто начни";
      this.cardReason.textContent = `Потом: ${current.action}`;
      this.cardDuration.textContent = "~1 мин";
      this.lazyBanner.style.display = "block";
      this.lazyBtn.style.display = "none";
    } else {
      this.cardActionTitle.textContent = current.action;
      const nextSub = current.subtasks.find(s => !s.done);
      const doneSubs = current.subtasks.filter(s => s.done).length;
      this.cardReason.textContent = nextSub
        ? `Следующий шаг: ${nextSub.text} (${doneSubs}/${current.subtasks.length})`
        : (current.notes || current.reason || "Сделай сейчас, чтобы освободить мысли.");
      this.cardDuration.textContent = `~${current.durationMinutes} мин`;
      this.lazyBanner.style.display = "none";
      this.lazyBtn.style.display = "inline-flex";
    }

    // Timer visual state
    if (this.isTimerRunning) {
      this.timerDisplay.style.display = "flex";
      this.idleButtons.style.display = "none";
      this.runningButtons.style.display = "flex";
      this.gentleActions.style.opacity = "0.3";
      this.gentleActions.style.pointerEvents = "none";
    } else {
      this.timerDisplay.style.display = "none";
      this.idleButtons.style.display = "flex";
      this.runningButtons.style.display = "none";
      this.gentleActions.style.opacity = "1";
      this.gentleActions.style.pointerEvents = "auto";
    }
  }

  // --- Экран списка (To Do) ---

  renderDrawer() {
    if (!this.listTabs) return;
    // Список мог быть удалён
    if (!SMART_VIEWS.some(v => v.id === this.view) && !this.lists.some(l => l.id === this.view)) this.view = "all";

    this.renderListTabs();
    const items = this.viewTasks();
    const title = this.searchQuery ? `Поиск: «${this.searchQuery}»` : this.viewName();
    this.drawerTitle.textContent = title;
    const openLeft = items.filter(t => !t.done).length;
    this.drawerTaskCounter.textContent = this.view === "done" && !this.searchQuery
      ? `Выполнено: ${items.length}`
      : `Задач: ${openLeft}`;

    // Действия со своим списком / выполненными
    const custom = this.lists.find(l => l.id === this.view);
    if (this.view === "done" && items.length && !this.searchQuery) {
      this.listActions.innerHTML = `<button class="clean-btn" type="button" data-action="clear-done">Очистить выполненные</button>`;
    } else if (custom && !this.searchQuery) {
      this.listActions.innerHTML = `
        <button class="clean-btn" type="button" data-action="rename-list">Переименовать</button>
        ${custom.id !== "inbox" ? `<button class="clean-btn danger-text" type="button" data-action="delete-list">Удалить список</button>` : ""}`;
    } else {
      this.listActions.innerHTML = "";
    }

    if (items.length === 0) {
      const emptyText = this.searchQuery ? "Ничего не найдено."
        : this.view === "done" ? "Здесь появятся выполненные задачи."
        : this.view === "planned" ? "Нет задач со сроком.<br>Добавь срок: «завтра в 15:00»."
        : this.view === "myday" ? "Мой день пуст.<br>Задачи на сегодня и отмеченные ☀️ появятся здесь."
        : "Список пуст.<br>Напиши задачу в поле выше.";
      this.drawerTasksList.innerHTML = `<div class="drawer-empty">${emptyText}</div>`;
      return;
    }

    const currentId = this.currentVisibleId();
    if (this.view === "planned" && !this.searchQuery) {
      // Группы как в «Напоминаниях»: просрочено / сегодня / завтра / неделя / позже
      const now = new Date();
      const groups = [["Просрочено", []], ["Сегодня", []], ["Завтра", []], ["На этой неделе", []], ["Позже", []]];
      items.forEach(t => {
        const d = parseLocalISO(t.due);
        const diff = daysBetween(now, d);
        const idx = d <= now ? 0 : diff === 0 ? 1 : diff === 1 ? 2 : diff < 7 ? 3 : 4;
        groups[idx][1].push(t);
      });
      this.drawerTasksList.innerHTML = groups.filter(g => g[1].length).map(([name, list]) =>
        `<div class="todo-group-title ${name === "Просрочено" ? "overdue" : ""}">${name} · ${list.length}</div>` +
        list.map(t => this.taskRowHtml(t, currentId)).join("")).join("");
      return;
    }
    this.drawerTasksList.innerHTML = items.map(t => this.taskRowHtml(t, currentId)).join("");
  }

  renderSidebar() {
    if (!this.sidebarTasksList) return;

    if (this.statDoneToday) {
      this.statDoneToday.textContent = this.doneToday;
    }

    if (this.sidebarNav) {
      const item = (id, emoji, name, count) => `
        <button class="sidebar-nav-item" type="button" data-view="${this.escapeHtml(id)}">
          <span class="sidebar-nav-emoji">${this.escapeHtml(emoji)}</span>
          <span class="sidebar-nav-name">${this.escapeHtml(name)}</span>
          ${count ? `<span class="sidebar-nav-count">${count}</span>` : ""}
        </button>`;
      this.sidebarNav.innerHTML =
        SMART_VIEWS.filter(v => v.id !== "done").map(v => item(v.id, v.emoji, v.name, this.countInView(v.id))).join("") +
        `<div class="sidebar-nav-sep"></div>` +
        this.lists.map(l => item(l.id, l.emoji || "•", l.name, this.countInView(l.id))).join("");
    }

    const queue = this.getActiveTasks();
    if (queue.length === 0) {
      this.sidebarTasksList.innerHTML = `<div class="sidebar-empty-text">Всё сделано!<br>Нажми «+» чтобы добавить.</div>`;
      return;
    }

    const currentId = this.currentVisibleId();
    this.sidebarTasksList.innerHTML = queue.slice(0, 12).map(item => {
      const st = dueState(item.due);
      const right = item.due ? `<span class="sidebar-task-time due-${st}">${formatDue(item.due).replace(/^Сегодня, /, "")}</span>` : `<span class="sidebar-task-time">~${item.durationMinutes}м</span>`;
      return `
        <div class="sidebar-task-item ${item.id === currentId ? "current" : ""}" data-id="${this.escapeHtml(item.id)}">
          <span class="sidebar-task-dot"></span>
          <span class="sidebar-task-text">${this.escapeHtml(item.action)}</span>
          ${right}
        </div>`;
    }).join("");
  }

  // id задачи, которая сейчас реально показана на карточке (без побочных эффектов)
  currentVisibleId() {
    if (this.isTimerRunning && this.getTaskById(this.timerTaskId)) return this.timerTaskId;
    const list = this.getActiveTasks();
    const found = list.find(t => t.id === this.currentId);
    return found ? found.id : (list[0] ? list[0].id : null);
  }

  jumpToTask(id) {
    const task = this.getTaskById(id);
    if (!task) return;
    if (this.isTimerRunning && this.timerTaskId !== id) {
      this.stopTimer();
      this.showToast("Таймер остановлен");
    }
    if (this.activeTimeFilter && task.durationMinutes > this.activeTimeFilter) {
      this.activeTimeFilter = null;
      this.showToast("Фильтр времени сброшен");
    }
    this.currentId = id;
    this.isLazyModeActive = false;
    this.animateCardSwitch();
  }

  // --- Timer (based on timestamps) ---
  startTimer() {
    const current = this.getCurrentTask();
    if (!current) return;

    this.playHapticTone("zen");
    const minutes = this.isLazyModeActive ? 1 : (current.durationMinutes || 10);

    this.isTimerRunning = true;
    this.timerTaskId = current.id;
    this.currentId = current.id;
    this.totalTimerSeconds = Math.round(minutes * 60);
    this.timerEndAt = Date.now() + this.totalTimerSeconds * 1000;
    this.isTimerPaused = false;
    this.isTimerExpired = false;
    this.pauseBtn.textContent = "Пауза";
    this.setTimerHint();

    this.render();
    this.runTimerLoop();
  }

  runTimerLoop() {
    clearInterval(this.timerInterval);
    this.tickTimer();
    this.timerInterval = setInterval(() => this.tickTimer(), TIMER_TICK_MS);
  }

  tickTimer() {
    if (!this.isTimerRunning || this.isTimerPaused || this.isTimerExpired) return;
    const leftMs = Math.max(0, this.timerEndAt - Date.now());
    this.timerSecondsLeft = Math.ceil(leftMs / 1000);
    this.updateTimerDisplay();
    if (leftMs <= 0) this.onTimerExpired();
  }

  // Время вышло — НЕ закрываем задачу автоматически, спрашиваем пользователя
  onTimerExpired() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isTimerExpired = true;
    this.timerSecondsLeft = 0;
    this.updateTimerDisplay();
    this.playHapticTone("zen");
    this.pauseBtn.textContent = "+5 мин";
    this.setTimerHint();

    const task = this.getTaskById(this.timerTaskId);
    const title = this.isLazyModeActive ? "⏰ Минута прошла" : "⏰ Время вышло";
    const body = task ? `«${task.action}» — сделал? Отметь «Готово!» или добавь 5 минут.` : "Отметь «Готово!» или добавь 5 минут.";
    if (document.hidden) {
      this.sendNotification(title, body);
    } else {
      this.showToast(title);
    }
  }

  setTimerHint() {
    if (!this.timerStatusHint) return;
    if (this.isTimerExpired) {
      this.timerStatusHint.textContent = this.isLazyModeActive
        ? "Минута прошла! Жми «Готово!» — и переходим к самой задаче"
        : "Время вышло. Сделал? Жми «Готово!» или добавь 5 минут";
    } else if (this.isTimerPaused) {
      this.timerStatusHint.textContent = "Пауза";
    } else {
      this.timerStatusHint.textContent = "Фокусируйся только на этом";
    }
  }

  stopTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isTimerRunning = false;
    this.isTimerPaused = false;
    this.isTimerExpired = false;
    this.timerTaskId = null;
    this.pauseBtn.textContent = "Пауза";
    this.setTimerHint();
  }

  pauseTimer() {
    if (!this.isTimerRunning) return;
    this.playHapticTone("tap");

    if (this.isTimerExpired) {
      // Продлить на 5 минут
      this.isTimerExpired = false;
      this.totalTimerSeconds = 5 * 60;
      this.timerEndAt = Date.now() + this.totalTimerSeconds * 1000;
      this.pauseBtn.textContent = "Пауза";
      this.setTimerHint();
      this.runTimerLoop();
    } else if (this.isTimerPaused) {
      this.isTimerPaused = false;
      this.timerEndAt = Date.now() + this.timerRemainingMs;
      this.pauseBtn.textContent = "Пауза";
      this.setTimerHint();
      this.runTimerLoop();
    } else {
      this.timerRemainingMs = Math.max(0, this.timerEndAt - Date.now());
      this.isTimerPaused = true;
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      this.pauseBtn.textContent = "Продолжить";
      this.setTimerHint();
    }
  }

  updateTimerDisplay() {
    this.timerDigits.textContent = formatClock(this.timerSecondsLeft);
    const total = this.totalTimerSeconds || 1;
    const progress = Math.min(1, Math.max(0, 1 - (this.timerSecondsLeft / total)));
    this.timerProgressCircle.style.strokeDashoffset = TIMER_CIRCUMFERENCE * progress;
  }

  completeCurrentTask() {
    const current = this.getCurrentTask();
    if (!current) return;

    // В режиме «Мне лень» выполнен только микро-шаг — сама задача остаётся
    if (this.isLazyModeActive) {
      this.playHapticTone("chime");
      this.stopTimer();
      this.isLazyModeActive = false;
      this.currentId = current.id;
      this.showToast("💪 Первый шаг сделан! Теперь — сама задача");
      this.animateCardSwitch();
      return;
    }

    const oldIndex = Math.max(0, this.getActiveTasks().findIndex(t => t.id === current.id));
    this.stopTimer();
    this.completeTask(current.id, { celebrate: true });
    this.selectNextAfterRemoval(oldIndex);
    this.isLazyModeActive = false;
    this.animateCardSwitch();
  }

  // Выполнение задачи: остаётся в «Выполнено», повторяющаяся создаёт следующую

  skipCurrentTask() {
    this.playHapticTone("tap");
    const list = this.getActiveTasks();
    if (list.length <= 1) {
      this.showToast("Это единственное действие прямо сейчас");
      return;
    }
    const current = this.getCurrentTask();
    const idx = list.findIndex(t => t.id === (current && current.id));
    this.stopTimer();
    this.isLazyModeActive = false;
    this.currentId = list[(idx + 1) % list.length].id;
    this.animateCardSwitch();
  }

  activateLazyMode() {
    this.playHapticTone("tap");
    this.isLazyModeActive = true;
    this.showToast("Включен режим без давления 🛋️");
    this.animateCardSwitch();
  }

  animateCardSwitch() {
    clearTimeout(this.flipInTimeout);
    this.render();
    this.taskCard.classList.remove("flip-out", "flip-in");
    void this.taskCard.offsetWidth; // перезапуск анимации
    this.taskCard.classList.add("flip-in");
    this.flipInTimeout = setTimeout(() => {
      this.taskCard.classList.remove("flip-in");
    }, 450);
  }

  // --- Быстрое добавление в списке ---

  removeTask(id) {
    const task = this.getTaskById(id);
    if (!task) return;
    this.playHapticTone("tap");

    const wasCurrent = id === this.currentVisibleId();
    const oldIndex = Math.max(0, this.getActiveTasks().findIndex(t => t.id === id));
    if (this.timerTaskId === id) this.stopTimer();

    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveState();

    if (wasCurrent) {
      this.isLazyModeActive = false;
      this.selectNextAfterRemoval(oldIndex);
    }
    this.render();
  }

  normalizeTask(t) {
    const subtasks = Array.isArray(t.subtasks)
      ? t.subtasks.filter(s => s && typeof s.text === "string" && s.text.trim()).map(s => ({ id: String(s.id || makeId("sub")), text: s.text.trim(), done: !!s.done }))
      : [];
    const listIds = this.lists.length ? this.lists.map(l => l.id) : DEFAULT_LISTS.map(l => l.id);
    return {
      id: t.id,
      action: String(t.action).trim(),
      parentGoal: typeof t.parentGoal === "string" ? t.parentGoal : "",
      reason: typeof t.reason === "string" ? t.reason : "",
      lazyVersion: typeof t.lazyVersion === "string" ? t.lazyVersion : "",
      durationMinutes: Number(t.durationMinutes) > 0 ? Math.min(240, Number(t.durationMinutes)) : 5,
      list: listIds.includes(t.list) ? t.list : "inbox",
      due: parseLocalISO(t.due) ? t.due : null,
      repeat: REPEAT_LABELS[t.repeat] ? t.repeat : "none",
      priority: [0, 1, 2, 3].includes(Number(t.priority)) ? Number(t.priority) : 0,
      important: !!t.important,
      myDay: typeof t.myDay === "string" ? t.myDay : null,
      notes: typeof t.notes === "string" ? t.notes : "",
      subtasks,
      done: !!t.done,
      doneAt: Number(t.doneAt) || null,
      createdAt: Number(t.createdAt) || Date.now(),
      n1h: !!t.n1h,
      nDue: !!t.nDue
    };
  }

  getOpenTasks() {
    return this.tasks.filter(t => !t.done);
  }

  // Очередь карточки фокуса: сначала то, у чего срок сегодня/просрочен, потом по приоритету

  getList(id) {
    return this.lists.find(l => l.id === id) || this.lists[0];
  }

  // Подпись на карточке: свой список, иначе угаданная категория

  taskLabel(t) {
    if (t.list && t.list !== "inbox") {
      const l = this.getList(t.list);
      return `${l.emoji || ""} ${l.name}`.trim();
    }
    return t.parentGoal || "Задача";
  }

  viewName(view = this.view) {
    const smart = SMART_VIEWS.find(v => v.id === view);
    if (smart) return smart.name;
    const l = this.lists.find(x => x.id === view);
    return l ? l.name : "Все";
  }

  isInView(t, view, now, todayKey) {
    if (view === "done") return t.done;
    if (t.done) return false;
    if (view === "all") return true;
    if (view === "myday") {
      const st = dueState(t.due, now);
      return t.myDay === todayKey || st === "overdue" || st === "soon" || st === "today";
    }
    if (view === "planned") return !!t.due;
    if (view === "important") return t.important || t.priority === 3;
    return t.list === view;
  }

  viewTasks() {
    const now = new Date();
    const todayKey = localDateKey(now);
    const q = this.searchQuery.trim().toLowerCase();
    let items;
    if (q) {
      // Поиск — по всем задачам, включая выполненные
      items = this.tasks.filter(t =>
        t.action.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q) ||
        t.subtasks.some(s => s.text.toLowerCase().includes(q)));
    } else {
      items = this.tasks.filter(t => this.isInView(t, this.view, now, todayKey));
    }
    if (this.view === "done" && !q) {
      return items.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    }
    // Задачи со сроком — по сроку, остальные — по приоритету, затем в порядке добавления
    return items
      .map((t, i) => ({ t, i }))
      .sort((a, b) =>
        (a.t.done - b.t.done) ||
        ((b.t.due ? 1 : 0) - (a.t.due ? 1 : 0)) ||
        (a.t.due && b.t.due ? parseLocalISO(a.t.due) - parseLocalISO(b.t.due) : 0) ||
        (b.t.priority - a.t.priority) ||
        (a.i - b.i))
      .map(x => x.t);
  }

  countInView(view) {
    const now = new Date();
    const todayKey = localDateKey(now);
    return this.tasks.reduce((n, t) => n + (this.isInView(t, view, now, todayKey) ? 1 : 0), 0);
  }

  renderListTabs() {
    const tab = (id, emoji, name, count) => `
      <button class="list-tab ${this.view === id && !this.searchQuery ? "active" : ""}" type="button" data-view="${this.escapeHtml(id)}">
        <span class="list-tab-emoji">${this.escapeHtml(emoji)}</span>
        <span>${this.escapeHtml(name)}</span>
        ${count ? `<span class="list-tab-count">${count}</span>` : ""}
      </button>`;
    this.listTabs.innerHTML =
      SMART_VIEWS.map(v => tab(v.id, v.emoji, v.name, v.id === "done" ? 0 : this.countInView(v.id))).join("") +
      `<span class="list-tabs-sep"></span>` +
      this.lists.map(l => tab(l.id, l.emoji || "•", l.name, this.countInView(l.id))).join("") +
      `<button class="list-tab list-tab-add" type="button" data-action="new-list">+ Список</button>`;
  }

  taskRowHtml(t, currentId) {
    const now = new Date();
    const st = dueState(t.due, now);
    const meta = [];
    if (t.due) meta.push(`<span class="due-chip due-${t.done ? "done" : st}">⏰ ${formatDue(t.due, now)}</span>`);
    if (t.repeat !== "none") meta.push(`<span title="${REPEAT_LABELS[t.repeat]}">🔁 ${REPEAT_LABELS[t.repeat].toLowerCase()}</span>`);
    if (t.subtasks.length) meta.push(`<span>☑ ${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}</span>`);
    if (t.myDay === localDateKey(now) && this.view !== "myday") meta.push(`<span>☀️</span>`);
    if (t.notes) meta.push(`<span title="Есть заметка">📝</span>`);
    if (this.searchQuery || SMART_VIEWS.some(v => v.id === this.view)) meta.push(`<span>${this.escapeHtml(this.taskLabel(t))}</span>`);
    meta.push(`<span>~${t.durationMinutes} мин</span>`);

    return `
      <div class="todo-row ${t.done ? "is-done" : ""} ${t.id === currentId ? "is-current" : ""}" data-id="${this.escapeHtml(t.id)}">
        <button class="todo-check prio-${t.priority}" type="button" data-action="toggle" aria-label="${t.done ? "Вернуть в работу" : "Отметить выполненной"}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <div class="todo-main" data-action="edit">
          <div class="todo-title">${t.priority ? `<span class="prio-mark prio-${t.priority}">${"!".repeat(t.priority)}</span>` : ""}${this.escapeHtml(t.action)}</div>
          <div class="todo-meta">${meta.join("")}</div>
        </div>
        <button class="todo-star ${t.important ? "on" : ""}" type="button" data-action="star" aria-label="Важное">${t.important ? "★" : "☆"}</button>
      </div>`;
  }

  completeTask(id, { celebrate = false } = {}) {
    const task = this.getTaskById(id);
    if (!task || task.done) return;
    if (this.timerTaskId === id) this.stopTimer();

    task.done = true;
    task.doneAt = Date.now();

    let msg = `🎉 Готово: «${task.action}»`;
    if (task.repeat !== "none") {
      const nextDue = nextRepeat(task.due, task.repeat);
      const next = this.normalizeTask({
        ...task,
        id: makeId(),
        due: nextDue,
        done: false,
        doneAt: null,
        myDay: null,
        n1h: false,
        nDue: false,
        createdAt: Date.now(),
        subtasks: task.subtasks.map(s => ({ ...s, id: makeId("sub"), done: false }))
      });
      const idx = this.tasks.indexOf(task);
      this.tasks.splice(idx + 1, 0, next);
      task.repeat = "none"; // выполненный экземпляр больше не повторяется
      msg = `🔁 Готово! Следующий раз: ${formatDue(nextDue)}`;
    }

    this.refreshDoneDay();
    this.doneToday++;
    this.saveDoneToday();
    this.saveState();

    this.playHapticTone("chime");
    if (celebrate) this.triggerConfetti();
    this.showToast(msg);
  }

  uncompleteTask(id) {
    const task = this.getTaskById(id);
    if (!task || !task.done) return;
    if (task.doneAt && localDateKey(new Date(task.doneAt)) === localDateKey()) {
      this.refreshDoneDay();
      this.doneToday = Math.max(0, this.doneToday - 1);
      this.saveDoneToday();
    }
    task.done = false;
    task.doneAt = null;
    this.saveState();
    this.playHapticTone("tap");
    this.showToast("Задача возвращена в работу");
  }

  toggleTaskDone(id) {
    const task = this.getTaskById(id);
    if (!task) return;
    if (task.done) {
      this.uncompleteTask(id);
    } else {
      const wasCurrent = id === this.currentVisibleId();
      const oldIndex = Math.max(0, this.getActiveTasks().findIndex(t => t.id === id));
      this.completeTask(id);
      if (wasCurrent) {
        this.isLazyModeActive = false;
        this.selectNextAfterRemoval(oldIndex);
      }
    }
    this.render();
  }

  toggleImportant(id) {
    const task = this.getTaskById(id);
    if (!task) return;
    task.important = !task.important;
    this.saveState();
    this.playHapticTone("tap");
    this.render();
  }

  // Мгновенная смена карточки: сначала рисуем, потом короткая анимация появления (без задержки)

  addQuickTask(text) {
    const parsed = parseQuickInput(text);
    const title = this.cleanText(parsed.title || "");
    if (!parsed.title || title.length < 1) {
      this.showToast("Напиши название задачи");
      return null;
    }

    let listId = this.lists.some(l => l.id === this.view) ? this.view : "inbox";
    if (parsed.listName) {
      const found = this.lists.find(l => l.name.toLowerCase() === parsed.listName.toLowerCase());
      listId = found ? found.id : this.createList(parsed.listName).id;
    }

    const todayKey = localDateKey();
    let due = parsed.due;
    if (!due && this.view === "planned") {
      const today = startOfDay(new Date());
      due = `${localDateKey(today)}T${defaultTimeFor(today)}`;
    }

    const task = this.normalizeTask({
      id: makeId(),
      action: title,
      parentGoal: this.guessParentGoal(title),
      reason: "",
      durationMinutes: this.guessDuration(title),
      lazyVersion: "Удели этому ровно 1 минуту — просто начни",
      list: listId,
      due,
      priority: parsed.priority,
      important: this.view === "important",
      myDay: this.view === "myday" ? todayKey : null
    });
    this.tasks.unshift(task);
    this.saveState();
    this.checkDeadlines();
    this.playHapticTone("tap");
    this.render();
    this.showToast(due ? `Добавлено · ⏰ ${formatDue(due)}` : "Задача добавлена");
    return task;
  }

  updateQuickAddHint() {
    const text = this.quickAddInput.value;
    if (!text.trim()) {
      this.quickAddHint.textContent = "";
      this.quickAddHint.classList.remove("show");
      return;
    }
    const p = parseQuickInput(text);
    const parts = [];
    if (p.due) parts.push(`⏰ ${formatDue(p.due)}`);
    if (p.priority) parts.push(`${"!".repeat(p.priority)} ${PRIORITY_LABELS[p.priority].toLowerCase()}`);
    if (p.listName) parts.push(`# ${p.listName}`);
    this.quickAddHint.textContent = parts.join("  ·  ");
    this.quickAddHint.classList.toggle("show", parts.length > 0);
  }

  // --- Свои списки ---

  createList(name) {
    const clean = String(name || "").trim().slice(0, 40);
    if (!clean) return null;
    const existing = this.lists.find(l => l.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    const list = { id: makeId("list"), name: clean, emoji: "•" };
    this.lists.push(list);
    this.saveState();
    return list;
  }

  promptNewList() {
    const name = window.prompt("Название нового списка");
    if (name === null) return;
    const list = this.createList(name);
    if (!list) {
      this.showToast("Название не может быть пустым");
      return;
    }
    this.setView(list.id);
  }

  renameCurrentList() {
    const list = this.lists.find(l => l.id === this.view);
    if (!list) return;
    const name = window.prompt("Новое название списка", list.name);
    if (name === null || !name.trim()) return;
    list.name = name.trim().slice(0, 40);
    this.saveState();
    this.render();
  }

  deleteCurrentList() {
    const list = this.lists.find(l => l.id === this.view);
    if (!list || list.id === "inbox") return;
    const count = this.tasks.filter(t => t.list === list.id).length;
    const ok = window.confirm(count ? `Удалить список «${list.name}»? ${count} задач(и) перейдут во «Входящие».` : `Удалить список «${list.name}»?`);
    if (!ok) return;
    this.tasks.forEach(t => { if (t.list === list.id) t.list = "inbox"; });
    this.lists = this.lists.filter(l => l.id !== list.id);
    this.saveState();
    this.setView("inbox");
    this.showToast("Список удалён");
  }

  clearDone() {
    const n = this.tasks.filter(t => t.done).length;
    if (!n || !window.confirm(`Удалить ${n} выполненных задач навсегда?`)) return;
    this.tasks = this.tasks.filter(t => !t.done);
    this.saveState();
    this.render();
  }

  setView(view) {
    this.view = view;
    this.searchQuery = "";
    if (this.taskSearch) this.taskSearch.value = "";
    this.playHapticTone("tap");
    this.renderDrawer();
    this.drawerTasksList.scrollTop = 0;
  }

  // --- Сроки и уведомления за час ---

  startDeadlineWatcher() {
    this.checkDeadlines();
    clearInterval(this.deadlineInterval);
    this.deadlineInterval = setInterval(() => {
      this.checkDeadlines();
      // Перерисовка раз в день (подписи «Сегодня/Завтра») и на смене состояний срока
      if (localDateKey() !== this.lastRenderDay) this.render();
    }, DEADLINE_CHECK_MS);
  }

  checkDeadlines() {
    const now = Date.now();
    let changed = false;
    for (const t of this.tasks) {
      if (t.done || !t.due) continue;
      const d = parseLocalISO(t.due);
      if (!d) continue;
      const left = d.getTime() - now;
      if (left <= 0) {
        if (!t.nDue) {
          t.nDue = true;
          t.n1h = true;
          changed = true;
          if (-left < STALE_ALERT_MS) this.alertDeadline(t, "⏰ Срок вышел", `«${t.action}» — срок был ${formatDue(t.due)}`);
        }
      } else if (left <= HOUR_MS && !t.n1h) {
        t.n1h = true;
        changed = true;
        const mins = Math.max(1, Math.round(left / 60000));
        const title = mins >= 58 ? "⏳ Через час срок" : `⏳ До срока ${mins} мин`;
        this.alertDeadline(t, title, `«${t.action}» — нужно успеть до ${formatDue(t.due).toLowerCase()}`);
      }
    }
    if (changed) {
      this.saveState();
      this.render();
    }
  }

  alertDeadline(task, title, body) {
    this.sendNotification(title, body, `now-due-${task.id}`);
    if (!document.hidden) {
      this.showToast(`${title}: ${task.action}`);
      this.playHapticTone("zen");
    }
  }

  openEditor(id = null) {
    this.playHapticTone("tap");
    this.closeAllOverlays({ keepDrawer: true });
    const task = id ? this.getTaskById(id) : null;
    this.editIsNew = !task;
    const todayKey = localDateKey();
    this.editDraft = task
      ? JSON.parse(JSON.stringify(task))
      : this.normalizeTask({
          id: makeId(),
          action: "",
          list: this.lists.some(l => l.id === this.view) ? this.view : "inbox",
          important: this.view === "important",
          myDay: this.view === "myday" ? todayKey : null,
          durationMinutes: 5
        });
    const d = this.editDraft;

    this.editSheetTitle.textContent = this.editIsNew ? "Новая задача" : "Задача";
    this.editTitle.value = d.action;
    this.editNotes.value = d.notes;
    const due = parseLocalISO(d.due);
    this.editDate.value = due ? localDateKey(due) : "";
    this.setEditorTime(due ? `${pad2(due.getHours())}:${pad2(due.getMinutes())}` : "");
    this.editRepeat.value = d.repeat;
    this.editList.innerHTML = this.lists.map(l => `<option value="${this.escapeHtml(l.id)}">${this.escapeHtml((l.emoji && l.emoji !== "•" ? l.emoji + " " : "") + l.name)}</option>`).join("");
    this.editList.value = d.list;
    const durations = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 45, 60, 90, 120];
    if (!durations.includes(d.durationMinutes)) durations.push(d.durationMinutes);
    this.editDuration.innerHTML = durations.sort((a, b) => a - b).map(m => `<option value="${m}">${m} мин</option>`).join("");
    this.editDuration.value = String(d.durationMinutes);
    this.editDeleteBtn.style.display = this.editIsNew ? "none" : "";
    this.editFocusBtn.style.display = this.editIsNew || d.done ? "none" : "";
    this.subtaskInput.value = "";
    this.renderEditorState();

    this.editSheetBackdrop.classList.add("active");
    if (this.editIsNew) setTimeout(() => this.editTitle.focus(), 250);
  }

  renderEditorState() {
    const d = this.editDraft;
    if (!d) return;
    this.editPriority.querySelectorAll("[data-p]").forEach(b => b.classList.toggle("active", Number(b.dataset.p) === d.priority));
    this.editImportant.classList.toggle("active", d.important);
    this.editImportant.textContent = d.important ? "★ Важное" : "☆ Важное";
    const inMyDay = d.myDay === localDateKey();
    this.editMyDay.classList.toggle("active", inMyDay);
    this.editMyDay.textContent = inMyDay ? "☀️ В моём дне" : "☀️ Мой день";
    this.editSubtasks.innerHTML = d.subtasks.map(s => `
      <div class="subtask-row ${s.done ? "is-done" : ""}" data-sub="${this.escapeHtml(s.id)}">
        <button class="todo-check small" type="button" data-sub-action="toggle" aria-label="Выполнить шаг">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <span class="subtask-text">${this.escapeHtml(s.text)}</span>
        <button class="delete-task-btn" type="button" data-sub-action="delete" aria-label="Удалить шаг">✕</button>
      </div>`).join("");
    this.updateDueHint();
  }

  // Читаем дату/время из полей. Пустое время = время по умолчанию; пустая дата при заданном времени = ближайший такой момент

  readEditorDue() {
    const dateStr = this.editDate.value;
    const timeStr = this.getEditorTime();
    if (!dateStr && !timeStr) return { due: null };
    const now = new Date();
    let date;
    if (dateStr) {
      const [y, m, dd] = dateStr.split("-").map(Number);
      date = new Date(y, m - 1, dd);
      if (!y || date.getDate() !== dd) return { error: "Неверная дата" };
    }
    let hh, mm;
    if (timeStr) {
      const mt = /^(\d{1,2}):(\d{2})/.exec(timeStr);
      if (!mt || +mt[1] > 23 || +mt[2] > 59) return { error: "Время должно быть от 00:00 до 23:59" };
      hh = +mt[1]; mm = +mt[2];
      if (!date) {
        date = startOfDay(now);
        if (hh * 60 + mm <= now.getHours() * 60 + now.getMinutes()) date = addDays(date, 1);
      }
    } else {
      [hh, mm] = defaultTimeFor(date, now).split(":").map(Number);
    }
    return { due: toLocalISO(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm)) };
  }

  updateDueHint() {
    const { due, error } = this.readEditorDue();
    const hint = this.editDueHint;
    hint.classList.remove("warn");
    if (error) {
      hint.textContent = error;
      hint.classList.add("warn");
    } else if (!due) {
      hint.textContent = "Без срока. Выбери дату и время — напомним за час.";
    } else {
      const left = parseLocalISO(due) - Date.now();
      if (left <= 0) {
        hint.textContent = `${formatDue(due)} — это время уже прошло`;
        hint.classList.add("warn");
      } else {
        hint.textContent = left > HOUR_MS
          ? `${formatDue(due)} · напомним в ${formatDue(toLocalISO(new Date(parseLocalISO(due) - HOUR_MS))).split(", ").pop()} (за час)`
          : `${formatDue(due)} · меньше часа — напомним сразу`;
      }
    }
  }

  setEditorQuickDue(kind) {
    const now = new Date();
    if (kind === "none") {
      this.editDate.value = "";
      this.setEditorTime("");
      this.editRepeat.value = "none";
    } else {
      const base = kind === "today" ? startOfDay(now) : kind === "tomorrow" ? addDays(startOfDay(now), 1) : addDays(startOfDay(now), (8 - now.getDay()) % 7 || 7);
      this.editDate.value = localDateKey(base);
      const cur = this.getEditorTime();
      if (!cur || (kind === "today" && parseLocalISO(`${localDateKey(base)}T${cur}`) <= now)) {
        this.setEditorTime(defaultTimeFor(base, now));
      }
    }
    this.playHapticTone("tap");
    this.updateDueHint();
  }

  saveEditor() {
    const d = this.editDraft;
    if (!d) return;
    const title = this.editTitle.value.trim();
    if (!title) {
      this.showToast("Напиши название задачи");
      this.editTitle.focus();
      return;
    }
    const { due, error } = this.readEditorDue();
    if (error) {
      this.showToast(error);
      return;
    }
    const repeat = this.editRepeat.value;

    d.action = title;
    d.notes = this.editNotes.value.trim();
    d.list = this.editList.value;
    d.durationMinutes = Number(this.editDuration.value) || 5;
    d.repeat = repeat;
    // Повтор без срока: считаем от сегодняшнего дня
    let finalDue = due;
    if (repeat !== "none" && !finalDue) {
      const today = startOfDay(new Date());
      finalDue = `${localDateKey(today)}T${defaultTimeFor(today)}`;
    }
    const old = this.editIsNew ? null : this.getTaskById(d.id);
    if (!old || old.due !== finalDue) {
      d.n1h = false; // срок изменился — уведомления заново
      d.nDue = false;
    }
    d.due = finalDue;
    if (this.editIsNew && !d.parentGoal) d.parentGoal = this.guessParentGoal(title);

    const task = this.normalizeTask(d);
    if (old) {
      this.tasks[this.tasks.indexOf(old)] = task;
    } else {
      this.tasks.unshift(task);
    }
    this.saveState();
    this.closeEditor();
    this.checkDeadlines();
    this.render();
    this.playHapticTone("tap");
    this.showToast(this.editIsNew ? "Задача добавлена" : "Сохранено");
  }

  // Время — два списка (часы 00–23, минуты 00–59): формат 24 ч на любом устройстве
  fillTimeSelects() {
    if (this.editHour.options.length) return;
    this.editHour.innerHTML = `<option value="">--</option>` + Array.from({ length: 24 }, (_, h) => `<option value="${pad2(h)}">${pad2(h)}</option>`).join("");
    this.editMinute.innerHTML = `<option value="">--</option>` + Array.from({ length: 60 }, (_, m) => `<option value="${pad2(m)}">${pad2(m)}</option>`).join("");
  }

  getEditorTime() {
    const h = this.editHour.value;
    const m = this.editMinute.value;
    if (!h && !m) return "";
    return `${h || "00"}:${m || "00"}`;
  }

  setEditorTime(hhmm) {
    this.fillTimeSelects();
    const [h, m] = hhmm ? hhmm.split(":") : ["", ""];
    this.editHour.value = h;
    this.editMinute.value = m;
  }

  closeEditor() {
    this.editSheetBackdrop.classList.remove("active");
    this.editDraft = null;
  }

  deleteFromEditor() {
    const d = this.editDraft;
    if (!d || this.editIsNew) return;
    this.closeEditor();
    this.removeTask(d.id);
    this.showToast("Задача удалена");
  }

  pluralTasks(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "задача";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "задачи";
    return "задач";
  }

  // Каждое дело = одна задача с ТВОИМ текстом. Категория только подписывает её,
  // срок/приоритет/#список берутся из текста («завтра в 15:00 !1 #Работа»).

  renderDumpListChips() {
    if (!this.dumpListChips) return;
    const chip = (id, label) => `<button type="button" class="preset-chip ${this.dumpListId === id ? "active" : ""}" data-list="${this.escapeHtml(id || "")}">${this.escapeHtml(label)}</button>`;
    this.dumpListChips.innerHTML = chip(null, "✨ Авто") +
      this.lists.map(l => chip(l.id, `${l.emoji && l.emoji !== "•" ? l.emoji + " " : ""}${l.name}`)).join("");
  }

  // --- Brain Dump & Decomposition ---
  handleBrainDump(text) {
    if (!text || !text.trim()) {
      this.showToast("Напиши хотя бы одно дело");
      this.dumpTextarea.focus();
      return;
    }

    const newItems = this.atomizeThought(text.trim());
    if (newItems.length === 0) {
      this.showToast("Не получилось разобрать — попробуй написать подробнее");
      return;
    }

    this.tasks.unshift(...newItems);
    this.saveState();
    this.checkDeadlines();
    this.closeDumpSheet(true);
    this.playHapticTone("chime");

    const word = this.pluralTasks(newItems.length);
    if (this.isTimerRunning) {
      // Не сбиваем текущий таймер — новые задачи ждут своей очереди
      this.showToast(`✨ Добавлено ${newItems.length} ${word} — после текущей`);
      this.render();
      return;
    }

    this.currentId = newItems[0].id;
    this.isLazyModeActive = false;
    if (this.activeTimeFilter && newItems[0].durationMinutes > this.activeTimeFilter) {
      this.activeTimeFilter = null;
    }
    this.showToast(`✨ Добавлено ${newItems.length} ${word}`);
    this.animateCardSwitch();
  }

  // Убираем «надо», «нужно», «не забыть» и т.п. в начале фразы
  stripFillers(text) {
    return text.replace(/^(?:(?:мне\s+)?(?:надо|нужно|необходимо|хочу|не\s+забыть|обязательно|срочно)\s+)+/i, "").trim();
  }

  // Начинается ли фрагмент с глагола (инфинитив или частая повелительная форма)
  isActionLike(fragment) {
    const first = this.stripFillers(fragment).split(/\s+/)[0] || "";
    return /^[а-яё-]+(?:ть|ти|чь|ться|тись)$/i.test(first) ||
      /^(?:купи|позвони|напиши|сделай|убери|помой|отправь|оплати|проверь|найди|сходи|забери|закажи|прочитай|ответь|спроси|запиши)$/i.test(first);
  }

  // Разбиваем ввод на отдельные дела: строки, «;», запятые, « и », точки
  splitThoughts(input) {
    const result = [];
    const lines = input.split(/[\n;]+/).map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      const parts = line
        .split(/\s*,\s*|\s+и\s+|\s+а\s+также\s+|[.!?]+\s+/i)
        .map(p => p.trim().replace(/[.,!?;:]+$/, "").trim())
        .filter(p => p.length > 1);

      if (parts.length <= 1) {
        if (parts.length === 1) result.push(parts[0]);
        continue;
      }

      const hasVerbs = parts.some(p => this.isActionLike(p));
      if (!hasVerbs) {
        // Просто список дел без глаголов: «уборка, документы, звонок»
        result.push(...parts);
        continue;
      }

      // «купить молоко, хлеб и яйца» — хвосты без глагола приклеиваем к предыдущему делу
      const merged = [];
      for (const p of parts) {
        if (this.isActionLike(p) || merged.length === 0) {
          merged.push(p);
        } else {
          merged[merged.length - 1] += `, ${p}`;
        }
      }
      result.push(...merged);
    }
    return result;
  }

  cleanText(text) {
    const t = this.stripFillers(text).replace(/\s+/g, " ").replace(/[.,!?;:]+$/, "").trim() || text.trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  truncate(text, max) {
    return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
  }

  atomizeThought(input) {
    const thoughts = this.splitThoughts(input);
    const todayKey = localDateKey();
    const items = [];

    for (const thought of thoughts) {
      const parsed = parseQuickInput(thought);
      const cleaned = this.cleanText(parsed.title || thought);
      if (cleaned.length < 2) continue;
      const category = this.guessParentGoal(cleaned);

      let listId = this.dumpListId;
      if (parsed.listName) {
        const found = this.lists.find(l => l.name.toLowerCase() === parsed.listName.toLowerCase());
        listId = found ? found.id : this.createList(parsed.listName).id;
      }
      if (!listId) {
        const byCategory = this.lists.find(l => l.name.toLowerCase() === category.toLowerCase());
        listId = byCategory ? byCategory.id : "inbox";
      }

      items.push(this.normalizeTask({
        id: makeId(),
        parentGoal: category,
        action: cleaned,
        reason: "Выгружено из головы — сделай сейчас.",
        durationMinutes: this.guessDuration(cleaned),
        lazyVersion: "Удели этому ровно 1 минуту — просто начни",
        list: listId,
        due: parsed.due,
        priority: parsed.priority,
        myDay: todayKey
      }));
    }
    return items;
  }

  guessParentGoal(text) {
    const lower = text.toLowerCase();
    const cat = PARENT_CATEGORIES.find(c => c.regex.test(lower));
    return cat ? cat.label : "Задача";
  }

  guessDuration(text) {
    const lower = text.toLowerCase();
    if (wordRegex(["ответит", "написат", "напиши", "сообщ", "позвон", "отправ", "реакц"]).test(lower)) return 3;
    if (wordRegex(["купит", "оплат", "заплат", "перевод", "перевест"]).test(lower)) return 5;
    if (wordRegex(["убор", "убра", "стир", "помыт", "посуд"]).test(lower)) return 10;
    if (wordRegex(["презентац", "отч[её]т", "проект", "слайд"]).test(lower)) return 15;
    return 7;
  }

  // --- Voice Input (Web Speech API) ---
  toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.showToast("Голосовой ввод не поддерживается этим браузером");
      return;
    }

    if (this.recognition && this.isRecordingVoice) {
      this.recognition.stop();
      return;
    }

    const resetUi = () => {
      this.isRecordingVoice = false;
      this.voiceInputBtn.classList.remove("recording");
      this.voiceBtnText.textContent = "Голос";
    };

    try {
      this.recognition = new SpeechRecognition();
    } catch (e) {
      this.showToast("Микрофон недоступен");
      return;
    }
    this.recognition.lang = "ru-RU";
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isRecordingVoice = true;
      this.voiceInputBtn.classList.add("recording");
      this.voiceBtnText.textContent = "Слушаю...";
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const prev = this.dumpTextarea.value.trim();
      this.dumpTextarea.value = prev ? `${prev}\n${transcript}` : transcript;
    };

    this.recognition.onend = resetUi;
    this.recognition.onerror = (e) => {
      resetUi();
      if (e && (e.error === "not-allowed" || e.error === "service-not-allowed")) {
        this.showToast("Разреши доступ к микрофону в настройках");
      }
    };

    try {
      this.recognition.start();
    } catch (e) {
      resetUi();
    }
  }

  stopVoiceInput() {
    if (this.recognition && this.isRecordingVoice) {
      try { this.recognition.stop(); } catch (e) { /* ignore */ }
    }
  }

  // --- Sheets & Modals Management ---
  closeAllOverlays({ keepDrawer = false } = {}) {
    this.closeDumpSheet();
    this.closeTimeSheet();
    if (!keepDrawer) this.closeDrawer();
    this.closePomodoroSheet();
    if (this.editSheetBackdrop) this.closeEditor();
  }

  isAnyOverlayOpen() {
    return document.querySelector(".sheet-backdrop.active, .drawer-backdrop.active") !== null;
  }

  openDumpSheet() {
    this.playHapticTone("tap");
    this.closeAllOverlays();
    this.renderDumpListChips();
    this.dumpSheetBackdrop.classList.add("active");
    setTimeout(() => this.dumpTextarea.focus(), 250);
  }

  // Текст стираем только после успешного добавления — случайное закрытие его не теряет
  closeDumpSheet(clearText = false) {
    this.dumpSheetBackdrop.classList.remove("active");
    this.stopVoiceInput();
    if (clearText) this.dumpTextarea.value = "";
  }

  openTimeSheet() {
    this.playHapticTone("tap");
    this.closeAllOverlays();
    this.timeSheetBackdrop.classList.add("active");
  }

  closeTimeSheet() {
    this.timeSheetBackdrop.classList.remove("active");
  }

  openDrawer(view = null) {
    this.playHapticTone("tap");
    this.closeAllOverlays();
    if (view) {
      this.view = view;
      this.searchQuery = "";
      if (this.taskSearch) this.taskSearch.value = "";
    }
    this.renderDrawer();
    this.listDrawerBackdrop.classList.add("active");
  }

  closeDrawer() {
    this.listDrawerBackdrop.classList.remove("active");
  }

  // --- Theme ---
  applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (this.themeColorMeta) {
      this.themeColorMeta.setAttribute("content", theme === "dark" ? "#000000" : "#F7F7F9");
    }
  }

  toggleTheme() {
    this.playHapticTone("tap");
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    this.applyTheme(nextTheme);
    store.set(STORAGE.theme, nextTheme);
  }

  // --- Toast Notification ---
  showToast(msg) {
    this.toast.textContent = msg;
    this.toast.classList.add("show");
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.remove("show");
    }, 2800);
  }

  // --- Confetti Celebration ---
  triggerConfetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = this.confettiCanvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (this.confettiFrame) cancelAnimationFrame(this.confettiFrame);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#0071E3", "#34C759", "#FF9500", "#FF2D55", "#AF52DE", "#5856D6"];
    const pieces = Array.from({ length: 60 }, () => ({
      x: canvas.width / 2,
      y: canvas.height * 0.45,
      radius: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.8) * 12,
      gravity: 0.25,
      opacity: 1
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.opacity -= 0.015;
        if (p.opacity > 0) {
          alive = true;
          ctx.globalAlpha = p.opacity;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;

      if (alive) {
        this.confettiFrame = requestAnimationFrame(draw);
      } else {
        this.confettiFrame = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    draw();
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str == null ? "" : str);
    return div.innerHTML;
  }

  // --- Attach Event Listeners ---
  attachEvents() {
    // Stage buttons
    this.startBtn.addEventListener("click", () => this.startTimer());
    this.pauseBtn.addEventListener("click", () => this.pauseTimer());
    this.finishBtn.addEventListener("click", () => this.completeCurrentTask());
    this.skipBtn.addEventListener("click", () => this.skipCurrentTask());
    this.lazyBtn.addEventListener("click", () => this.activateLazyMode());
    this.emptyAddBtn.addEventListener("click", () => this.openDumpSheet());
    this.showAllBtn.addEventListener("click", () => {
      this.activeTimeFilter = null;
      this.showToast("Показываем все задачи");
      this.animateCardSwitch();
    });

    // Top bar buttons
    this.themeToggleBtn.addEventListener("click", () => this.toggleTheme());
    this.listToggleBtn.addEventListener("click", () => this.openDrawer());
    this.timeFilterBtn.addEventListener("click", () => this.openTimeSheet());
    this.dumpTriggerBtn.addEventListener("click", (e) => {
      // Иконка микрофона сразу включает голосовой ввод
      const withVoice = this.dumpMicBtn && this.dumpMicBtn.contains(e.target);
      this.openDumpSheet();
      if (withVoice) this.toggleVoiceInput();
    });

    if (this.sidebarAddBtn) {
      this.sidebarAddBtn.addEventListener("click", () => this.openDumpSheet());
    }

    // Brain dump sheet events
    this.dumpCloseBtn.addEventListener("click", () => this.closeDumpSheet());
    this.dumpSheetBackdrop.addEventListener("click", (e) => {
      if (e.target === this.dumpSheetBackdrop) this.closeDumpSheet();
    });
    this.dumpForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleBrainDump(this.dumpTextarea.value);
    });
    // Cmd/Ctrl + Enter отправляет форму
    this.dumpTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.handleBrainDump(this.dumpTextarea.value);
      }
    });
    this.voiceInputBtn.addEventListener("click", () => this.toggleVoiceInput());

    // Чипы списков: выбирают, КУДА положить задачи. Текст не трогают.
    this.dumpListChips.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-list]");
      if (!chip) return;
      this.dumpListId = chip.dataset.list || null;
      this.playHapticTone("tap");
      this.renderDumpListChips();
    });

    // Time filter presets
    document.querySelectorAll(".time-slot-card").forEach(card => {
      card.addEventListener("click", () => {
        const mins = card.getAttribute("data-minutes");
        if (mins === "all") {
          this.activeTimeFilter = null;
          this.showToast("Показываем все задачи");
        } else {
          this.activeTimeFilter = parseInt(mins, 10);
          this.showToast(`Задачи до ${this.activeTimeFilter} минут`);
        }
        this.closeTimeSheet();
        if (!this.isTimerRunning) {
          this.isLazyModeActive = false;
          const fits = this.getActiveTasks();
          this.currentId = fits.length ? fits[0].id : null;
        }
        this.animateCardSwitch();
      });
    });

    this.timeCloseBtn.addEventListener("click", () => this.closeTimeSheet());
    this.timeSheetBackdrop.addEventListener("click", (e) => {
      if (e.target === this.timeSheetBackdrop) this.closeTimeSheet();
    });

    // Drawer events
    this.listCloseBtn.addEventListener("click", () => this.closeDrawer());
    this.listBackBtn.addEventListener("click", () => this.closeDrawer());
    this.drawerExitBtn.addEventListener("click", () => this.closeDrawer());
    this.drawerAddBtn.addEventListener("click", () => this.openEditor(null));
    this.listDrawerBackdrop.addEventListener("click", (e) => {
      if (e.target === this.listDrawerBackdrop) this.closeDrawer();
    });
    this.forceNotifBtn.addEventListener("click", () => this.onManualNotifRequest());

    // Вкладки списков
    this.listTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".list-tab");
      if (!btn) return;
      if (btn.dataset.action === "new-list") this.promptNewList();
      else this.setView(btn.dataset.view);
    });
    this.listActions.addEventListener("click", (e) => {
      const act = e.target.closest("[data-action]");
      if (!act) return;
      if (act.dataset.action === "clear-done") this.clearDone();
      if (act.dataset.action === "rename-list") this.renameCurrentList();
      if (act.dataset.action === "delete-list") this.deleteCurrentList();
    });

    // Строки задач: один обработчик на весь список
    this.drawerTasksList.addEventListener("click", (e) => {
      const row = e.target.closest(".todo-row");
      if (!row) return;
      const id = row.dataset.id;
      const act = e.target.closest("[data-action]");
      const action = act ? act.dataset.action : "edit";
      if (action === "toggle") this.toggleTaskDone(id);
      else if (action === "star") this.toggleImportant(id);
      else this.openEditor(id);
    });

    this.taskSearch.addEventListener("input", () => {
      this.searchQuery = this.taskSearch.value;
      this.renderDrawer();
    });

    this.quickAddForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (this.addQuickTask(this.quickAddInput.value)) {
        this.quickAddInput.value = "";
        this.updateQuickAddHint();
      }
    });
    this.quickAddInput.addEventListener("input", () => this.updateQuickAddHint());

    // Боковая панель (компьютер)
    if (this.sidebarNav) {
      this.sidebarNav.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-view]");
        if (btn) this.openDrawer(btn.dataset.view);
      });
    }
    this.sidebarTasksList.addEventListener("click", (e) => {
      const item = e.target.closest("[data-id]");
      if (item) this.jumpToTask(item.dataset.id);
    });

    // Срок на карточке → редактор
    this.cardDue.addEventListener("click", () => {
      const t = this.getCurrentTask();
      if (t) this.openEditor(t.id);
    });

    // Редактор задачи
    this.editCloseBtn.addEventListener("click", () => this.closeEditor());
    this.editSheetBackdrop.addEventListener("click", (e) => {
      if (e.target === this.editSheetBackdrop) this.closeEditor();
    });
    this.editSaveBtn.addEventListener("click", () => this.saveEditor());
    this.editDeleteBtn.addEventListener("click", () => this.deleteFromEditor());
    this.editFocusBtn.addEventListener("click", () => {
      const id = this.editDraft && this.editDraft.id;
      this.saveEditor();
      this.closeDrawer();
      if (id) this.jumpToTask(id);
    });
    this.editTitle.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); this.saveEditor(); }
    });
    this.editDate.addEventListener("input", () => {
      if (this.editDate.value && !this.getEditorTime()) {
        const [y, m, d] = this.editDate.value.split("-").map(Number);
        this.setEditorTime(defaultTimeFor(new Date(y, m - 1, d)));
      }
      this.updateDueHint();
    });
    this.editHour.addEventListener("change", () => {
      if (this.editHour.value && !this.editMinute.value) this.editMinute.value = "00";
      this.updateDueHint();
    });
    this.editMinute.addEventListener("change", () => {
      if (this.editMinute.value && !this.editHour.value) this.editHour.value = "00";
      this.updateDueHint();
    });
    document.querySelectorAll("[data-due]").forEach(btn => {
      btn.addEventListener("click", () => this.setEditorQuickDue(btn.dataset.due));
    });
    this.editPriority.addEventListener("click", (e) => {
      const b = e.target.closest("[data-p]");
      if (!b || !this.editDraft) return;
      this.editDraft.priority = Number(b.dataset.p);
      this.playHapticTone("tap");
      this.renderEditorState();
    });
    this.editImportant.addEventListener("click", () => {
      if (!this.editDraft) return;
      this.editDraft.important = !this.editDraft.important;
      this.renderEditorState();
    });
    this.editMyDay.addEventListener("click", () => {
      if (!this.editDraft) return;
      const today = localDateKey();
      this.editDraft.myDay = this.editDraft.myDay === today ? null : today;
      this.renderEditorState();
    });
    this.subtaskForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = this.subtaskInput.value.trim();
      if (!text || !this.editDraft) return;
      this.editDraft.subtasks.push({ id: makeId("sub"), text, done: false });
      this.subtaskInput.value = "";
      this.renderEditorState();
    });
    this.editSubtasks.addEventListener("click", (e) => {
      const row = e.target.closest("[data-sub]");
      const act = e.target.closest("[data-sub-action]");
      if (!row || !act || !this.editDraft) return;
      const sub = this.editDraft.subtasks.find(x => x.id === row.dataset.sub);
      if (!sub) return;
      if (act.dataset.subAction === "toggle") sub.done = !sub.done;
      else this.editDraft.subtasks = this.editDraft.subtasks.filter(x => x !== sub);
      this.playHapticTone("tap");
      this.renderEditorState();
    });

    // Notification permission sheet
    this.notifAllowBtn.addEventListener("click", () => this.requestNotifPermission());
    this.notifLaterBtn.addEventListener("click", () => {
      store.set(STORAGE.notifAsked, "later");
      this.closeNotifSheet();
    });

    // Keyboard: Escape закрывает окна, пробел — старт/пауза
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        // Сначала закрываем верхнее окно (редактор поверх списка)
        if (this.editSheetBackdrop.classList.contains("active")) { this.closeEditor(); return; }
        this.closeAllOverlays();
        this.closeNotifSheet();
        return;
      }
      if (e.code === "Space" || e.key === " ") {
        const tag = (e.target && e.target.tagName) || "";
        if (/^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
        if (this.isAnyOverlayOpen() || !this.getCurrentTask()) return;
        e.preventDefault();
        if (this.isTimerRunning) this.pauseTimer();
        else this.startTimer();
      }
    });

    // Когда вкладка/приложение снова активно — сразу пересчитываем таймеры
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      this.tickTimer();
      this.tickPomodoro();
      this.render();
    });

    // --- Pomodoro events ---
    this.pomodoroBtn.addEventListener("click", () => this.openPomodoroSheet());
    this.pomodoroCloseBtn.addEventListener("click", () => this.closePomodoroSheet());
    this.pomodoroSheetBackdrop.addEventListener("click", (e) => {
      if (e.target === this.pomodoroSheetBackdrop) this.closePomodoroSheet();
    });

    document.querySelectorAll(".pomo-step-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-target");
        const delta = parseInt(btn.getAttribute("data-delta"), 10);
        this.pomoStepperChange(target, delta);
      });
    });

    this.pomoStartSessionBtn.addEventListener("click", () => this.pomoStartSession());
    this.pomoPauseBtn.addEventListener("click", () => this.pomoPauseResume());
    this.pomoSkipBtn.addEventListener("click", () => this.pomoSkipPhase());
    this.pomoStopBtn.addEventListener("click", () => this.pomoStopSession());

    this.setupIOSBanner();
    this.maybeAskNotifications();
    this.registerServiceWorker();
  }

  // ==========================================================================
  // Web Notifications
  // ==========================================================================

  // При первом входе показываем своё окно. Системный запрос вызывается только
  // по нажатию кнопки — иначе iOS/Safari его молча игнорирует.
  maybeAskNotifications() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (store.get(STORAGE.notifAsked)) return;
    setTimeout(() => {
      if (Notification.permission !== "default") return;
      this.closeAllOverlays();
      this.notifSheetBackdrop.classList.add("active");
    }, 1200);
  }

  closeNotifSheet() {
    this.notifSheetBackdrop.classList.remove("active");
  }

  requestNotifPermission() {
    store.set(STORAGE.notifAsked, "asked");
    this.closeNotifSheet();
    if (!("Notification" in window)) {
      this.showToast("Уведомления не поддерживаются");
      return;
    }

    let handled = false;
    const onResult = (permission) => {
      if (handled) return;
      handled = true;
      if (permission === "granted") {
        this.showToast("✨ Уведомления включены!");
        this.sendNotification("🔔 NOW: Уведомления работают!", "Мы напомним, когда закончится таймер.");
      } else if (permission === "denied") {
        this.showToast("Уведомления выключены. Включить можно в настройках");
      }
    };

    try {
      // Старый Safari принимает колбэк, новые браузеры возвращают Promise
      const result = Notification.requestPermission(onResult);
      if (result && typeof result.then === "function") {
        result.then(onResult).catch(() => onResult("default"));
      }
    } catch (e) {
      onResult("default");
    }
  }

  onManualNotifRequest() {
    if (!("Notification" in window)) {
      const isIOS = this.isIOSDevice();
      this.showToast(isIOS ? "На iPhone уведомления работают после «На экран Домой»" : "Уведомления не поддерживаются");
      return;
    }
    if (Notification.permission === "granted") {
      this.showToast("Уведомления уже включены ✅");
      this.sendNotification("🔔 NOW", "Тестовое уведомление — всё работает.");
      return;
    }
    if (Notification.permission === "denied") {
      this.showToast("Уведомления запрещены — разреши их в настройках браузера");
      return;
    }
    this.requestNotifPermission();
  }

  async sendNotification(title, body, tag = "now-timer-alert") {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const options = {
      body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      vibrate: [200, 100, 200],
      tag,
      renotify: true
    };
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) {
          await reg.showNotification(title, options);
          return;
        }
      }
      new Notification(title, { body, icon: "icon-192.png", tag });
    } catch (e) {
      console.warn("Notification send error:", e);
    }
  }

  // --- Редактор задачи ---

  // ==========================================================================
  // Pomodoro Engine (timestamps)
  // ==========================================================================

  openPomodoroSheet() {
    this.playHapticTone("tap");
    this.closeAllOverlays();
    this.pomodoroSheetBackdrop.classList.add("active");
    this.renderPomodoroUI();
  }

  closePomodoroSheet() {
    this.pomodoroSheetBackdrop.classList.remove("active");
  }

  pomoStepperChange(target, delta) {
    this.playHapticTone("tap");
    if (target === "pomoWork") {
      this.pomoWorkMinutes = Math.max(5, Math.min(60, this.pomoWorkMinutes + delta));
    } else if (target === "pomoBreak") {
      this.pomoBreakMinutes = Math.max(1, Math.min(30, this.pomoBreakMinutes + delta));
    } else if (target === "pomoLong") {
      this.pomoLongBreakMinutes = Math.max(5, Math.min(45, this.pomoLongBreakMinutes + delta));
    }
    this.savePomoSettings();
    this.renderPomodoroUI();
  }

  pomoStartSession() {
    this.playHapticTone("zen");
    this.pomoIsRunning = true;
    this.pomoCurrentCycle = 0;
    this.pomoPhase = "work";
    this.pomoStartPhaseTimer();
    this.renderPomodoroUI();
  }

  pomoPhaseMinutes() {
    if (this.pomoPhase === "work") return this.pomoWorkMinutes;
    if (this.pomoPhase === "break") return this.pomoBreakMinutes;
    return this.pomoLongBreakMinutes;
  }

  pomoStartPhaseTimer() {
    this.pomoTotalSeconds = this.pomoPhaseMinutes() * 60;
    this.pomoEndAt = Date.now() + this.pomoTotalSeconds * 1000;
    this.pomoIsPaused = false;
    this.pomoRunLoop();
    this.updatePomoDots();
  }

  pomoRunLoop() {
    clearInterval(this.pomoInterval);
    this.tickPomodoro();
    this.pomoInterval = setInterval(() => this.tickPomodoro(), TIMER_TICK_MS);
  }

  tickPomodoro() {
    if (!this.pomoIsRunning || this.pomoIsPaused) return;
    const leftMs = Math.max(0, this.pomoEndAt - Date.now());
    this.pomoSecondsLeft = Math.ceil(leftMs / 1000);
    this.updatePomoTimerDisplay();
    if (leftMs <= 0) {
      clearInterval(this.pomoInterval);
      this.pomoInterval = null;
      this.pomoPhaseComplete(true);
    }
  }

  pomoPhaseComplete(notify) {
    const say = (title, body) => {
      this.showToast(title);
      if (notify && document.hidden) this.sendNotification(title, body);
    };

    if (this.pomoPhase === "work") {
      this.pomoCurrentCycle++;
      this.playHapticTone("chime");
      if (this.pomoCurrentCycle >= this.pomoCyclesBeforeLong) {
        this.pomoPhase = "longbreak";
        say("🌿 Длинный перерыв! Ты заслужил.",
          `${this.pomoCyclesBeforeLong} помидора завершено! Отдохни ${this.pomoLongBreakMinutes} мин.`);
      } else {
        this.pomoPhase = "break";
        say(`☕ Перерыв! ${this.pomoCurrentCycle}/${this.pomoCyclesBeforeLong} помидоров`,
          `Отличная работа! Отдохни ${this.pomoBreakMinutes} мин.`);
      }
    } else {
      this.playHapticTone("zen");
      if (this.pomoPhase === "longbreak") this.pomoCurrentCycle = 0;
      this.pomoPhase = "work";
      say("🍅 Фокус! Время работать.", "Перерыв окончен. Возвращаемся к задаче!");
    }

    this.pomoStartPhaseTimer();
    this.renderPomodoroUI();
  }

  pomoPauseResume() {
    if (!this.pomoIsRunning) return;
    this.playHapticTone("tap");
    if (this.pomoIsPaused) {
      this.pomoIsPaused = false;
      this.pomoEndAt = Date.now() + this.pomoRemainingMs;
      this.pomoRunLoop();
    } else {
      this.pomoRemainingMs = Math.max(0, this.pomoEndAt - Date.now());
      this.pomoIsPaused = true;
      clearInterval(this.pomoInterval);
      this.pomoInterval = null;
    }
    this.renderPomodoroUI();
  }

  pomoSkipPhase() {
    this.playHapticTone("tap");
    clearInterval(this.pomoInterval);
    this.pomoInterval = null;
    this.pomoPhaseComplete(false);
  }

  pomoStopSession() {
    this.playHapticTone("tap");
    clearInterval(this.pomoInterval);
    this.pomoInterval = null;
    this.pomoIsRunning = false;
    this.pomoIsPaused = false;
    this.pomoCurrentCycle = 0;
    this.pomoPhase = "work";
    this.pomodoroBadge.style.display = "none";
    this.renderPomodoroUI();
    this.showToast("Сессия помодоро завершена");
  }

  updatePomoTimerDisplay() {
    this.pomoTimerDigits.textContent = formatClock(this.pomoSecondsLeft);
    const total = this.pomoTotalSeconds || 1;
    const progress = Math.min(1, Math.max(0, 1 - (this.pomoSecondsLeft / total)));
    this.pomoProgressCircle.style.strokeDashoffset = TIMER_CIRCUMFERENCE * progress;
  }

  updatePomoDots() {
    const dots = this.pomoDots.querySelectorAll(".pomo-dot");
    dots.forEach((dot, i) => {
      dot.classList.remove("filled", "active");
      if (i < this.pomoCurrentCycle) dot.classList.add("filled");
      if (i === this.pomoCurrentCycle && this.pomoPhase === "work") dot.classList.add("active");
    });
  }

  renderPomodoroUI() {
    this.pomoWorkValueEl.textContent = this.pomoWorkMinutes;
    this.pomoBreakValueEl.textContent = this.pomoBreakMinutes;
    this.pomoLongValueEl.textContent = this.pomoLongBreakMinutes;
    if (this.pomoCycleInfo) {
      this.pomoCycleInfo.textContent = `${this.pomoCyclesBeforeLong} помидора → длинный перерыв ${this.pomoLongBreakMinutes} мин`;
    }

    if (this.pomoIsRunning) {
      this.pomodoroSetup.style.display = "none";
      this.pomodoroRunning.style.display = "block";

      const isWork = this.pomoPhase === "work";
      const isLong = this.pomoPhase === "longbreak";
      this.pomoPhaseLabel.textContent = isWork ? "🎯 Фокус" : (isLong ? "🌿 Длинный перерыв" : "☕ Перерыв");
      this.pomoPhaseLabel.className = "pomo-phase-label " + (isWork ? "work" : "break");
      this.pomoProgressCircle.classList.toggle("break-phase", !isWork);

      this.pomodoroBadge.style.display = "flex";
      this.pomodoroBadge.textContent = this.pomoCurrentCycle;

      this.pomoPauseBtn.textContent = this.pomoIsPaused ? "Продолжить" : "Пауза";
      this.updatePomoTimerDisplay();
      this.updatePomoDots();
    } else {
      this.pomodoroSetup.style.display = "block";
      this.pomodoroRunning.style.display = "none";
    }
  }

  // ==========================================================================
  // PWA helpers
  // ==========================================================================

  isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  }

  setupIOSBanner() {
    const banner = document.getElementById("iosInstallBanner");
    const closeBtn = document.getElementById("iosBannerCloseBtn");
    if (!banner || !closeBtn) return;

    if (this.isIOSDevice() && !this.isStandalone() && !store.get(STORAGE.iosBanner)) {
      setTimeout(() => { banner.style.display = "block"; }, 1500);
    }

    closeBtn.addEventListener("click", () => {
      banner.style.display = "none";
      store.set(STORAGE.iosBanner, "true");
    });
  }

  registerServiceWorker() {
    // Service worker работает только по http(s), не через file://
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register("./sw.js")
      .then(reg => reg.update && reg.update())
      .catch(err => console.warn("SW registration failed:", err));
  }
}

// Start app on DOMContentLoaded
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    window.nowApp = new NowApp();
  });
}

// Для проверки разбора дат в Node: node test_dates.js
if (typeof module !== "undefined") {
  module.exports = { parseQuickInput, parseLocalISO, toLocalISO, nextRepeat, dueState, formatDue, defaultTimeFor };
}
