/* Делоскоп — «Три входа» на главной (Стратег 27.09 §1.2; приёмка 13.10, стр. 6).
   Считаем, как делятся клики между входами: цели entry_pay / entry_watch / entry_bank
   (только с согласия на Метрику — window.dlkGoal сам это проверяет).
   Вход «Перед оплатой» не уводит со страницы: прокручивает к полю ИНН и ставит в него курсор. */
(function () {
  "use strict";
  function cel(el) {
    var v = el.closest ? el.closest("[data-vhod]") : null;
    return v ? v.getAttribute("data-vhod") : null;
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest(".vhod a") : null;
    if (!a) return;
    var c = cel(a);
    if (c && typeof window.dlkGoal === "function") {
      window.dlkGoal(c, { kuda: a.getAttribute("href") });
    }
    if (a.hasAttribute("data-vhod-inn")) {
      var inp = document.getElementById("inn");
      if (!inp) return;
      e.preventDefault();
      var tiho = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      inp.scrollIntoView({ behavior: tiho ? "auto" : "smooth", block: "center" });
      try { inp.focus({ preventScroll: true }); } catch (x) { inp.focus(); }
      try { history.replaceState(null, "", "#inn"); } catch (x) {}
    }
  });
})();
