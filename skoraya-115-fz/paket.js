/* «Скорая под ключ» — нижняя полоса «цена + Получить пакет» на экранах ≤ 1024 px (ТЗ Арт-директора, §2.4).
   Видна, когда карточка пакета ушла вверх, секция #paket на экране или выше, подвал не виден и окно счёта закрыто. */
(function () {
  "use strict";
  var sek = document.getElementById("paket"); if (!sek) return;
  var card = sek.querySelector("[data-pkg-card]"), bar = sek.querySelector("[data-pkg-bar]");
  var podval = document.querySelector(".podval");
  if (!card || !bar || !("IntersectionObserver" in window)) return;
  var mq = matchMedia("(max-width:1024px)");
  var s = { cardVyshe: false, sekVidna: false, podvalViden: false };
  var viden = false;

  function dialogOtkryt() { return !!document.querySelector("dialog.sf-dlg[open]"); }
  function obnovit() {
    var nado = mq.matches && s.cardVyshe && s.sekVidna && !s.podvalViden && !dialogOtkryt();
    if (nado === viden) return;
    viden = nado; bar.hidden = !nado;
    document.body.style.paddingBottom = nado ? bar.offsetHeight + "px" : "";
  }
  new IntersectionObserver(function (e) {
    var x = e[0]; s.cardVyshe = !x.isIntersecting && x.boundingClientRect.bottom < 0; obnovit();
  }).observe(card);
  new IntersectionObserver(function (e) {
    var x = e[0]; s.sekVidna = x.isIntersecting || x.boundingClientRect.bottom < 0; obnovit();
  }).observe(sek);
  if (podval) new IntersectionObserver(function (e) { s.podvalViden = e[0].isIntersecting; obnovit(); }).observe(podval);
  mq.addEventListener && mq.addEventListener("change", obnovit);
  // окно счёта: пока открыто — полосы нет
  new MutationObserver(obnovit).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"], childList: true });

  // Метрика: карточка пакета на экране (один раз)
  var bylo = false;
  new IntersectionObserver(function (e) {
    if (!bylo && e[0].isIntersecting) { bylo = true; if (window.dlkGoal) window.dlkGoal("pkg_view", { produkt: "skoraya_pod_klyuch" }); }
  }, { threshold: 0.5 }).observe(card);
})();
