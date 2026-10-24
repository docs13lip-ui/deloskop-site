#!/usr/bin/env python3
"""kartochki-znachit-v1: блок «Что это значит для вас» на карточках /company/ (п. 6 шаблона [Продукт · Яндекс] 11.10).
Запуск: python3 tests/test_kartochki_znachit.py"""
import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402
import kartochki_obrazec as O  # noqa: E402
import kartochka_render as R  # noqa: E402

KOREN = pathlib.Path(__file__).resolve().parent.parent
NB = " "
BLOK = re.compile(r'<section class="co-sec co-znachit".*?</section>', re.S)


def chitat(p):
    t = pathlib.Path(p).read_text(encoding="utf-8")
    for z, (sush, _) in K.NEVIDIMYE.items():
        t = t.replace(sush, z)
    return t


def frazy_bloka(t):
    m = BLOK.search(t)
    if not m:
        return []
    return [R._zn_txt(p) for p in re.findall(r"<p>(.*?)</p>", m.group(0), re.S)]


def stranica(imya="ООО «Ромашка»", osnovana="2010-03-15", na="10.10.2026", V=(), ryad=(), fns=None):
    """Минимальная страница карточки той же разметки, что html_kartochki (для правил блока)."""
    ld = ('<script type="application/ld+json">{"@graph": [{"@type": "Organization", "foundingDate": "%s", "name": "%s", '
          '"taxID": "7700000000"}]}</script>' % (osnovana, imya.replace('"', '\\"')))
    vv = "".join('<li class="co-v co-v--%s"><span class="co-v__z"></span><div><p>%s</p><span class="co-src">ЕГРЮЛ · сведения на %s'
                 ' · ● подтверждено источником</span></div></li>' % (ton, tx, na) for ton, tx in V)
    if fns:
        fin = '<section class="co-sec" aria-labelledby="fin"><h2 id="fin">Доход за 2025 год — %s</h2></section>' % fns
    else:
        tab = "".join('<tr><td>%d</td><td class="num">%s</td>%s</tr>' % (
            g, d, ('<td class="num">%s</td>' % p) if p is not None else "") for g, d, p in sorted(ryad, reverse=True))
        fin = ('<section class="co-sec" aria-labelledby="fin"><h2 id="fin">Выручка</h2><table><tbody>%s</tbody></table>'
               '</section>' % tab)
    return ('<html><head>%s</head><body><main id="main"><section class="co-sec" aria-labelledby="korotko"><ul>%s</ul></section>\n'
            '<section class="co-sec co-pered" aria-labelledby="pered"><h2 id="pered">Перед оплатой</h2></section>\n%s'
            '</main></body></html>' % (ld, vv, fin))


