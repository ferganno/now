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
    action: "Нажми «+ Выгрузи мысль» внизу и напиши: «Убраться в комнате, позвонить маме»",
    reason: "Пиши дела через запятую или с новой строки — NOW разложит их на маленькие шаги по 2–5 минут. Потом отметь этот шаг «Готово!».",
    durationMinutes: 2,
    lazyVersion: "Просто открой «+ Выгрузи мысль» внизу (5 сек)"
  }
];

const STORAGE = {
  tasks: "now_app_tasks",
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

// --- Smart Atomizer (Built-in Heuristic / Offline Engine) ---
// {text} в action подставляется исходной формулировкой пользователя.
// Порядок важен: срабатывает первое совпавшее правило.
const ATOMIZER_RULES = [
  {
    keywords: ["позвон", "созвон", "перезвон"],
    parent: "Звонок",
    steps: [
      { action: "{text}", duration: 3, reason: "Один короткий звонок снимает груз на весь день.", lazy: "Просто открой контакт в телефоне (10 сек)" }
    ]
  },
  {
    keywords: ["презентац", "слайд", "доклад", "отч[её]т", "проект", "курсов", "диплом"],
    steps: [
      { action: "Открыть файл и записать главную мысль", duration: 4, reason: "Снимает ступор белого листа.", lazy: "Просто открой файл и напиши заголовок (45 сек)" },
      { action: "Набросать 3 ключевых тезиса", duration: 8, reason: "Каркас готов за 8 минут.", lazy: "Напиши один тезис в заметки (1 мин)" },
      { action: "Оформить финальный слайд или выводы", duration: 6, reason: "Логическое завершение.", lazy: "Перечитай первый абзац (1 мин)" }
    ]
  },
  {
    keywords: ["урок", "математ", "стих(?!и)", "школ", "дз(?![а-яё])", "домашк", "домашн[а-яё]* задан"],
    steps: [
      { action: "Открыть тетрадь и учебник на нужной странице", duration: 2, reason: "Подготовить рабочее место без напряжения.", lazy: "Просто положи тетрадь и ручку на стол (20 сек)" },
      { action: "Прочитать условие первого задания дважды", duration: 3, reason: "Понять, о чём речь.", lazy: "Прочитай первое предложение вслух (30 сек)" },
      { action: "Записать первый шаг решения", duration: 7, reason: "Главное — положить начало.", lazy: "Запиши номер задания в тетрадь (20 сек)" }
    ]
  },
  {
    keywords: ["документ", "виз[аеуы](?![а-яё])", "визой", "паспорт", "налог", "оплат", "заплат", "жкх", "сч[её]т", "квитанц", "справк", "заявлен"],
    steps: [
      { action: "Найти нужные документы или открыть сайт", duration: 3, reason: "Первый шаг — просто положить перед собой.", lazy: "Открой сайт или приложение (45 сек)" },
      { action: "Сверить сумму или недостающие пункты", duration: 4, reason: "Понять объём за 4 минуты.", lazy: "Посмотри одну итоговую цифру (30 сек)" },
      { action: "Нажать «Оплатить» или «Отправить»", duration: 2, reason: "Финальное действие.", lazy: "Открой страницу оплаты или отправки (30 сек)" }
    ]
  },
  {
    keywords: ["убор", "убра", "убер", "прибра", "прибер", "порядок", "комнат"],
    steps: [
      { action: "Собрать с пола или стола 5 лишних вещей", duration: 3, reason: "Быстрый визуальный порядок за 3 минуты.", lazy: "Подними ровно одну вещь с пола (20 сек)" },
      { action: "Заправить постель", duration: 2, reason: "Комната сразу выглядит опрятно.", lazy: "Просто расправь подушку (30 сек)" },
      { action: "Унести посуду на кухню", duration: 3, reason: "Чистое рабочее место.", lazy: "Отнеси одну чашку в раковину (30 сек)" }
    ]
  },
  {
    keywords: ["написат", "напиши", "спросит", "ответит", "сообщ", "отправит"],
    parent: "Сообщение",
    steps: [
      { action: "{text}", duration: 3, reason: "Не откладывай — это займёт всего 3 минуты.", lazy: "Открой чат и напиши первое слово (20 сек)" }
    ]
  }
].map(rule => ({ ...rule, regex: wordRegex(rule.keywords) }));

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

const TIMER_TICK_MS = 250;
const TIMER_CIRCUMFERENCE = 553; // 2 * PI * 88

function localDateKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

let idCounter = 0;
function makeId() {
  idCounter++;
  return `task-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
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

    this.initElements();
    this.loadState();
    this.attachEvents();
    this.render();
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
  }

  // --- State Persistence ---
  freshSeed() {
    return INITIAL_TASKS.map(t => ({ ...t }));
  }

  isValidTask(t) {
    return t && typeof t === "object" && typeof t.id === "string" && typeof t.action === "string" && t.action.trim() !== "";
  }

  loadState() {
    const saved = store.get(STORAGE.tasks);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) throw new Error("tasks is not an array");
        this.tasks = parsed.filter(t => this.isValidTask(t)).map(t => ({
          ...t,
          durationMinutes: Number(t.durationMinutes) > 0 ? Number(t.durationMinutes) : 5
        }));
        // Авто-очистка старых демо-задач из ранней версии
        if (this.tasks.some(t => t.parentGoal === "Презентация" && t.id.indexOf("task-") !== 0)) {
          this.tasks = this.freshSeed();
        }
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
    if (!this.activeTimeFilter) return this.tasks;
    return this.tasks.filter(t => t.durationMinutes <= this.activeTimeFilter);
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
    const current = this.getCurrentTask();

    // Счётчики и списки обновляются всегда, даже на пустом экране
    this.tasksCountBadge.textContent = this.tasks.length;
    this.tasksCountBadge.style.display = this.tasks.length ? "flex" : "none";
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

      const filteredOut = this.tasks.length > 0 && this.activeTimeFilter;
      if (filteredOut) {
        this.allDoneTitle.textContent = `Нет дел до ${this.activeTimeFilter} минут`;
        this.allDoneDesc.textContent = `В списке ещё ${this.tasks.length} — но все они длиннее выбранного окна.`;
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

    this.cardParentTask.textContent = current.parentGoal || "Фокус";

    if (this.isLazyModeActive) {
      this.cardActionTitle.textContent = current.lazyVersion || "Удели этому ровно 1 минуту — просто начни";
      this.cardReason.textContent = `Потом: ${current.action}`;
      this.cardDuration.textContent = "~1 мин";
      this.lazyBanner.style.display = "block";
      this.lazyBtn.style.display = "none";
    } else {
      this.cardActionTitle.textContent = current.action;
      this.cardReason.textContent = current.reason || "Сделай сейчас, чтобы освободить мысли.";
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

  renderDrawer() {
    this.drawerTaskCounter.textContent = `Осталось действий: ${this.tasks.length}`;
    this.drawerTasksList.innerHTML = "";

    if (this.tasks.length === 0) {
      this.drawerTasksList.innerHTML = `
        <div class="drawer-empty">
          Список пуст.<br>Нажми «Записать задачу» ниже.
        </div>
      `;
      return;
    }

    const currentId = this.currentVisibleId();

    this.tasks.forEach((item) => {
      const el = document.createElement("div");
      el.className = `drawer-task-item ${item.id === currentId ? "active-item" : ""}`;
      el.innerHTML = `
        <div class="drawer-task-info">
          <span class="drawer-task-title">${this.escapeHtml(item.action)}</span>
          <span class="drawer-task-meta">${item.parentGoal ? this.escapeHtml(item.parentGoal) + " • " : ""}~${Number(item.durationMinutes) || 0} мин</span>
        </div>
        <button class="delete-task-btn" type="button" title="Удалить" aria-label="Удалить задачу">✕</button>
      `;

      el.addEventListener("click", (e) => {
        if (e.target.closest(".delete-task-btn")) {
          e.stopPropagation();
          this.removeTask(item.id);
          return;
        }
        this.jumpToTask(item.id);
        this.closeDrawer();
      });

      this.drawerTasksList.appendChild(el);
    });
  }

  renderSidebar() {
    if (!this.sidebarTasksList) return;

    if (this.statDoneToday) {
      this.statDoneToday.textContent = this.doneToday;
    }

    this.sidebarTasksList.innerHTML = "";

    if (this.tasks.length === 0) {
      this.sidebarTasksList.innerHTML = `<div class="sidebar-empty-text">Всё сделано!<br>Нажми «+» чтобы добавить.</div>`;
      return;
    }

    const currentId = this.currentVisibleId();

    this.tasks.forEach((item) => {
      const el = document.createElement("div");
      el.className = `sidebar-task-item ${item.id === currentId ? "current" : ""}`;
      el.innerHTML = `
        <span class="sidebar-task-dot"></span>
        <span class="sidebar-task-text">${this.escapeHtml(item.action)}</span>
        <span class="sidebar-task-time">~${Number(item.durationMinutes) || 0}м</span>
      `;
      el.addEventListener("click", () => this.jumpToTask(item.id));
      this.sidebarTasksList.appendChild(el);
    });
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

    this.playHapticTone("chime");
    this.triggerConfetti();
    this.showToast(`🎉 Готово: «${current.action}»`);

    const oldIndex = Math.max(0, this.getActiveTasks().findIndex(t => t.id === current.id));
    this.stopTimer();
    this.tasks = this.tasks.filter(t => t.id !== current.id);
    this.saveState();
    this.selectNextAfterRemoval(oldIndex);

    this.refreshDoneDay();
    this.doneToday++;
    this.saveDoneToday();

    this.isLazyModeActive = false;
    this.animateCardSwitch();
  }

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
    clearTimeout(this.flipOutTimeout);
    clearTimeout(this.flipInTimeout);
    this.taskCard.classList.remove("flip-in");
    this.taskCard.classList.add("flip-out");
    this.flipOutTimeout = setTimeout(() => {
      this.render();
      this.taskCard.classList.remove("flip-out");
      this.taskCard.classList.add("flip-in");
      this.flipInTimeout = setTimeout(() => {
        this.taskCard.classList.remove("flip-in");
      }, 450);
    }, 200);
  }

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
    this.closeDumpSheet(true);
    this.playHapticTone("chime");

    const word = this.pluralSteps(newItems.length);
    if (this.isTimerRunning) {
      // Не сбиваем текущий таймер — новые шаги ждут своей очереди
      this.showToast(`✨ Добавлено ${newItems.length} ${word} — после текущего`);
      this.render();
      return;
    }

    this.currentId = newItems[0].id;
    this.isLazyModeActive = false;
    if (this.activeTimeFilter && newItems[0].durationMinutes > this.activeTimeFilter) {
      this.activeTimeFilter = null;
    }
    this.showToast(`✨ Разложено на ${newItems.length} ${word}`);
    this.animateCardSwitch();
  }

  pluralSteps(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "шаг";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "шага";
    return "шагов";
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
    const allItems = [];

    for (const thought of thoughts) {
      const cleaned = this.cleanText(thought);
      if (cleaned.length < 2) continue;
      const lower = cleaned.toLowerCase();

      const rule = ATOMIZER_RULES.find(r => r.regex.test(lower));
      if (rule) {
        const multi = rule.steps.length > 1;
        rule.steps.forEach((st) => {
          allItems.push({
            id: makeId(),
            // У многошаговых дел бейджем служит сама формулировка пользователя
            parentGoal: multi ? this.truncate(cleaned, 40) : (rule.parent || this.guessParentGoal(cleaned)),
            action: st.action.replace("{text}", cleaned),
            reason: st.reason,
            durationMinutes: st.duration,
            lazyVersion: st.lazy
          });
        });
        continue;
      }

      allItems.push({
        id: makeId(),
        parentGoal: this.guessParentGoal(cleaned),
        action: cleaned,
        reason: "Выгружено из головы — сделай сейчас.",
        durationMinutes: this.guessDuration(cleaned),
        lazyVersion: "Удели этому ровно 1 минуту — просто начни"
      });
    }

    return allItems;
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
  closeAllOverlays() {
    this.closeDumpSheet();
    this.closeTimeSheet();
    this.closeDrawer();
    this.closePomodoroSheet();
  }

  isAnyOverlayOpen() {
    return document.querySelector(".sheet-backdrop.active, .drawer-backdrop.active") !== null;
  }

  openDumpSheet() {
    this.playHapticTone("tap");
    this.closeAllOverlays();
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

  openDrawer() {
    this.playHapticTone("tap");
    this.closeAllOverlays();
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

    // Preset chips: добавляют пример к уже написанному, а не затирают его
    document.querySelectorAll(".preset-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const sample = chip.getAttribute("data-sample");
        const prev = this.dumpTextarea.value.trim();
        this.dumpTextarea.value = prev ? `${prev}\n${sample}` : sample;
        this.dumpTextarea.focus();
      });
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
    this.drawerAddBtn.addEventListener("click", () => this.openDumpSheet());
    this.listDrawerBackdrop.addEventListener("click", (e) => {
      if (e.target === this.listDrawerBackdrop) this.closeDrawer();
    });
    this.forceNotifBtn.addEventListener("click", () => this.onManualNotifRequest());

    // Notification permission sheet
    this.notifAllowBtn.addEventListener("click", () => this.requestNotifPermission());
    this.notifLaterBtn.addEventListener("click", () => {
      store.set(STORAGE.notifAsked, "later");
      this.closeNotifSheet();
    });

    // Keyboard: Escape закрывает окна, пробел — старт/пауза
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
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

  async sendNotification(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const options = {
      body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      vibrate: [200, 100, 200],
      tag: "now-timer-alert",
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
      new Notification(title, { body, icon: "icon-192.png" });
    } catch (e) {
      console.warn("Notification send error:", e);
    }
  }

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
document.addEventListener("DOMContentLoaded", () => {
  window.nowApp = new NowApp();
});
