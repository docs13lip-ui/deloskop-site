"""lenta-chisto-v1 (18.10.2026): sobrat_lentu убирает хвост старой сборки из #list на /obnovleniya/.
Запуск из корня: python3 tests/test_lenta_chisto.py

Ошибка, которую ловим: с 12.10 после блока <!--lenta-->…<!--/lenta--></div> стояли записи -71 и -47 и вторая
<!--/lenta--></div>. Сборщик заменял блок до ПЕРВОЙ закрывающей метки — хвост жил вечно, --check был зелёным,
а посетитель видел две записи дважды (одинаковые id, якоря /obnovleniya/#… вели на первую).
"""
import pathlib
import sys

R = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(R / "tests"))
import sobrat_lentu as S  # noqa: E402

n = 0


def ok(name, cond, extra=""):
    global n
    if not cond:
        print("✗", name, extra)
        sys.exit(1)
    n += 1
    print("✓", name)


shapka = '<main id="main">\n<h1>Обновления</h1>\n'
konec = "</main>\n<script>var x='<!--/lenta-->';</script>\n"
hvost = ('<div id="list"><!--lenta--><section class="u" id="a">A</section><!--/lenta--></div>\n'
         '<section class="u" id="old-1">старое</section>\n<section class="u" id="old-2">старое</section><!--/lenta--></div>\n')
nov = S.sobrat(shapka + hvost + konec)
ok("хвост старой сборки убран", "old-1" not in nov and "old-2" not in nov)
ok("одна пара меток в <main>", nov[:nov.index("</main>")].count("<!--lenta-->") == 1
   and nov[:nov.index("</main>")].count("<!--/lenta-->") == 1)
ok("скрипт после </main> не тронут", nov.endswith(konec))
ok("после метки — только </div> #list", nov[nov.index("<!--/lenta-->"):nov.index("</main>")].split() == ["<!--/lenta--></div>"])
ok("повторная сборка ничего не меняет", S.sobrat(nov) == nov)

ruchnoe = shapka + '<div id="list"><!--lenta--><!--/lenta--></div>\n<p>Абзац руками</p>\n' + konec
try:
    S.sobrat(ruchnoe)
    ok("абзац руками в #list → остановка, а не тихое удаление", False)
except SystemExit:
    ok("абзац руками в #list → остановка, а не тихое удаление", True)

ok("типографика: заголовок с предлогом", "на&nbsp;телефоне" in S.t("Ровнее на телефоне"))
ok("экранирование до типографики", S.t('<b> и "x"') == "&lt;b&gt; и&nbsp;&quot;x&quot;")

h = (R / "obnovleniya" / "index.html").read_text(encoding="utf-8")
ok("на сайте: --check зелёный", S.main(["--check"]) == 0)
ok("на сайте: хвоста нет", h[:h.index("</main>")].count("<!--/lenta-->") == 1)
print("Итого: %d ✓" % n)
