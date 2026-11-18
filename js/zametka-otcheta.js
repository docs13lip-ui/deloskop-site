/* Делоскоп — заметка к компании прямо в отчёте по ИНН (план 18.11, разд. 5 п. 18; продолжение kontragenty-shapka-v1).
 * Та же заметка, что в «Ваших контрагентах» на главной: ключ dlk_zametki, правила js/portfel.js (до 200 знаков,
 * не больше 300 заметок, пустая — удалить). Только в этом браузере: в сеть и в Метрику текст не уходит (цель — длина).
 * В шапке листа под названием: есть заметка — строкой с латунной чертой и «Изменить»; нет — тихая кнопка «Заметка к компании».
 * Правка на месте: Ctrl/⌘+Enter — сохранить, Esc — отмена; после сохранения список «Ваши контрагенты» перерисовывается.
 * Нужен Portfel (пакет «glavnaya»): без него блока нет. Чистая функция html — без DOM, её проверяет tests/zametka_otcheta.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkZametkaOtcheta = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = '\u00a0', MAX = 200;
  var INN_RE = /^\d{10}(\d{2})?$/;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // z — текст заметки ('' — нет), red — открыт редактор
  function html(inn, z, red) {
    z = String(z || '');
    if (red) {
      var id = 'zo-t-' + inn;
      return '<form class="zo zo--red" data-zo-f><label class="zo__h" for="' + id + '">Заметка к' + NB + 'компании — видна только в' + NB + 'этом браузере. Не' + NB + 'пишите сюда паспортные данные и' + NB + 'пароли.</label>' +
        '<textarea class="pf__zt ym-disable-keys" id="' + id + '" rows="2" maxlength="' + MAX + '" placeholder="Например: договор поставки до' + NB + '31.12, менеджер просил предоплату">' + esc(z) + '</textarea>' +
        '<div class="pf__zk"><button type="submit" class="pf__zs">Сохранить</button><button type="button" class="pf__zo" data-zo-otm>Отмена</button>' +
        (z ? '<button type="button" class="pf__zu" data-zo-del>Удалить заметку</button>' : '') + '</div></form>';
    }
    if (z) {
      return '<div class="zo"><p class="zo__h">Ваша заметка</p><p class="zo__z ym-hide-content">' + esc(z) + '</p>' +
        '<p class="zo__n">Видна только в' + NB + 'этом браузере · <button type="button" class="zo__b" data-zo-red>Изменить</button></p></div>';
    }
    return '<div class="zo zo--pusto"><button type="button" class="zo__b zo__b--plus" data-zo-red aria-label="Добавить заметку к' + NB + 'компании">+ Заметка к' + NB + 'компании</button></div>';
  }

  var CSS =
    '.zo{margin:10px 0 0;max-width:560px}' +
    '.zo__h{margin:0 0 4px;font-size:13px;line-height:1.4;font-weight:600;color:var(--muted,#5B6783)}' +
    '.zo__z{margin:0;padding:0 0 0 10px;border-left:2px solid var(--mat-zhdu-t,#D9B45A);font-size:15px;line-height:1.45;color:var(--ink-2,#3A4868);white-space:pre-line;overflow-wrap:anywhere}' +
    '.zo__n{margin:4px 0 0 12px;font-size:12px;line-height:1.4;color:var(--muted,#5B6783)}' +
    '.zo__b{padding:0;border:0;background:none;font:inherit;color:var(--ink,#0B1B3A);text-decoration:underline;text-decoration-color:var(--line,#E3DDCD);text-underline-offset:.2em;cursor:pointer}' +
    '.zo__b:hover{text-decoration-color:currentColor}' +
    '.zo__b--plus{min-height:44px;font-size:13px;color:var(--muted,#5B6783)}' +
    '.zo__b:focus-visible{outline:2px solid var(--mat-fokus,#A07A28);outline-offset:2px;border-radius:4px}' +
    '[data-theme=dark] .zo__b:focus-visible{outline-color:var(--mat-fokus-t,#D9B45A)}' +
    '.zo--pusto{margin:-4px 0 -6px}' +
    '@media print{.zo--pusto,.zo--red,.zo__n{display:none}}';

  function stil(doc) {
    if (!doc || doc.getElementById('zo-css')) return;
    var s = doc.createElement('style'); s.id = 'zo-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }
  function ls() { try { return self.localStorage; } catch (e) { return null; } }
  function cel(t, p) { try { if (self.dlkGoal) self.dlkGoal(t, p); } catch (e) {} }

  // mount(report, r) — в .ot-who под названием (перед «Главным»), только если ИНН верный и Portfel на странице.
  function mount(report, r) {
    if (!report) return null;
    var P = typeof self !== 'undefined' && self.Portfel, L = ls();
    var inn = String((r && r.company && r.company.inn) || '');
    var star = report.querySelector('.zo');
    if (star && star.parentNode) star.parentNode.removeChild(star);
    var who = report.querySelector('.ot-hd .ot-who');
    if (!P || !P.zametkiChitat || !P.zametkaZapisat || !L || !INN_RE.test(inn) || !who) return null;
    var doc = report.ownerDocument, box = doc.createElement('div');
    box.className = 'zo-m';
    try { stil(doc); } catch (e) {}
    var gl = who.querySelector('.gl1'), lip = who.querySelector('.lip-o'), pered = gl || lip;
    if (pered && pered.parentNode === who) who.insertBefore(box, pered); else who.appendChild(box);

    function tekst() { var o = P.zametkiChitat(L)[inn]; return o && o.z ? String(o.z) : ''; }
    function ris(red, fokus) {
      box.innerHTML = html(inn, tekst(), red);
      if (red) {
        var ta = box.querySelector('textarea');
        if (ta) { ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {} }
      } else if (fokus) {
        var b = box.querySelector('[data-zo-red]'); if (b) b.focus();
      }
    }
    function zapisat(t) {
      var z = P.zametkaZapisat(L, inn, t);
      try { if (P.obnovit) P.obnovit(); } catch (e) {}
      cel('otchet_zametka', z ? { dlina: z.length } : { udalil: 1 });
      ris(false, true);
    }
    box.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!t || !box.contains(t)) return;
      if (t.hasAttribute('data-zo-red')) ris(true);
      else if (t.hasAttribute('data-zo-otm')) ris(false, true);
      else if (t.hasAttribute('data-zo-del')) zapisat('');
    });
    box.addEventListener('submit', function (e) {
      e.preventDefault();
      var ta = box.querySelector('textarea'); zapisat(ta ? ta.value : '');
    });
    box.addEventListener('keydown', function (e) {
      if (!e.target || e.target.tagName !== 'TEXTAREA') return;
      if (e.key === 'Escape') { e.preventDefault(); ris(false, true); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); zapisat(e.target.value); }
    });
    ris(false);
    return box;
  }

  return { html: html, mount: mount, stil: stil, CSS: CSS };
});
