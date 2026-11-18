#!/usr/bin/env python3
"""pervyj-ekran-kartochki-v1 (18.11.2026): первым экраном карточки /company/ — «Итог по фактам» вместо кольца Индекса
(решение владельца 18.11 «сайт лучше справочников», разд. 3 п. 1). Сторож: (1) итог — «Плюсов N, минусов M — по фактам,
собранным ДД.ММ.ГГГГ», N и M — те же, что в «Плюсах и минусах», дата — ЕГРЮЛ под названием; (2) фактов ≤ 3, минусы первыми,
каждый — дословно строка «Плюсов и минусов» той же страницы; (3) итог стоит до кнопок, кольца и /js/linza.js нет, цель
kartochka_indeks — одна; (4) слов-оценок («существенн», «надёжн», «рискованн») в итоге нет; (5) идемпотентна; без данных
страница не меняется; (6) всё это — на каждой опубликованной карточке."""
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
_ITOG = re.compile(r'<section class="co-itog" aria-labelledby="itog">(.*?)</section><!--/co-itog-->', re.S)
# chto-za-kompaniya-v1: три формы итога словами [Право] 18.11 (2) — «Плюсов N, минусов M», «Есть M существенных минуса»,
# «Существенных минусов не нашли» — и «— по K проверенным источникам на ДД.ММ.ГГГГ»
_STROKA = re.compile(r'<h2 id="itog" class="co-itog__s">(?:Плюсов (\d+), минусов (\d+)|Есть (\d+)(?:&nbsp;|&#160;|\u00a0| )существенн[а-я]+ минус[а-я]*|'
                     r'Существенных минусов не(?:&nbsp;|&#160;|\u00a0| )нашли)'
                     r'<span class="co-itog__d">(?:&nbsp;|&#160;|\u00a0| )— по(?:&nbsp;|&#160;|\u00a0| )(\d+)(?:&nbsp;|&#160;|\u00a0| )проверенным источникам на(?:&nbsp;|&#160;|\u00a0| )(\d{2}\.\d{2}\.\d{4})</span></h2>')
_LI = re.compile(r'<li class="co-itog__l co-itog__l--(plus|minus)" data-pm="([a-z_]+)"><a href="#reestry"[^>]*><span class="vh">[^<]*</span>(.*?)</a></li>', re.S)
_PM_LI = re.compile(r'<li data-pm="([a-z_]+)"><a class="pm__a" href="#reestry"[^>]*>(.*?)</a></li>', re.S)


