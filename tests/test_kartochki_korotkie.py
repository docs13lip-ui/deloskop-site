#!/usr/bin/env python3
"""kartochki-korotkie-v1 (24.10.2026, [Ночные-2]): шаг 2 типографики карточек /company/ — короткие слова («в | банк»,
«для | сделки», «не | нашли»), «ст. | 7», «№ | 115» и «слово | —» не рвутся переносом (как PRAVILA статей в
tests/tipograf_statej.py). Знак — NB_T, как у kartochki-chisla-v1.
Сторож: (1) в видимом тексте опубликованных карточек таких разрывов нет; (2) правила — копия правил статей;
(3) без NB_T карточка — прежний текст (bez_tipografa снимает и эти знаки), повторный вызов — те же байты;
(4) <head>, JSON-LD и блоки сборщиков не трогаем; (5) ворота индексации читают карточку без NB_T."""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402
import tipograf_statej as TS  # noqa: E402
from test_kartochki_tipograf import kartochki, vidimyj  # noqa: E402

RAZRYVY = {
    "короткое слово": re.compile(r"(?i)(?<![\w&#-])" + TS.KOROTKIE + r" (?!\s)"),
    "номер": re.compile(r"(?<![\w-])(?:пп?\.|ст\.|ч\.|№) (?!\s)"),
    "слово —": re.compile(r"\S —"),
}


class TestKartochkiKorotkie(unittest.TestCase):
    def test_net_razryvov(self):
        plohie, n = [], 0
        for d, t in kartochki():
            n += 1
            tx = vidimyj(t)
            bez_faktov = vidimyj(K._TK_FACT.sub("", t))  # в строках фактов короткие слова не склеиваем (320 px, сетка ДС)
            for imya, rx in RAZRYVY.items():
                x = bez_faktov if imya == "короткое слово" else tx
                m = rx.search(x)
                if m:
                    plohie.append("%s — %s: …%s…" % (d, imya, x[max(0, m.start() - 20):m.end() + 10]))
        self.assertGreater(n, 100)
        self.assertEqual(plohie[:10], [])

    def test_fakty_bez_skleiki(self):
        t = '<p>Проверка в банке</p><div class="fact"><span>Отметки о недостоверности</span><span>нет — 3 года</span></div>'
        r = K.tipograf_kartochki(t, chisla=True)
        self.assertIn("в" + K.NB_T + "банке", r)
        self.assertIn("Отметки о недостоверности", r)
        self.assertIn("нет" + K.NB_T + "— 3" + K.NB_T + "года", r)

    def test_pravila_kak_u_statej(self):
        self.assertIn("(" + TS.KOROTKIE[3:-1] + ")", K._TK_KOROTKIE.pattern.replace("\n", ""))
        t = "<p>Проверка в банке и для сделки — не нашли; ст. 7 и № 115</p>"
        r = K.tipograf_kartochki(t, chisla=True)
        nb = K.NB_T
        for kusok in ("в" + nb + "банке", "и" + nb + "для" + nb + "сделки" + nb + "—", "не" + nb + "нашли", "ст." + nb + "7",
                      "№" + nb + "115"):
            self.assertIn(kusok, r)

    def test_bez_nb_t_prezhnij_tekst_i_povtor(self):
        t = ('<html><head><title>Проверка в банке — Делоскоп</title></head><body>'
             '<script type="application/ld+json">{"d": "в банке"}</script>'
             '<!--podval--><p>Проверка по ИНН</p><!--/podval-->'
             '<p class="x" title="в банке">Банк и налоговая — <a href="/">для сделки</a> в порядке</p></body></html>')
        r = K.tipograf_kartochki(t, chisla=True)
        self.assertIn("<title>Проверка в банке — Делоскоп</title>", r)
        self.assertIn('{"d": "в банке"}', r)
        self.assertIn('title="в банке"', r)
        self.assertIn("<!--podval--><p>Проверка по ИНН</p><!--/podval-->", r)
        self.assertEqual(K.bez_tipografa(r), t)
        self.assertEqual(K.tipograf_kartochki(r, chisla=True), r)

    def test_vorota_bez_nb_t(self):
        for d, t in list(kartochki())[:40]:
            self.assertEqual(K.vorota_indeksa_html(t), K.vorota_indeksa_html(K.bez_tipografa(t)), d)
            self.assertEqual(K.noindex_html(t), not K.vorota_indeksa_html(t)[0], d)


if __name__ == "__main__":
    unittest.main()
