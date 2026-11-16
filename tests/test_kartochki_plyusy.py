"""kartochki-plyusy-v1 ([Ночные-2] 16.11): «Плюсы и минусы» на карточке компании (решение владельца 16.11, п. 1).

Строки — из напечатанного раздела реестров и строки под H1 (сведений у опубликованных карточек нет); те же слова, что
в отчёте по ИНН (js/plyusy-minusy.js). Только факты, без оценок; строка ведёт к разделу реестров; чего нет — «Не проверено»."""
import glob
import html
import os
import re
import sys
import unittest
from pathlib import Path

KOREN = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KOREN / "tests"))
import kartochka_render as K  # noqa: E402
import kartochki_obrazec as O  # noqa: E402

NB = K.NB


def _fact(l, v, src):
    return ('<div class="fact"><span>%s</span><span class="fact__v">%s</span><span class="fact__src co-src">%s</span></div>'
            % (l, v, src))


def _stranica(fakty, sub="Действующая · Казань · торговля · с&nbsp;2004&#160;года (22&nbsp;года) · ОГРН&nbsp;1"):
    return ('<main><h1>ООО&nbsp;«Ромашка»</h1><p class="co-sub">%s</p>'
            '<p class="caption co-okved">Основной вид деятельности · ЕГРЮЛ · сведения на&#160;15.11.2026</p>'
            '<section class="co-sec" aria-labelledby="korotko"><h2 id="korotko">Коротко о&#160;компании</h2></section>'
            '<section class="co-sec" aria-labelledby="reestry"><h2 id="reestry">Проверка ООО&nbsp;«Ромашка» по&#160;реестрам</h2>%s</section></main>'
            % (sub, "".join(fakty)))


SRC = "ФНС, открытые данные · сведения на 01.10.2026 · ● подтверждено источником"
CH = "Картотека арбитражных дел&#160;— через Checko · сведения на 13.11.2026 · ● подтверждено источником"


