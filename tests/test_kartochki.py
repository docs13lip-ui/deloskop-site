#!/usr/bin/env python3
"""Проверки карточек компаний (karta-v1): ворота индексации, ИП, люди, Индекс, SEO-мета, детерминизм.
Собирает вымышленные компании (регион «00») во временную папку — сайт не трогает.
Запуск: python3 tests/test_kartochki.py"""
import json
import os
import pathlib
import re
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402
import kartochki_obrazec as O  # noqa: E402

KOREN = pathlib.Path(__file__).resolve().parent.parent
NB = " "


def sobrat(zapisi, **kw):
    d = tempfile.mkdtemp()
    shutil.copy(KOREN / "robots.txt", d)
    kart, o = K.sobrat(zapisi, d, **kw)
    return d, kart, o


def stranicy(d):
    return sorted(pathlib.Path(d, "company").glob("*/index.html"))


class TestVorota(unittest.TestCase):
    def test_obychnaya_prohodit(self):
        k = K.iz_check(O.zapis(3))
        self.assertEqual(K.vorota(k), (True, "ок"))

    def test_ip_ne_sozdaetsya_vovse(self):
        ip = O.zapis(1, inn="500100732259", kind="INDIVIDUAL", name="ИП Примеров Иван Петрович")
        d, kart, o = sobrat([ip, O.zapis(2)])
        self.assertEqual(o["ip_otbrosheno"], 1)
        self.assertFalse(any("500100732259" in p.name for p in stranicy(d)))
        self.assertNotIn("500100732259", pathlib.Path(d, "sitemap-companies.xml").read_text(encoding="utf-8"))

    def test_otsev_po_pravilam(self):
        sluchai = {
            "статус не «действующая»": O.zapis(1, status="LIQUIDATING"),
            "моложе 12 месяцев или нет даты регистрации": O.zapis(2, reg_date="2026-03-01"),
            "не ООО/АО (НКО, учреждения — вне волны)": O.zapis(3, name='АНО "ОБРАЗЕЦ"'),
            "нет финансов (доход > 0 по ФНС / ГИР БО)": O.zapis(4, dohod=None),
            "отметка о недостоверности — ждёт формулировки Юриста (V17)": O.zapis(5, nedost="warn"),
        }
        for pr, r in sluchai.items():
            k = K.iz_check(r)
            self.assertEqual(K.vorota(k)[1], pr)

    def test_bez_daty_svedenij_ne_proverka(self):
        r = O.zapis(6)
        for s in r["signals"]:
            s["as_of"] = ""
        r["checked_at"] = "2026-09-29T10:00:00+03:00"
        k = K.iz_check(r)
        ok, pr = K.vorota(k)
        self.assertFalse(ok, "без дат сведений ФНС карточка не должна проходить: " + pr)

    def test_menshe_treh_vyvodov_net_stranicy(self):
        r = O.zapis(7, shtat=1, dohod=0)
        r["signals"] = [s for s in r["signals"] if "Долги" not in s["title"] and "Уплач" not in s["title"]]
        d, kart, o = sobrat([r])
        self.assertEqual(kart, [])
        self.assertFalse(pathlib.Path(d, "sitemap-companies.xml").exists())
        self.assertNotIn("sitemap-companies", pathlib.Path(d, "robots.txt").read_text(encoding="utf-8"))

    def test_gruppy_i_kvoty(self):
        z = [O.zapis(i, dohod=(20e6 if i < 6 else 2e6), shtat=(8 if i < 6 else 2), reg_date="2024-01-10") for i in range(10)]
        _, kart, o = sobrat(z, spros=4, kontrol=2)
        self.assertEqual((o["spros"], o["kontrol"]), (4, 2))
        self.assertEqual([k["_gr"] for k in kart], ["spros"] * 4 + ["kontrol"] * 2)

    def test_stupen_ogranichivaet(self):
        _, kart, o = sobrat(O.nabor(30), limit=10)
        self.assertEqual(len(kart), 10)
        self.assertEqual(o["proshli"], 30)