def txt(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", s)).replace(NB, " ").split())


def proverit(tc, t, imya):
    m = _ITOG.search(t)
    tc.assertTrue(m, imya + ": нет итога")
    blok = m.group(0)
    s = _STROKA.search(blok)
    tc.assertTrue(s, imya + ": строка итога")
    pm = re.search(r'<section class="co-sec co-pm"[^>]*data-plyusy="(\d+)" data-minusy="(\d+)"', t)
    tc.assertTrue(pm, imya)
    S = K.plyusy_minusy_stroki(t)
    sush = [x for x in S["minusy"] if K.cz_sushchestvennyj(x, S["baza"])]
    if sush:
        tc.assertEqual(s.group(3), str(len(sush)), imya + ": «Есть M существенных» — M по порогу")
    elif pm.group(2) == "0":
        tc.assertIn("Существенных минусов не", s.group(0), imya + ": «не нашли» — только без минусов")
    else:
        tc.assertEqual((s.group(1), s.group(2)), pm.groups(), imya + ": число плюсов и минусов как в «Плюсах и минусах»")
    ist = {x[2] for x in S["plyusy"] + S["minusy"] if x[2]}
    tc.assertEqual(int(s.group(4)), len(ist), imya + ": K — число разных источников у строк")
    eg = re.search(r'<p class="caption co-okved">.*?ЕГРЮЛ · сведения на(?:&#160;|&nbsp;| | )(\d{2}\.\d{2}\.\d{4})</p>', t, re.S)
    tc.assertEqual(s.group(5), eg.group(1), imya + ": дата — сбор фактов (ЕГРЮЛ под названием)")
    n = re.search(r'<p class="caption co-itog__n"><span>Не(?:&#160;|&nbsp;| )проверяли:</span> ([^<]+)\.</p>', blok)
    tc.assertTrue(n, imya + ": «Не проверяли» сразу под итогом")
    for x in S["ne"] + K.CZ_NE_VSEGDA:
        tc.assertIn(txt(x), txt(n.group(1)), imya)
    if "существенн" in txt(s.group(0)).lower():
        tc.assertIn("Существенно — сумма от 0,1 % выручки", txt(blok), imya + ": порог раскрыт")
    li = _LI.findall(blok)
    tc.assertTrue(1 <= len(li) <= 3, imya)
    vidy = [x[0] for x in li]
    tc.assertEqual(vidy, sorted(vidy, key=lambda v: v != "minus"), imya + ": минусы первыми")
    # sushchestvennost-v1: минус меньше 0,1 % выручки — не в главном, а строкой «Мелкое к выручке»
    melkih = len(re.findall(r"меньше 0,1(?:&nbsp;| )% выручки", "".join(v for k, v in _PM_LI.findall(
        t[t.index('class="co-sec co-pm"'):t.index("</section>", t.index('class="co-sec co-pm"'))]))))
    if int(pm.group(2)) > melkih:
        tc.assertEqual(vidy[0], "minus", imya)
    stroki_pm = {(k, txt(v)) for k, v in _PM_LI.findall(t[t.index('class="co-sec co-pm"'):])}
    for _, k, v in li:
        tc.assertIn((k, txt(v)), stroki_pm, imya + ": факт итога — дословно строка «Плюсов и минусов»")
    tc.assertLess(t.index(blok), t.index('<div class="co-act">'), imya + ": итог — до кнопок")
    tc.assertNotIn("co-ind--wait", t, imya + ": кольца нет")
    tc.assertNotIn("/js/linza.js", t, imya)
    tc.assertEqual(t.count('data-goal="kartochka_indeks"'), 1, imya)
    tc.assertIsNone(re.search(r"(?i)надёжн|рискованн|опасн|чист[аы]|можно платить|безопасн|мелоч|мелкое", txt(blok)), imya + ": итог без оценок")


class TestPervyjEkran(unittest.TestCase):
    def stranica(self):
        for p in sorted((KOREN / "company").glob("*/index.html")):
            t = p.read_text(encoding="utf-8")
            if 'data-minusy="1"' in t:
                return t
        self.skipTest("нет карточки с минусом")

    def test_idempotentna(self):
        # байты опубликованных при повторной перепечатке не меняются — это держит сборка (git diff пуст после perepechatat);
        # здесь — сама функция: снятый итог собирается заново, второй вызов ничего не меняет
        bez = K.IT_SEK.sub("", self.stranica())
        n = K.pervyj_ekran_kartochki(bez)
        self.assertIn('class="co-itog"', n)
        self.assertEqual(K.pervyj_ekran_kartochki(n), n)
        self.assertEqual(K.IT_SEK.sub("", n).replace("\n", ""), bez.replace("\n", ""), "кроме итога страница прежняя")

    def test_bez_dannyh_ne_menyaet(self):
        for t in ("", "<main></main>", '<main><div class="co-act"></div></main>'):
            self.assertEqual(K.pervyj_ekran_kartochki(t), t)

    def test_kolco_snimaetsya(self):
        t = self.stranica()
        kolco = ('<section class="co-ind co-ind--wait linza linza--zhdet" aria-label="Индекс Делоскопа"><p class="co-ind__n">x</p>'
                 '<script src="/js/linza.js" defer></script></section>\n')
        s = K.IT_SEK.sub("", t).replace('<div class="co-grid">\n<div class="co-main">\n',
                                        '<div class="co-grid">\n<div class="co-main">\n' + kolco, 1)
        self.assertIn("co-ind--wait", s)
        n = K.pervyj_ekran_kartochki(s)
        self.assertNotIn("co-ind--wait", n)
        self.assertNotIn("/js/linza.js", n)
        proverit(self, n, "образец")

    def test_itog_html(self):
        S = {"plyusy": [("status", "Действующая компания", "ЕГРЮЛ", "15.11.2026"), ("fssp", "Производств не нашли", "ФССП", "12.11.2026"),
                        ("age", "На рынке с 2003 года", "ЕГРЮЛ", "15.11.2026")],
             "minusy": [], "ne": ["арбитражные суды"], "imya": "ООО «Тест»"}
        h = K.itog_html(S, "7707083893", "15.11.2026")
        # chto-za-kompaniya-v1: минусов нет — «Существенных минусов не нашли — по K источникам на дату», «Не проверяли» под ним
        self.assertIn("Существенных минусов не" + NB + "нашли", h)
        self.assertIn("по" + NB + "2" + NB + "проверенным источникам на" + NB + "15.11.2026", h)
        self.assertIn("арбитражные суды, приставы", h.replace("приостановки", "приставы"), "«Не проверяли» — сначала непроверенное страницей")
        S2 = dict(S, minusy=[("bankrotstvo", "Сообщения о банкротстве в ЕФРСБ", "ЕФРСБ", "12.11.2026")])
        self.assertIn("Есть 1" + NB + "существенный минус", K.itog_html(S2, "7707083893", "15.11.2026"))
        S3 = dict(S, minusy=[("pravonarusheniya", "Налоговые правонарушения: есть", "ФНС", "01.10.2026")])
        h3 = K.itog_html(S3, "7707083893", "15.11.2026")
        self.assertIn("Плюсов 3, минусов 1", h3, "минус без суммы и не из списка — нейтральная форма")
        self.assertNotIn("не" + NB + "нашли", h3.split("</h2>")[0])
        self.assertEqual([x[1] for x in _LI.findall(h)], ["fssp", "status", "age"], "плюсы по весу: приставы раньше статуса")
        self.assertEqual(K.itog_html(S, "7707083893", ""), "", "без даты сбора итога нет")
        self.assertEqual(K.itog_html({"plyusy": [], "minusy": [], "ne": [], "imya": "x"}, "7707083893", "15.11.2026"), "")

    def test_opublikovannye(self):
        n = 0
        for p in sorted((KOREN / "company").glob("*/index.html")):
            t = p.read_text(encoding="utf-8")
            if 'class="co-sec co-pm"' not in t:
                continue
            proverit(self, t, p.parent.name)
            n += 1
        if (KOREN / "company").is_dir():
            self.assertGreater(n, 100)


if __name__ == "__main__":
    unittest.main()