class TestStroki(unittest.TestCase):
    def test_plyusy_i_minusy(self):
        t = _stranica([
            _fact("Задолженность по налогам", "1,2&nbsp;млн&nbsp;₽", SRC),
            _fact("Отметки о недостоверности", "Отметок о недостоверности нет", "ЕГРЮЛ · сведения на 15.11.2026 · ●"),
            _fact("Выручка за 2025", "2,3&nbsp;млрд&nbsp;₽", "ГИР БО · сведения на 31.12.2025 · ●"),
            _fact("Арбитражные дела, где компания&#160;— ответчик", "12&nbsp;незавершённых дел на 6,2&nbsp;млн&nbsp;₽", CH),
            _fact("Исполнительные производства", "3&nbsp;производства, остаток долга&nbsp;— 410&nbsp;тыс.&nbsp;₽", CH),
            _fact("Сообщения о банкротстве компании", "не нашли", CH),
        ])
        S = K.plyusy_minusy_stroki(t)
        P = [x[1].replace(NB, " ") for x in S["plyusy"]]
        M = [x[1].replace(NB, " ") for x in S["minusy"]]
        self.assertEqual(P[0], "Действующая компания")
        self.assertIn("Нет сообщений о банкротстве", P)
        self.assertIn("Нет отметок о недостоверности", P)
        self.assertIn("Отчётность за 2025 год в ГИР БО", P)
        self.assertIn("На рынке с 2004 года", P)
        self.assertEqual(M, ["Ответчик в 12 идущих делах на 6,2 млн ₽", "Производства у приставов: 3, долг 410 тыс. ₽",
                             "Долг по налогам 1,2 млн ₽"])
        self.assertEqual(S["ne"], [])
        # у строки — источник и дата сведений
        nal = [x for x in S["minusy"] if x[0] == "tax_debt"][0]
        self.assertEqual((nal[2], nal[3]), ("ФНС, открытые данные", "01.10.2026"))

    def test_odno_delo_i_net_del(self):
        t = _stranica([_fact("Арбитражные дела, где компания&#160;— ответчик", "1&nbsp;незавершённое дело на 6,2&nbsp;тыс.&nbsp;₽", CH)])
        M = [x[1].replace(NB, " ") for x in K.plyusy_minusy_stroki(t)["minusy"]]
        self.assertEqual(M, ["Ответчик в 1 идущем деле на 6,2 тыс. ₽"])
        t = _stranica([_fact("Арбитражные дела, где компания&#160;— ответчик", "незавершённых дел не нашли", CH),
                       _fact("Задолженность по налогам", "Нет", SRC)])
        S = K.plyusy_minusy_stroki(t)
        self.assertIn("Нет идущих дел против компании", [x[1] for x in S["plyusy"]])
        self.assertIn("Нет долгов по налогам", [x[1] for x in S["plyusy"]])
        self.assertEqual(S["minusy"], [])

    def test_ne_provereno(self):
        # нет строк арбитража, приставов и банкротства — «не проверяли», а не плюс
        S = K.plyusy_minusy_stroki(_stranica([_fact("Задолженность по налогам", "Нет", SRC)]))
        self.assertEqual(S["ne"], ["арбитражные суды", "приставы", "банкротство"])
        b = K.plyusy_minusy_html(S)
        self.assertIn("Не проверено:", b)
        self.assertNotIn("Нет идущих дел", b)

    def test_staraya_otchetnost(self):
        t = _stranica([_fact("Выручка за 2021", "5&nbsp;млрд&nbsp;₽", "ГИР БО · сведения на 31.12.2021 · ●")])
        M = [x[1].replace(NB, " ") for x in K.plyusy_minusy_stroki(t)["minusy"]]
        self.assertIn("Последняя отчётность — за 2021 год", M)

    def test_html_idempotentno_i_mesto(self):
        t = _stranica([_fact("Задолженность по налогам", "Нет", SRC)])
        t1 = K.plyusy_minusy_kartochki(t)
        self.assertEqual(K.plyusy_minusy_kartochki(t1), t1)
        self.assertEqual(t1.count('class="co-sec co-pm"'), 1)
        self.assertLess(t1.index("co-pm"), t1.index('aria-labelledby="korotko"'))
        self.assertIn('href="#reestry" title="ФНС, открытые данные · на' + NB + '01.10.2026"', t1)
        self.assertIn("Плюсы и" + NB + "минусы ООО&nbsp;«Ромашка»", t1)
        self.assertIsNone(K.plyusy_minusy_stroki("<main></main>"))
        self.assertEqual(K.plyusy_minusy_kartochki("<main></main>"), "<main></main>")

    def test_novaya_kartochka(self):
        k = K.iz_check(O.zapis(3))
        t = K.html_kartochki(k, K.vyvody(k), [], None)
        self.assertEqual(t.count('class="co-sec co-pm"'), 1)


class TestOpublikovannye(unittest.TestCase):
    def test_na_vseh_kartochkah(self):
        fajly = sorted(glob.glob(str(KOREN / "company" / "*" / "index.html")))
        fajly = [f for f in fajly if re.search(r"/\d{10}-", f)]
        self.assertGreater(len(fajly), 100)
        for f in fajly:
            t = Path(f).read_text(encoding="utf-8")
            m = K.PM_SEK.search(t)
            self.assertTrue(m, f)
            b = m.group(0)
            b2 = K.PM_SEK.search(K.plyusy_minusy_kartochki(t)).group(0)
            self.assertEqual(html.unescape(b2).replace(NB, " "), html.unescape(b).replace(NB, " "), f)  # перепечатка блока не меняет (с точностью до вида пробела)
            tx = html.unescape(re.sub(r"<[^>]+>", " ", b))
            self.assertFalse(K.STOP_SLOVA.search(tx), f)  # без оценок компании
            self.assertNotIn("#C", b)  # цвета — только в css/co.css через var()
            for li in re.findall(r"<li data-pm=.*?</li>", b):
                self.assertIn('href="#reestry"', li, f)
                self.assertIn(' на' + NB, html.unescape(re.search(r'title="([^"]*)"', li).group(1)), f)

    def test_css(self):
        css = (KOREN / "css" / "co.css").read_text(encoding="utf-8")
        self.assertIn(".pm__k--plus li::before{content:\"+\";color:var(--mat-zhdu,#7A5C14)}", css)
        self.assertNotRegex(css.split("kartochki-plyusy-v1")[1], r"(?i)#(?:c0392b|e53935|d32f2f|f44336)")  # без красного


if __name__ == "__main__":
    unittest.main()