class TestStranica(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.pop("PERSONS_PUBLIC", None)
        cls.d, cls.kart, cls.o = sobrat(O.nabor(30))
        cls.html = {p: p.read_text(encoding="utf-8") for p in stranicy(cls.d)}

    def test_seo_meta(self):
        for p, t in self.html.items():
            ti = re.search(r"<title>(.*?)</title>", t).group(1)
            ti = ti.replace("&quot;", '"').replace("&amp;", "&")
            self.assertLessEqual(len(ti), 70, ti)
            self.assertEqual(ti.count("«"), ti.count("»"), "кавычки непарные: " + ti)
            de = re.search(r'<meta name="description" content="([^"]*)"', t).group(1)
            self.assertLessEqual(len(de.replace("&quot;", '"').replace("&amp;", "&")), 160)
            self.assertNotIn("noindex", t)
            kan = re.search(r'<link rel="canonical" href="([^"]+)"', t).group(1)
            self.assertTrue(kan.endswith("/company/" + p.parent.name + "/"), kan)

    def test_json_ld_bez_rejtinga_i_lyudej(self):
        for t in self.html.values():
            ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', t, re.S).group(1))
            s = json.dumps(ld, ensure_ascii=False)
            self.assertNotIn("aggregateRating", s)
            self.assertNotIn("founder", s)
            self.assertIn('"taxID"', s)

    def test_lyudi_vyklyucheny_po_umolchaniyu(self):
        for t in self.html.values():
            self.assertNotIn("Примеров", t)
            self.assertNotIn("Руководство и владельцы", t)

    def test_lyudi_s_flagom(self):
        os.environ["PERSONS_PUBLIC"] = "1"
        try:
            d, _, _ = sobrat(O.nabor(3))
            t = stranicy(d)[0].read_text(encoding="utf-8")
            self.assertIn("Руководство и владельцы", t)
        finally:
            os.environ.pop("PERSONS_PUBLIC", None)

    def test_net_telefonov_i_pochty_kompanii(self):
        for t in self.html.values():
            self.assertNotRegex(t, r"\+7[\s(]?\d{3}")
            self.assertEqual(set(re.findall(r"mailto:([^\"?]+)", t)), {"help@deloskop.ru"})

    def test_indeks_tolko_za_vorotami(self):
        for t in self.html.values():
            self.assertIn("Индекс" + NB + "— считаем", t)
        k = K.iz_check(O.zapis(1, indeks={"ball": 74, "polnota": 65}))
        self.assertEqual(K.indeks_vid(k)["rezhim"], "chislo")
        self.assertIn("Индекс 74", K.title(k))
        for plohoe in ({"ball": 74, "polnota": 59}, {"ball": 74.5, "polnota": 80}, {"ball": 74, "polnota": 80, "status": "schitaem"}, 74):
            k = K.iz_check(O.zapis(1, indeks=plohoe))
            self.assertEqual(K.indeks_vid(k)["rezhim"], "schitaem", plohoe)

    def test_istochnik_i_data_u_kazhdogo_vyvoda(self):
        for k in self.kart:
            self.assertGreaterEqual(len(k["_V"]), 3)
            for v in k["_V"]:
                self.assertTrue(v["istochnik"] and v["data"], v)
                self.assertNotRegex(v["tekst"], K.STOP_SLOVA)
            self.assertLessEqual(max(sum(1 for v in k["_V"] if v["istochnik"] == i) for i in {v["istochnik"] for v in k["_V"]}), 2)

    def test_ne_proveryali_ne_znachit_net(self):
        for t in self.html.values():
            m = re.search(r'<div class="co-np">.*?</ul>', t, re.S)
            self.assertTrue(m)
            for li in re.findall(r"<li>(.*?)</li>", m.group(0)):
                self.assertNotRegex(li, K.NE_PROVERYALI_ZAPRET, li)

    def test_pohozhie_tolko_iz_volny_bez_sebya(self):
        adresa = {K.adres_str(k) for k in self.kart}
        for p, t in self.html.items():
            sos = re.search(r'<ul class="co-sos">(.*?)</ul>', t, re.S)
            self.assertTrue(sos)
            ss = re.findall(r'href="([^"]+)"', sos.group(1))
            self.assertLessEqual(len(ss), 6)
            self.assertNotIn("/company/" + p.parent.name + "/", ss)
            for a in ss:
                self.assertIn(a, adresa)

    def test_sitemap_i_lastmod(self):
        sm = pathlib.Path(self.d, "sitemap-companies.xml").read_text(encoding="utf-8")
        self.assertEqual(sm.count("<url>"), len(self.kart) + 1)  # + хаб (≥ 20 карточек)
        self.assertIn("<loc>https://deloskop.ru/company/</loc>", sm)
        self.assertNotIn("2026-09-30", sm)
        self.assertIn("Sitemap: https://deloskop.ru/sitemap-companies.xml", pathlib.Path(self.d, "robots.txt").read_text(encoding="utf-8"))

    def test_hab_noindex_malo_kartochek(self):
        d, kart, _ = sobrat(O.nabor(5))
        hub = pathlib.Path(d, "company", "index.html").read_text(encoding="utf-8")
        self.assertIn('content="noindex, follow"', hub)
        self.assertNotIn("<loc>https://deloskop.ru/company/</loc>", pathlib.Path(d, "sitemap-companies.xml").read_text(encoding="utf-8"))

    def test_determinirovano_i_chistka(self):
        d, _, o1 = sobrat(O.nabor(12))
        _, o2 = K.sobrat(O.nabor(12), d)
        self.assertEqual(o2["izmeneno_stranic"], 0, "повторная сборка тех же данных меняет страницы")
        _, o3 = K.sobrat(O.nabor(12)[:5], d)
        self.assertEqual(len(stranicy(d)), 5, "карточки, выпавшие из волны, должны удаляться")


class TestPasportNaKartochke(unittest.TestCase):
    """karta-v1.1: ссылка «Собрать Паспорт» по ИНН и знаки ● ◆ ○ как в Паспорте контрагента."""

    def test_ssylka_na_pasport_po_inn(self):
        k = K.iz_check(O.zapis(3))
        t = K.html_kartochki(k, K.vyvody(k), [])
        self.assertIn('href="/pasport/kontragent/?inn=%s" rel="nofollow"' % k["inn"], t)
        self.assertEqual(t.count("/pasport/kontragent/?inn="), 1)
        self.assertNotIn("?id=", t, "номер досье на карточку не попадает")

    def test_znaki_kak_v_pasporte(self):
        self.assertEqual(K.STATUS_METKA["rasschitano"], "◆ рассчитано Делоскопом")
        self.assertNotIn("◐", "".join(K.STATUS_METKA.values()))


class TestChestnostKarta2(unittest.TestCase):
    """karta-v2: карточка не обещает непроверяемое (Ф6) и не выдаёт пустое поле за проверку (Ф7)."""

    @staticmethod
    def html_s(**sig):
        r = O.zapis(4)
        if sig:
            r["signals"].append(dict({"title": "Дисквалификация руководителя", "detail": "не обнаружена", "as_of": "2026-09-29"}, **sig))
        k = K.iz_check(r)
        return K.html_kartochki(k, K.vyvody(k), [])

    @staticmethod
    def stroka_diskval(t):
        m = re.search(r'<div class="fact"><span>Дисквалификация[^<]*</span>.*?</div>', t, re.S)
        return m.group(0) if m else ""

    def test_polnyj_otchet_ne_obeshchaet_nepodklyuchennoe(self):
        t = self.html_s()
        for blok in re.findall(r'<aside class="co-side card"[^>]*>(?:(?!</aside>).)*?</aside>', t, re.S):
            if "Похожие компании" in blok:
                continue
            tekst = re.sub(r"<[^>]+>", " ", blok)
            self.assertNotRegex(tekst, K.NE_OBESHCHAEM, tekst)
        self.assertIn("что проверить самим", t)

    def test_diskval_iz_dadata_ne_proverka(self):
        s = self.stroka_diskval(self.html_s(status="ok", source="DaData, ЕГРЮЛ"))
        self.assertTrue(s, "строка дисквалификации пропала")
        self.assertIn("не проверяли", s)
        self.assertNotIn("подтверждено", s)
        self.assertNotIn("не обнаружена", s)
        self.assertIn("Реестр дисквалифицированных лиц ФНС — подключаем", s)
        self.assertNotIn("дата сведений", s)

    def test_diskval_bez_daty_ne_proverka(self):
        s = self.stroka_diskval(self.html_s(status="bad", source="ЕГРЮЛ", as_of=""))
        self.assertIn("не проверяли", s)

    def test_diskval_najdennaya_otmetka_ostaetsya(self):
        s = self.stroka_diskval(self.html_s(status="bad", detail="до 12.03.2027", source="ЕГРЮЛ"))
        self.assertIn("● подтверждено источником", s)
        self.assertIn("до 12.03.2027", s)

    def test_diskval_iz_reestra_fns_proverka(self):
        s = self.stroka_diskval(self.html_s(status="ok", source="ФНС, реестр дисквалифицированных лиц", as_of="2026-09-27"))
        self.assertIn("● подтверждено источником", s)
        self.assertIn("не обнаружена", s)


class TestMelochi(unittest.TestCase):
    def test_imya(self):
        self.assertEqual(K.imya('ООО "ТД "ЧЕРНОЗЕМЬЕ"'), "ООО «ТД Черноземье»")
        self.assertEqual(K.imya('ООО "АЛЬФА-ТРЕЙД"'), "ООО «Альфа-Трейд»")
        self.assertEqual(K.imya("ООО «Ромашка»"), "ООО «Ромашка»")

    def test_dlinnyj_title(self):
        k = K.iz_check(O.zapis(1, name='ООО "НАУЧНО-ПРОИЗВОДСТВЕННОЕ ОБЪЕДИНЕНИЕ СТРОИТЕЛЬНЫХ И ДОРОЖНЫХ ТЕХНОЛОГИЙ ЧЕРНОЗЕМЬЯ"'))
        t = K.title(k)
        self.assertLessEqual(len(t), 70, t)
        self.assertEqual(t.count("«"), t.count("»"), t)

    def test_slug(self):
        self.assertEqual(K.slug("ООО «Счёт-Щит Южный»"), "schet-schit-yuzhnyj")

    def test_inn(self):
        self.assertTrue(K.inn_ok("7707083893"))
        self.assertFalse(K.inn_ok("7707083894"))
        self.assertFalse(K.inn_ok("500100732259"))

    def test_dengi(self):
        self.assertEqual(K.dengi(48_300_000), "48,3" + NB + "млн" + NB + "₽")
        self.assertEqual(K.dengi(412_000), "412" + NB + "тыс." + NB + "₽")

    def test_region(self):
        self.assertEqual(K.region_gorod("398000, Липецкая обл, г Липецк, ул Ленина, д 1"), ("Липецкая область", "Липецк"))
        self.assertEqual(K.region_gorod("г Москва, ул Тверская, д 1"), ("Москва", "Москва"))


class TestObshchijRender(unittest.TestCase):
    """render-v1: одна отрисовка для сайта (статичные файлы) и API (/company/ через nginx со ступени 2)."""

    def test_modul_chistyj(self):
        # только стандартная библиотека, без файлов, сети и модулей сайта — API подключает его как есть
        import ast
        src = (KOREN / "tests" / "kartochka_render.py").read_text(encoding="utf-8")
        t = ast.parse(src)
        imp = set()
        for n in ast.walk(t):
            if isinstance(n, ast.Import):
                imp |= {a.name for a in n.names}
            elif isinstance(n, ast.ImportFrom):
                imp.add(n.module)
        self.assertLessEqual(imp, {"datetime", "html", "json", "math", "os", "re", "urllib.parse"}, imp)
        vyzovy = {n.func.id if isinstance(n.func, ast.Name) else n.func.attr for n in ast.walk(t) if isinstance(n, ast.Call)}
        for zapret in ("open", "urlopen", "remove", "rmtree", "makedirs", "system", "run"):
            self.assertNotIn(zapret, vyzovy, zapret)
        self.assertNotRegex(src, r"fonts\.(googleapis|gstatic)")

    def test_odin_render(self):
        import kartochka_render as R
        for imya_ in ("html_kartochki", "html_haba", "vorota", "vyvody", "iz_check", "adres_str", "persons_public"):
            self.assertIs(getattr(K, imya_), getattr(R, imya_), imya_)

    def test_api_ravno_fajlu_sajta(self):
        # страница из API после той же оболочки (шапка, подвал, бета) = файл статичной волны, байт в байт
        import kartochka_render as R
        import sobrat_shapku as ss
        os.environ.pop("PERSONS_PUBLIC", None)
        zap = O.nabor(12)
        d, kart, _ = sobrat(zap)
        r = ss.rekv_sajta()
        podval, shapka = ss.podval_html(r), ss.shapka_html()
        pervye = {}
        for z in zap:
            ok, pr, adres, telo = R.kartochka_iz_check(z, kart)
            self.assertTrue(ok, pr)
            pervye[adres] = ss.sobrat_stranicu(telo, r, podval, shapka)
        self.assertEqual(len(pervye), len(kart))
        for adres, txt in pervye.items():
            fajl = pathlib.Path(d, adres.strip("/"), "index.html").read_text(encoding="utf-8")
            self.assertEqual(txt, fajl, adres)

    def test_api_ip_i_vorota(self):
        import kartochka_render as R
        ip = O.zapis(1, inn="500100732259", kind="INDIVIDUAL", name="ИП Примеров Иван Петрович")
        self.assertEqual(R.kartochka_iz_check(ip)[0::2], (False, None))
        self.assertIsNone(R.kartochka_iz_check(ip)[3])
        ok, pr, adres, telo = R.kartochka_iz_check(O.zapis(2, status="LIQUIDATED"))
        self.assertEqual((ok, adres, telo), (False, None, None))
        self.assertIn("действующая", pr)

    def test_api_bez_lyudej_po_umolchaniyu(self):
        import kartochka_render as R
        os.environ.pop("PERSONS_PUBLIC", None)
        telo = R.kartochka_iz_check(O.zapis(3))[3]
        self.assertIn("<!--shapka--><!--/shapka-->", telo)
        self.assertNotIn("Примеров", telo)


class TestObolochka(unittest.TestCase):
    """obolochka-v1: API надевает на карточку шапку, подвал и бету из partials/obolochka.json — байт в байт как сайт."""

    def _ss(self):
        import sobrat_shapku as ss
        return ss

    def test_ravno_sobrat_stranicu_beta_i_bez(self):
        import kartochka_render as R
        ss = self._ss()
        os.environ.pop("PERSONS_PUBLIC", None)
        zap = O.nabor(8)
        kart = [K.iz_check(z) for z in zap]
        for beta in (True, False):
            r = ss.rekv_sajta()
            r["_beta"] = beta
            if not beta:
                r["_est"] = False  # реквизиты ИП в карточку не идут ни в каком режиме — проверяем только оболочку
            podval, shapka = ss.podval_html(r), ss.shapka_html()
            ob = json.loads(ss.obolochka(r, podval, shapka))
            self.assertEqual(ob["beta"], beta)
            for z in zap:
                ok, pr, adres, telo = R.kartochka_iz_check(z, kart)
                if not ok:
                    continue
                self.assertEqual(R.nadet_obolochku(telo, ob), ss.sobrat_stranicu(telo, r, podval, shapka), (beta, adres))

    def test_fajl_svezhij(self):
        # partials/obolochka.json собран из текущих шапки, подвала, беты и модуля отрисовки (иначе — sobrat_shapku.py)
        ss = self._ss()
        r = ss.rekv_sajta()
        fajl = (KOREN / "partials" / "obolochka.json").read_text(encoding="utf-8")
        self.assertEqual(fajl, ss.obolochka(r, ss.podval_html(r), ss.shapka_html()))
        ob = json.loads(fajl)
        self.assertEqual(set(ob), {"versiya", "beta", "render", "head", "shapka", "podval"})
        self.assertRegex(ob["render"], r"^[0-9a-f]{16}$")
        self.assertNotRegex(fajl, r"fonts\.(googleapis|gstatic)")
        self.assertIn('<a class="skip" href="#main">', ob["shapka"])
        self.assertTrue(ob["podval"].startswith("<!--podval-->"))

    def test_bez_metki_none(self):
        import kartochka_render as R
        ob = {"head": "", "shapka": "", "podval": ""}
        self.assertIsNone(R.nadet_obolochku(None, ob))
        self.assertIsNone(R.nadet_obolochku("<html><head></head><body></body></html>", ob))


if __name__ == "__main__":
    unittest.main(verbosity=1)
