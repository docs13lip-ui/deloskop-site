/* Делоскоп — подключённые источники в ответе проверки (комплект istochniki-v1, решение владельца 11.10 16:25:
 * «не урезать, а подключить суды, банкротство, приставов» — claude/Решения_владельца_11.10_не_урезать_подключить_суды_банкротство_приставы.md).
 *
 * dopolnit(r) — общая точка: вызывается из DlkImya.ispravitOtvet (главная, Паспорт, Проверь счёт, PDF-досье, Делопись, кабинет)
 * до всех модулей отчёта. Меняет ответ на месте и возвращает его же.
 *
 * 1) Банкротство — из ЕГРЮЛ. Статус компании в ЕГРЮЛ (company.status от DaData: BANKRUPT — введена процедура банкротства)
 *    уже есть в каждом ответе. Если API не прислал блок damia.bankrotstvo с ответом (found / not_found / not_applicable),
 *    ставим его сами: источник «ЕГРЮЛ ФНС», дата сведений — дата проверки, оговорка «сообщения ЕФРСБ не проверяли»
 *    (намерения кредиторов и ход процедуры в ЕГРЮЛ не попадают). Ответ API с проверкой ЕФРСБ никогда не перетираем.
 *    У ИП — не ставим: банкротство гражданина в ЕГРИП не отражается до прекращения статуса ИП.
 *    В полноту Индекса такой блок НЕ идёт (источник методики «Федресурс и ЕФРСБ» не проверен) — флаг iz_egryul;
 *    стоп-фактор «Введена процедура банкротства» Индекс и так берёт из статуса ЕГРЮЛ (js/indeks-otvet.js).
 * 2) Приставы — блок damia.fssp приходит от API (загрузчик открытых данных ФССП, комплект API istochniki-v1):
 *    status found / not_found, summa_ostatka, chislo, tochnost ('inn' | 'naimenovanie_adres'), data_svedeniy.
 *    Здесь только приводим словарь: sostoyanie = status, чтобы «Условия сделки» и Индекс читали одно и то же.
 * Чистые функции, без DOM и сети — tests/istochniki_bankrotstvo_fssp.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkIstochniki = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = ' ';
  var OTVETIL = { found: 1, not_found: 1, not_applicable: 1 };
  var EFRSB = 'https://fedresurs.ru/';
  var OGOVORKA_EFRSB = 'сообщения ЕФРСБ не проверяли';

  // дата проверки по Москве → «2026-10-11» (как «Существенные факты»: ЕГРЮЛ — на дату проверки)
  function dataProverki(r) {
    var x = Date.parse((r && r.checked_at) || '');
    if (!isFinite(x)) return null;
    var q = new Date(x + 3 * 3600 * 1000);
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return q.getUTCFullYear() + '-' + z(q.getUTCMonth() + 1) + '-' + z(q.getUTCDate());
  }

  function statusSignal(r) {
    var S = Array.isArray(r && r.signals) ? r.signals : [];
    for (var i = 0; i < S.length; i++) {
      var s = S[i];
      if (s && String(s.title || '').replace(/ /g, ' ').trim() === 'Статус') return s;
    }
    return null;
  }

  // r → блок «Банкротство» по ЕГРЮЛ | null (нечего сказать честно)
  function bankrotstvoIzEgryul(r) {
    var c = r && r.company;
    if (!c || typeof c !== 'object' || !c.inn) return null;
    if (c.kind === 'INDIVIDUAL' || String(c.inn).length === 12) return null;
    var st = String(c.status || '').toUpperCase(), sg = statusSignal(r);
    var det = sg ? String(sg.detail || '').replace(/ /g, ' ') : '';
    if (!st && !sg) return null;
    var data = dataProverki(r);
    var b = { nazvanie: 'Банкротство', istochnik: 'ЕГРЮЛ ФНС', data_svedeniy: data, iz_egryul: true,
      ogovorka: OGOVORKA_EFRSB, proverit_samim: EFRSB };
    if (st === 'BANKRUPT' || /банкрот/i.test(det)) {
      b.status = 'found'; b.uroven = 'bad';
      b.itog = 'Процедура банкротства — отметка в' + NB + 'ЕГРЮЛ';
      b.dubl_statusa = true; // строка «Статус» уже говорит об этом — в «Существенных фактах» не повторяем
    } else if (st === 'LIQUIDATED') {
      b.status = 'not_applicable';
      b.prichina = 'Компания прекратила деятельность — см.' + NB + '«Статус»';
    } else if (st === 'ACTIVE' || st === 'LIQUIDATING' || st === 'REORGANIZING') {
      b.status = 'not_found';
      b.itog = 'Отметки о банкротстве в' + NB + 'ЕГРЮЛ нет; ' + OGOVORKA_EFRSB;
    } else return null;
    b.sostoyanie = b.status;
    return b;
  }

  function dopolnit(r) {
    if (!r || typeof r !== 'object' || !r.company) return r;
    var dm = r.damia && typeof r.damia === 'object' ? r.damia : null;
    var est = dm && dm.bankrotstvo && typeof dm.bankrotstvo === 'object' ? dm.bankrotstvo : null;
    if (!est || !OTVETIL[est.status]) {
      var b = bankrotstvoIzEgryul(r);
      if (b) {
        if (!dm) { dm = {}; r.damia = dm; }
        if (est && est.proverit_samim) b.proverit_samim = est.proverit_samim;
        dm.bankrotstvo = b;
        if (dm.polnota && typeof dm.polnota === 'object' && isFinite(dm.polnota.provereno) && !(est && OTVETIL[est.status])) {
          dm.polnota = { provereno: Number(dm.polnota.provereno) + 1, iz: dm.polnota.iz };
        }
      }
    }
    // приставы: один словарь для вывода и Индекса
    var f = dm && dm.fssp;
    if (f && typeof f === 'object' && OTVETIL[f.status] && f.sostoyanie !== f.status) f.sostoyanie = f.status;
    return r;
  }

  // Для Индекса: реестр учтён в полноте — ответ API с проверкой самого реестра (не подстановка из ЕГРЮЛ)
  function uchten(b) {
    if (!b || typeof b !== 'object' || b.iz_egryul) return false;
    return b.status === 'provereno' || b.status === 'found' || b.status === 'not_found';
  }

  return { dopolnit: dopolnit, bankrotstvoIzEgryul: bankrotstvoIzEgryul, uchten: uchten, OGOVORKA_EFRSB: OGOVORKA_EFRSB };
});
