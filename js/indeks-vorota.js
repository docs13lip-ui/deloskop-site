/* Индекс Делоскопа в отчёте — «ворота полноты» (Очередь п. 71, п. 81; аудит 27.09, пп. Г и Д).
 *
 * Число Индекса показываем, только когда сервер прямо говорит «можно»:
 *   r.indeks — целое 1…99, r.polnota — число ≥ 60, компания — не ИП, r.indeks_status не «schitaem».
 * Во всех остальных случаях — строка «Индекс — считаем, собрано N%» той же высоты,
 * а вердикт по фактам (блок риска, светофор) остаётся как есть.
 * Старое поле dossier.score (шкала /100, без полноты) не показываем никогда:
 * это оценка другой формулы, и показывать её как «Индекс» нельзя (ч. 3 ст. 5 38-ФЗ).
 * Когда ворота откроются на сервере, число появится само — правка сайта не нужна.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IndeksVorota = api;
})(this, function () {
  var POROG = 60;
  var ZONY = [
    [70, 'Без серьёзных сигналов', 'ok'],
    [50, 'Есть вопросы', 'warn'],
    [30, 'Есть серьёзные сигналы', 'risk'],
    [1, 'Много признаков риска', 'bad']
  ];

  function chislo(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && /^\s*\d+(?:[.,]\d+)?\s*$/.test(v)) return parseFloat(v.replace(',', '.'));
    return null;
  }

  function zona(ball) {
    for (var i = 0; i < ZONY.length; i++) if (ball >= ZONY[i][0]) return { nazvanie: ZONY[i][1], ton: ZONY[i][2] };
    return { nazvanie: 'Много признаков риска', ton: 'bad' };
  }

  // r — ответ /api/check. Возвращает, что показать на месте Индекса.
  function vid(r) {
    r = r || {};
    var c = r.company || {};
    var ip = c.kind === 'INDIVIDUAL' || String(c.inn || '').length === 12;
    var ind = r.indeks;
    var obj = ind && typeof ind === 'object' ? ind : null;
    var ball = chislo(obj ? (obj.ball != null ? obj.ball : obj.znachenie) : ind);
    var polnota = chislo(obj && obj.polnota != null ? obj.polnota : r.polnota);
    var status = String((obj && obj.status) || r.indeks_status || '');
    if (polnota != null) polnota = Math.max(0, Math.min(100, Math.round(polnota)));

    if (ip) return { rezhim: 'ip', polnota: null };
    var mozhno = ball != null && ball >= 1 && ball <= 99 && Math.round(ball) === ball &&
      polnota != null && polnota >= POROG && status !== 'schitaem';
    if (!mozhno) return { rezhim: 'schitaem', polnota: polnota, porog: POROG };
    var z = zona(ball);
    return { rezhim: 'chislo', ball: ball, polnota: polnota, zona: z.nazvanie, ton: z.ton,
      versiya: obj && obj.model_version || r.model_version || null };
  }

  // Текст строки «считаем» — одной фразой, без обещаний срока.
  function tekstSchitaem(v) {
    if (v.polnota != null)
      return 'Для этой компании собрано ' + v.polnota + '% данных, для балла нужно ' + POROG + '%. Пока смотрите вердикт по\u00a0фактам ниже.';
    return 'Собираем данные из\u00a0источников. Балл покажем, когда их будет не\u00a0меньше ' + POROG + '%. Пока смотрите вердикт по\u00a0фактам ниже.';
  }

  // Три даты (аудит 27.09, А3): обновление продукта, сведения источников, пересчёт оценки.
  // Возвращает массив строк; пустой — если сервер поле daty не прислал.
  function triDaty(r, fmt) {
    var d = (r && r.daty) || null, out = [];
    if (!d || typeof d !== 'object') return out;
    fmt = fmt || function (x) { return x; };
    if (d.produkt) out.push('Версия сервиса: ' + fmt(d.produkt));
    if (d.dannye) {
      if (typeof d.dannye === 'string') out.push('Сведения источников: на ' + fmt(d.dannye));
      else if (typeof d.dannye === 'object') {
        var ch = [];
        for (var k in d.dannye) if (Object.prototype.hasOwnProperty.call(d.dannye, k) && d.dannye[k]) ch.push(k + ' — на ' + fmt(d.dannye[k]));
        if (ch.length) out.push('Сведения источников: ' + ch.join('; '));
      }
    }
    if (d.pereschet) out.push('Оценка пересчитана: ' + fmt(d.pereschet));
    return out;
  }

  return { vid: vid, tekstSchitaem: tekstSchitaem, triDaty: triDaty, zona: zona, POROG: POROG };
});