class TestPravila(unittest.TestCase):
    def test_ubytok_i_kapital(self):
        t = K.vstavit_znachit(stranica(
            V=[("warn", "Собственный капитал на 31.12.2025 — минус 12,6 млрд ₽: обязательства больше активов"),
               ("warn", "Убыток за 2025 — 9,8 млрд ₽, шестой год подряд")],
            ryad=[(2023, "37,3 млрд ₽", "убыток 1 млрд ₽"), (2024, "36,2 млрд ₽", "убыток 9,4 млрд ₽"),
                  (2025, "36,6 млрд ₽", '<span class="co-ub">убыток</span> 9,8 млрд ₽')]))
        f = " ".join(frazy_bloka(t)).replace(NB, " ")
        self.assertIn("У «Ромашка» за 2025 год убыток 9,8 млрд ₽ (шестой год подряд) при выручке 36,6 млрд ₽", f)
        self.assertIn("обязательства больше активов на 12,6 млрд ₽", f)
        self.assertIn("привяжите оплату к поставке или этапам работ", f)
        self.assertIn("При убытке 9,8 млрд ₽ за 2025 год заказ от 3 млрд ₽ (это средняя выручка «Ромашка» в месяц)", f)
        self.assertLess(t.index("co-znachit"), t.index("co-pered"))  # перед «Перед оплатой»

    def test_padenie_pribyli(self):
        f = " ".join(frazy_bloka(K.vstavit_znachit(stranica(
            ryad=[(2023, "10 млрд ₽", "1 млрд ₽"), (2024, "10 млрд ₽", "1 млрд ₽"), (2025, "11 млрд ₽", "200 млн ₽")])))).replace(NB, " ")
        self.assertIn("Прибыль «Ромашка» за 2025 год — 200 млн ₽, на 80 % меньше, чем годом раньше, при выручке, выросшей на 10 %", f)
        self.assertIn("аккредитив", f)

    def test_padenie_vyruchki_i_staraya_otchetnost(self):
        f = " ".join(frazy_bloka(K.vstavit_znachit(stranica(V=[("ok", "Работает 16 лет — с 2010 года")], ryad=[(2021, "10 млрд ₽", None), (2022, "6 млрд ₽", None)])))).replace(NB, " ")
        self.assertIn("Выручка «Ромашка» за 2022 год — 6 млрд ₽, на 40 % меньше, чем годом раньше", f)
        self.assertIn("Последняя открытая отчётность «Ромашка» — за 2022 год. За 2023–2025 годы в открытой части ГИР БО её нет", f)  # kartochki-zakrytye-v1

    def test_pribyl_rentabelnost(self):
        f = " ".join(frazy_bloka(K.vstavit_znachit(stranica(
            ryad=[(2024, "100 млн ₽", "5 млн ₽"), (2025, "120 млн ₽", "12 млн ₽")])))).replace(NB, " ")
        self.assertIn("Каждый рубль выручки «Ромашка» приносит больше: чистая прибыль «Ромашка» за 2025 год — 12 млн ₽, это 10 % от 120 млн ₽ (годом раньше — 5 %)", f)

    def test_dolg_rukovoditel_molodaya(self):
        f = " ".join(frazy_bloka(K.vstavit_znachit(stranica(osnovana="2024-05-01", V=[
            ("warn", "Задолженность перед бюджетом — 1,2 млн ₽ на 1 сентября 2026. Могла быть погашена после этой даты"),
            ("warn", "Руководитель сменился 2 месяца назад")], fns="40 млн ₽")))).replace(NB, " ")
        self.assertIn("в реестре с 2024 года (2 года): история короткая", f)
        self.assertIn("задолженность перед бюджетом — 1,2 млн ₽: попросите справку", f)
        self.assertIn("У «Ромашка» руководитель сменился 2 месяца назад — убедитесь", f)

    def test_bez_vyruchki_bloka_net(self):
        s = stranica(ryad=[])
        self.assertEqual(K.vstavit_znachit(s), s)

    def test_stop_slova_i_povtor(self):
        s = stranica(ryad=[(2024, "100 млн ₽", "5 млн ₽"), (2025, "120 млн ₽", "12 млн ₽")])
        t = K.vstavit_znachit(s)
        self.assertEqual(K.vstavit_znachit(t), t)
        self.assertFalse(K.STOP_SLOVA.search(BLOK.search(t).group(0)))


class TestNovayaKartochka(unittest.TestCase):
    def test_html_kartochki_s_blokom(self):
        k = K.iz_check(O.zapis(3))
        t = K.html_kartochki(k, K.vyvody(k), [])
        self.assertEqual(t.count('class="co-sec co-znachit"'), 1)
        self.assertLess(t.index("co-znachit"), t.index("co-pered"))
        self.assertEqual(K.vstavit_znachit(t), t)


