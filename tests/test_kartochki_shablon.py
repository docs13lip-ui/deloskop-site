#!/usr/bin/env python3
"""kartochki-shablon-v1 ([Ночные-2] 11.10; ТЗ [Продукт · Яндекс] 11.10 14:40 пп. 2, 3, 5, 7): H1 с ИНН, строка под H1,
description с отраслью и главным фактом, не меньше 5 ссылок на другие карточки, отчёт о совпадении текста с соседями.

    python3 tests/test_kartochki_shablon.py
"""
import html
import os
import pathlib
import re
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import kartochki as K  # noqa: E402
import kartochki_obrazec as O  # noqa: E402
import kartochka_render as R  # noqa: E402

KOREN = pathlib.Path(__file__).resolve().parent.parent
NB = " "


def sobrat(zapisi, **kw):
    d = tempfile.mkdtemp()
    shutil.copy(KOREN / "robots.txt", d)
    kart, o = K.sobrat(zapisi, d, **kw)
    return d, kart, o


def stranicy(koren):
    return sorted(p for p in pathlib.Path(koren, "company").glob("*/index.html") if re.match(r"^\d{10}-", p.parent.name))


def desc(t):
    m = re.search(r'<meta name="description" content="([^"]*)"', t)
    return html.unescape(m.group(1)) if m else ""


class TestShablonObrazec(unittest.TestCase):
    """На образцовом наборе: новые карточки, добор и повторная печать дают одно и то же."""

    @classmethod
    def setUpClass(cls):
        cls.d, cls.kart, _ = sobrat(O.nabor(12))
        cls.st = {p.parent.name: R.bez_tipografa(p.read_text(encoding="utf-8")) for p in stranicy(cls.d)}  # kartochki-korotkie-v1: без NB_T

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.d, ignore_errors=True)

    def test_h1_s_inn(self):
        for papka, t in self.st.items():
            h1 = re.findall(r"<h1>(.*?)</h1>", t, re.S)
            self.assertEqual(len(h1), 1, papka)
            self.assertIn('<span class="co-h1-inn">ИНН&nbsp;%s</span>' % papka[:10], h1[0], papka)  # h1-d4: без запятой

    def test_podzag_bez_povtora_inn(self):
        for papka, t in self.st.items():
            sub = re.search(r'<p class="co-sub">(.*?)</p>', t).group(1)
            self.assertNotIn("ИНН", sub, papka)          # ИНН — в H1
            self.assertRegex(sub, r"^Действующая · ", papka)
            self.assertIn("ОГРН", sub, papka)

    def test_description(self):
        vse = [desc(t) for t in self.st.values()]
        for papka, t in self.st.items():
            s = desc(t)
            self.assertTrue(s, papka)
            self.assertLessEqual(len(s), K.SHABLON_DESC_MAX, s)
            self.assertTrue(s.endswith((".", "…")), s)
            d = K.shablon_dannye(t)
            if d["otrasl"]:
                self.assertIn(d["otrasl"], s, papka)
            self.assertNotRegex(s, r"Работает \d", "вывод о возрасте — не главный факт")
        self.assertEqual(len(set(vse)), len(vse), "у двух карточек одинаковый сниппет")

    def test_ne_menshe_5_ssylok(self):
        for papka, t in self.st.items():
            blok = re.search(r'aria-labelledby="sos".*?</aside>', t, re.S).group(0)
            ss = re.findall(r'<li><a href="/company/([^/"]+)/">', blok)
            self.assertGreaterEqual(len(ss), min(5, len(self.st) - 1), papka)
            self.assertEqual(len(ss), len(set(ss)), papka)
            self.assertNotIn(papka, ss)

    def test_pohozhie_tolko_klass_eshche_otdelno(self):
        # решение [Данные] 03.10: «Похожие компании» — только тот же класс ОКВЭД; добор до 5 — своим заголовком
        for papka, t in self.st.items():
            blok = re.search(r'aria-labelledby="sos".*?</aside>', t, re.S).group(0)
            if "co-sos--eshche" in blok:
                self.assertRegex(blok, r'<p class="co-sos__h caption">(Ещё в регионе: |Ещё компании в Делоскопе)')

    def test_povtornaya_pechat_nichego_ne_menyaet(self):
        _, o = K.sobrat([], self.d, dobavit=True)
        self.assertEqual(o["izmeneno_stranic"], 0)

    def test_shablon_idempotenten(self):
        for t in self.st.values():
            t = K.bez_tipografa(t)  # kartochki-chisla-v1: шаблон — по тексту без NB_T, как в сборке
            self.assertEqual(K.bez_nevidimyh(K.shablon_v2(t)), t)  # на диске NBSP — сущностью


