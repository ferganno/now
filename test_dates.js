// Проверка разбора сроков: node test_dates.js
const assert = require("assert");
const { parseQuickInput: p, parseLocalISO, nextRepeat, dueState, formatDue } = require("./app.js");

const now = new Date(2026, 8, 29, 18, 1); // вт, 29 сентября 2026, 18:01

assert.deepStrictEqual(p("Позвонить маме завтра в 15:00", now), { title: "Позвонить маме", due: "2026-09-30T15:00", priority: 0, listName: null });
assert.strictEqual(p("Сдать отчёт в 23:59 !1 #Работа", now).due, "2026-09-29T23:59");
assert.strictEqual(p("Сдать отчёт в 23:59 !1 #Работа", now).priority, 3);
assert.strictEqual(p("Сдать отчёт в 23:59 !1 #Работа", now).listName, "Работа");
assert.strictEqual(p("Сдать отчёт в 23:59 !1 #Работа", now).title, "Сдать отчёт");
assert.strictEqual(p("встреча 00:00", now).due, "2026-09-30T00:00");       // время уже прошло сегодня → завтра
assert.strictEqual(p("зарядка в 9", now).due, "2026-09-30T09:00");
assert.strictEqual(p("врач 5.10 в 10:30", now).due, "2026-10-05T10:30");
assert.strictEqual(p("подарок 8 марта", now).due, "2027-03-08T09:00");     // прошедшая дата → следующий год
assert.strictEqual(p("сходить в пятницу", now).due, "2026-10-02T09:00");
assert.strictEqual(p("купить хлеб сегодня", now).due, "2026-09-29T19:00"); // сегодня без времени → ближайший час
assert.strictEqual(p("купить хлеб", now).due, null);
assert.strictEqual(p("в 24:00", now).due, null);                            // 24:00 не существует
assert.strictEqual(p("дедлайн 31.02", now).due, null);                      // 31 февраля не существует

assert.strictEqual(parseLocalISO("2026-09-29T23:59").getHours(), 23);
assert.strictEqual(parseLocalISO("2026-09-29T24:00"), null);

assert.strictEqual(nextRepeat("2026-09-29T09:00", "daily", now), "2026-09-30T09:00");
assert.strictEqual(nextRepeat("2026-01-31T09:00", "monthly", new Date(2026, 0, 31, 10)), "2026-02-28T09:00");
assert.strictEqual(nextRepeat("2026-10-02T09:00", "weekdays", new Date(2026, 9, 2, 10)), "2026-10-05T09:00");

assert.strictEqual(dueState("2026-09-29T18:30", now), "soon");
assert.strictEqual(dueState("2026-09-29T18:00", now), "overdue");
assert.strictEqual(dueState("2026-09-29T21:00", now), "today");
assert.strictEqual(formatDue("2026-09-30T15:00", now), "Завтра, 15:00");

console.log("OK: все проверки сроков прошли");
