"""razbor-gody-v1 ([Ночные-2] 19.11, аудит 19.11): «Разбор по цифрам» карточки /company/ не делит выручку одного года
на штат и налоги другого («Моторинвест»: выручка за 2021 на штат и налоги за 2025 — «119 тыс. ₽ на сотрудника»,
«налоги больше выручки в 103 раза»). Сравниваем только числа одного года; год не виден — строку не трогаем."""
import html
import os
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = Path(__file__).resolve().parent.parent
NB = K.NB


def txt(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).replace(NB, " ").replace(" ", " ").split())


def razbor(t):
    i = t.find('aria-labelledby="razbor"')
    return txt(t[i:t.find("</section>", i)]) if i >= 0 else ""


def fakt(l, v, s):
    return ('<div class="fact"><span>%s</span><span class="fact__v">%s</span><span class="fact__src co-src">%s</span></div>'
            % (l, v, s))


def li(p):
    return ('<li class="co-v co-v--info"><span class="co-v__z" role="img" aria-label="расчёт"></span><div><p>%s</p></div></li>' % p)


def stranica(god_v, god_sh, god_nl, stroki):
    f = (fakt("Выручка за %d" % god_v, "19,6&nbsp;млн&nbsp;₽", "ГИР БО · сведения на 31.12.%d" % god_v)
         + fakt("Сотрудники", "165&nbsp;человек", "ФНС, открытые данные · сведения на 31.12.%d" % god_sh)
         + fakt("Налоги и взносы за год", "2&nbsp;млрд&nbsp;₽ за&nbsp;%d" % god_nl, "ФНС · сведения на 31.12.%d" % god_nl))
    r = ('<section class="co-sec co-razbor" aria-labelledby="razbor"><h2 id="razbor">Разбор по цифрам</h2><ul class="co-vv">%s'
         '</ul><p class="caption">◆ рассчитано Делоскопом</p></section>' % "".join(li(x) for x in stroki))
    return "<main>" + f + r + "<p>дальше</p></main>"


STROKI = ["Чистая рентабельность за&nbsp;2021&#160;— −1030&nbsp;%.",
          "Выручка на&#160;одного сотрудника&#160;— 119&nbsp;тыс.&nbsp;₽ в&#160;год (штат 165&nbsp;человек).",
          "Налоги и&#160;взносы за&#160;год больше выручки в&#160;103&nbsp;раза&#160;— долю к&#160;выручке не&#160;считаем."]


class RazborGody(unittest.TestCase):
    def test_raznye_gody_snyaty(self):
        t = K.razbor_gody(stranica(2021, 2025, 2025, STROKI))
        r = razbor(t)
        self.assertIn("Чистая рентабельность за 2021", r)
        self.assertNotIn("на одного сотрудника", r)
        self.assertNotIn("Налоги и взносы", r)
        self.assertEqual(K.razbor_gody(t), t)  # повтор — те же байты

    def test_odin_god_ostaetsya(self):
        t = stranica(2025, 2025, 2025, STROKI)
        self.assertEqual(K.razbor_gody(t), t)

    def test_pustoj_razdel_snyat(self):
        t = K.razbor_gody(stranica(2022, 2025, 2025, STROKI[1:]))
        self.assertNotIn("co-razbor", t)
        self.assertIn("<p>дальше</p>", t)

    def test_god_ne_viden_ne_trogaem(self):
        t = stranica(2021, 2025, 2025, STROKI).replace("сведения на 31.12.2025", "сведения на —")
        t = t.replace("за&nbsp;2025", "")
        self.assertEqual(K.razbor_gody(t), t)

    def test_opublikovannye(self):
        """На всех карточках: строка «на сотрудника» и «налоги к выручке» — только при одном годе чисел."""
        plohie = []
        for p in sorted((KOREN / "company").glob("*/index.html")):
            t = p.read_text(encoding="utf-8")
            G = K.razbor_gody_fakty(t)
            r = razbor(t)
            if G["v"] and G["sh"] and G["sh"] != G["v"] and "на одного сотрудника" in r:
                plohie.append(p.parent.name + " штат")
            if G["v"] and G["nl"] and G["nl"] != G["v"] and "Налоги и взносы" in r:
                plohie.append(p.parent.name + " налоги")
        self.assertEqual(plohie, [])

    def test_motorinvest(self):
        p = KOREN / "company" / "4810004427-motorinvest" / "index.html"
        if not p.exists():
            self.skipTest("карточки нет")
        r = razbor(p.read_text(encoding="utf-8"))
        self.assertNotIn("119 тыс. ₽", r)
        self.assertNotIn("в 103 раза", r)


if __name__ == "__main__":
    unittest.main()