class TestShablonEdinicy(unittest.TestCase):
    def test_otrasl_malenkaya_bukva(self):
        self.assertEqual(R._sh_mal("Передача электроэнергии"), "передача электроэнергии")
        self.assertEqual(R._sh_mal("ЖКХ"), "ЖКХ")

    def test_glavnyj_fakt_bez_vozrasta_i_vyruchki(self):
        t = ('<li class="co-v co-v--ok"><span></span><div><p>Работает 32 года — с 1994 года</p></div></li>'
             '<li class="co-v co-v--ok"><span></span><div><p>Выручка за 2025 — 1 млрд ₽</p></div></li>'
             '<li class="co-v co-v--ok"><span></span><div><p>Налоговой задолженности в данных ФНС нет (на 1 сентября 2026)</p></div></li>')
        self.assertEqual(K.shablon_glavnyj_fakt(t), ["Налоговой задолженности в данных ФНС нет (на 1 сентября 2026)",
                                                     "Налоговой задолженности в данных ФНС нет"])

    def test_dlinnyj_fakt_vytesnyaet_procent_a_ne_naoborot(self):
        d = {"name": "ООО «Очень длинное название компании для проверки»", "mesto": "Санкт-Петербург",
             "otrasl": "обрабатывающие производства", "god": 2001, "staraya": False,
             "vyruchka": "выручка 1,4 трлн ₽ за 2025 (−12 %)", "fakty": ["Убыток за 2025 — 9,8 млрд ₽, шестой год подряд"]}
        s = K.shablon_description(d)
        self.assertLessEqual(len(s), K.SHABLON_DESC_MAX)
        self.assertIn("Убыток", s)

    def test_staraya_otchetnost_bez_deneg(self):
        d = {"name": "ООО «Тест»", "mesto": "Тула", "otrasl": "", "god": 2010, "staraya": True, "vyruchka": "",
             "fakty": ["Уплатила налогов и взносов — 8,6 млн ₽ за 2025", "Налоговой задолженности в данных ФНС нет"]}
        self.assertEqual(K.shablon_description(d), "ООО «Тест» (Тула): с 2010 года. Налоговой задолженности в данных ФНС нет.")

    def test_sovpadenie_otchet(self):
        a = "<main><p>Первое длинное предложение для проверки. Второе длинное предложение карточки.</p></main>"
        self.assertEqual(K.predlozheniya(a), {"Первое длинное предложение для проверки.", "Второе длинное предложение карточки."})


class TestShablonNaSajte(unittest.TestCase):
    """Опубликованные карточки в репозитории — уже по шаблону (после `python3 tests/kartochki.py perepechatat`)."""

    def test_vse_kartochki_po_shablonu(self):
        st = stranicy(KOREN)
        if not st:
            self.skipTest("карточек нет")
        ne = [p.parent.name for p in st if "co-h1-inn" not in p.read_text(encoding="utf-8")]
        self.assertEqual(ne, [], "запустите: python3 tests/kartochki.py perepechatat")

    def test_snippety_raznye(self):
        vse = [desc(p.read_text(encoding="utf-8")) for p in stranicy(KOREN)]
        self.assertEqual(len(set(vse)), len(vse))


if __name__ == "__main__":
    unittest.main()
