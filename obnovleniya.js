/* Делоскоп — лента обновлений.
   После каждого обновления сайта показывает крупное окно «Что нового и что проверить».
   Каждому посетителю — один раз на каждое новое обновление. Данные: /obnovleniya.json */
(function () {
  "use strict";
  var KEY = "deloskop_obnovlenie_videl";
  var qs = new URLSearchParams(location.search);
  var force = qs.has("obnovleniya");

  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var css = "" +
    ".dlo-bg{position:fixed;inset:0;background:rgba(17,17,19,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;animation:dlo-f .25s ease}" +
    ".dlo{font-family:Onest,system-ui,-apple-system,sans-serif;background:#fff;color:#1D1D1F;border-radius:28px;max-width:640px;width:100%;max-height:calc(100vh - 32px);overflow:auto;padding:clamp(24px,5vw,44px);box-shadow:0 24px 80px rgba(0,0,0,.25);animation:dlo-u .3s ease}" +
    ".dlo-tag{display:inline-block;font-size:14px;font-weight:600;color:#0B63E5;background:#EAF1FD;border-radius:999px;padding:6px 14px;margin-bottom:14px}" +
    ".dlo h2{font-size:clamp(28px,5vw,38px);line-height:1.1;font-weight:600;margin:0 0 22px;letter-spacing:-.02em}" +
    ".dlo h3{font-size:15px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6B6B70;margin:24px 0 10px}" +
    ".dlo ul{list-style:none;margin:0;padding:0}" +
    ".dlo li{font-size:clamp(18px,2.6vw,21px);line-height:1.35;padding:9px 0 9px 30px;position:relative;border-bottom:1px solid #E6E6E1}" +
    ".dlo li:last-child{border-bottom:0}" +
    ".dlo .dlo-n li:before{content:'';position:absolute;left:4px;top:18px;width:10px;height:10px;border-radius:50%;background:#0B63E5}" +
    ".dlo .dlo-p li:before{content:'✓';position:absolute;left:2px;top:8px;color:#16723F;font-weight:600}" +
    ".dlo a{color:#0B63E5;text-decoration:none}.dlo a:hover{text-decoration:underline}" +
    ".dlo-note{font-size:16px;color:#48484C;margin:20px 0 0;line-height:1.45}" +
    ".dlo-btns{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}" +
    ".dlo-ok{font:inherit;font-size:18px;font-weight:600;background:#0B63E5;color:#fff;border:0;border-radius:18px;padding:15px 28px;cursor:pointer}.dlo-ok:hover{background:#084BB0}" +
    ".dlo-all{font-size:16px;align-self:center}" +
    ".dlo-pill{position:fixed;right:16px;bottom:16px;z-index:9997;font-family:Onest,system-ui,sans-serif;font-size:14px;font-weight:600;background:#1D1D1F;color:#fff;border:0;border-radius:999px;padding:10px 16px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.2)}" +
    "@keyframes dlo-f{from{opacity:0}}@keyframes dlo-u{from{transform:translateY(16px);opacity:0}}" +
    "@media print{.dlo-bg,.dlo-pill{display:none!important}}";

  function show(u, all) {
    var bg = document.createElement("div");
    bg.className = "dlo-bg";
    bg.setAttribute("role", "dialog");
    bg.setAttribute("aria-modal", "true");
    var h = '<div class="dlo"><span class="dlo-tag">Обновление · ' + esc(u.data) + "</span>" +
      "<h2>" + esc(u.zagolovok) + "</h2>";
    if (u.chto_novogo && u.chto_novogo.length) {
      h += '<h3>Что нового</h3><ul class="dlo-n">' + u.chto_novogo.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
    }
    if (u.chto_proverit && u.chto_proverit.length) {
      h += '<h3>Что проверить</h3><ul class="dlo-p">' + u.chto_proverit.map(function (p) {
        return "<li>" + (p.ssylka ? '<a href="' + esc(p.ssylka) + '">' + esc(p.tekst) + " →</a>" : esc(p.tekst)) + "</li>";
      }).join("") + "</ul>";
    }
    if (u.kuda_pisat) h += '<p class="dlo-note">' + esc(u.kuda_pisat) + "</p>";
    h += '<div class="dlo-btns"><button class="dlo-ok" type="button">Понятно</button>' +
      '<a class="dlo-all" href="/obnovleniya/">Все обновления</a></div></div>';
    bg.innerHTML = h;
    function close() { set(u.id); bg.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    bg.querySelector(".dlo-ok").addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(bg);
    bg.querySelector(".dlo-ok").focus({ preventScroll: true });
  }

  function pill(u) {
    var b = document.createElement("button");
    b.className = "dlo-pill";
    b.type = "button";
    b.textContent = "Что нового";
    b.addEventListener("click", function () { show(u); });
    document.body.appendChild(b);
  }

  function start() {
    if (location.pathname.indexOf("/obnovleniya") === 0) return;
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    fetch("/obnovleniya.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var u = d && d.obnovleniya && d.obnovleniya[0];
        if (!u) return;
        pill(u);
        if (force || get() !== u.id) show(u);
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