class TestUnikV2(unittest.TestCase):
    """kartochki-unik-v2: варианты по фактам, «На фоне других компаний Делоскопа», «Перед оплатой» по признакам."""

    def test_pribyl_iz_korotko(self):
        # прибыли нет в таблице, но есть в «Коротко» — блок не пишет «прибыли нет» (было у «НЛМК» 12.10)
        f = " ".join(frazy_bloka(K.vstavit_znachit(stranica(
            V=[("ok", "Чистая прибыль за 2025 — 86,7 млрд ₽")],
            ryad=[(2023, "699 млрд ₽", None), (2024, "738 млрд ₽", None), (2025, "606 млрд ₽", None)])))).replace(NB, " ")
        self.assertIn("86,7 млрд ₽ чистой прибыли при выручке 606 млрд ₽", f)
        self.assertNotIn("Прибыли в открытых данных", f)

    def test_povorot_k_pribyli(self):
        f = " ".join(frazy_bloka(K.vstavit_znachit(stranica(
            ryad=[(2023, "10 млрд ₽", "1 млрд ₽"), (2024, "11 млрд ₽", "убыток 2 млрд ₽"), (2025, "12 млрд ₽", "1,5 млрд ₽")])))).replace(NB, " ")
        self.assertIn("снова в плюсе: 1,5 млрд ₽ чистой прибыли при выручке 12 млрд ₽, а за 2024 год был убыток 2 млрд ₽", f)

    def test_otlichie(self):
        vse = {}
        for i in range(6):
            vse["77000000%02d" % i] = {"inn": "77000000%02d" % i, "imya": "ООО «Р%d»" % i, "razdel": "Энергетика",
                                      "region": "Москва", "osnovana": R.dt.date(2000 + i, 1, 1), "g1": 2025,
                                      "r1": (10 - i) * 1e9, "pr1": 1e8, "pr0": 1e8, "y0": 2021, "r0": 1e9, "let_ryada": 5}
        tx, god = R.un_otlichie(vse["7700000000"], vse)
        self.assertEqual(god, 2025)
        self.assertIn("больше, чем у остальных 5 в разделе «Энергетика»", tx)
        self.assertIn("«Р1» (9 млрд ₽)", tx.replace(NB, " "))
        tx = R.un_otlichie(vse["7700000003"], vse)[0].replace(NB, " ")
        self.assertIn("между «Р2» (8 млрд ₽) и «Р4» (6 млрд ₽)", tx)
        self.assertFalse(K.STOP_SLOVA.search(tx))

    def test_pered_po_priznakam(self):
        bez = R.un_pered(R.un_fakty(stranica(ryad=[(2024, "100 млн ₽", "5 млн ₽"), (2025, "120 млн ₽", "12 млн ₽")])))
        self.assertEqual(len(bez), 1)
        self.assertIn("замечаний нет", bez[0])
        self.assertIn("7700000000", bez[0])
        s = R.un_pered(R.un_fakty(stranica(V=[("warn", "Руководитель сменился 2 месяца назад")],
                                          ryad=[(2024, "100 млн ₽", "5 млн ₽"), (2025, "120 млн ₽", "убыток 12 млн ₽")])))
        self.assertTrue(any("сменился 2 месяца назад" in x for x in s))
        self.assertTrue(any("убыток 12" in x.replace(NB, " ") for x in s))
        self.assertTrue(s[-1].startswith("Счёт от «Ромашка»"))

    def test_pered_idempotentno(self):
        t = ('<script type="application/ld+json">{"@graph": [{"@type": "Organization", "name": "ООО «Ромашка»", '
             '"taxID": "7700000000"}]}</script><section class="co-sec co-pered" aria-labelledby="pered"><h2 id="pered">'
             'Перед оплатой</h2><ul><li>старое</li></ul></section>')
        t2 = R.pochinit_pered(t)
        self.assertNotIn("старое", t2)
        self.assertEqual(R.pochinit_pered(t2), t2)

    def test_razbor_s_imenem(self):
        t = ('<script type="application/ld+json">{"@graph": [{"@type": "Organization", "name": "ПАО «Ромашка»", '
             '"taxID": "7700000000"}]}</script><section class="co-sec co-razbor"><h2 id="razbor">Разбор по цифрам</h2>'
             '<p>За&nbsp;5&nbsp;лет выручка выросла в&nbsp;2&nbsp;раза</p></section>')
        t2 = R.pochinit_razbor(t)
        self.assertIn("<p>Выручка «Ромашка» за" + NB + "5" + NB + "лет выросла", t2)
        self.assertIn('<h2 id="razbor">Разбор по цифрам</h2>', t2)
        self.assertEqual(R.pochinit_razbor(t2), t2)

    def test_kratkoe_imya(self):
        self.assertEqual(R.un_kratkoe("ПАО «НЛМК»"), "«НЛМК»")
        self.assertEqual(R.un_kratkoe("Банк ВТБ (ПАО)"), "Банк ВТБ (ПАО)")


class TestOpublikovannye(unittest.TestCase):
    """Все карточки сайта: блок есть, ≥ 60 слов, без стоп-слов, свой у каждой компании."""

    @classmethod
    def setUpClass(cls):
        cls.str = {p.parent.name: chitat(p) for p in sorted((KOREN / "company").glob("[0-9]*-*/index.html"))}
        K.un_zagruzit(str(KOREN))  # kartochki-unik-v2: контекст «На фоне других» — как при сборке

    def test_blok_na_kazhdoj(self):
        self.assertGreater(len(self.str), 0)
        for imya, t in self.str.items():
            fr = frazy_bloka(t)
            self.assertTrue(fr, imya + ": нет блока — python3 tests/kartochki.py sobrat --dobavit --vhod <пустой.jsonl>")
            self.assertGreaterEqual(sum(len(x.split()) for x in fr[:-1]), K.ZN_MIN_SLOV, imya)
            self.assertFalse(K.STOP_SLOVA.search(" ".join(fr)), imya)
            # kartochki-chisla-v1: шаг сборки работает без NB_T, знак ставит запись файла (tipograf_kartochki(…, chisla=True))
            self.assertEqual(K.bez_tipografa(K.vstavit_znachit(t)), K.bez_tipografa(t), imya + ": блок устарел — пересоберите")

    def test_svoj_tekst(self):
        vse = {imya: set(frazy_bloka(t)[:-1]) for imya, t in self.str.items()}
        for imya, fr in vse.items():
            chuzhie = set().union(*(v for i, v in vse.items() if i != imya))
            obshie = fr & chuzhie
            self.assertLessEqual(len(obshie), 1, "%s: общие предложения с другими карточками: %s" % (imya, obshie))


if __name__ == "__main__":
    unittest.main()
