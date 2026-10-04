#!/usr/bin/env python3
"""kartochki-vybor-v1 (Ночные-2, 04.10): отбор ИНН из набора ФНС revexp, отсев отказов ворот, iz-api не спрашивает
опубликованные. Только вымышленные наборы во временной папке; сеть и сайт не трогает.
Запуск: python3 tests/test_kartochki_vybor.py"""
import datetime as dt
import io
import json
import os
import pathlib
import sys
import tempfile
import unittest
import zipfile
from contextlib import redirect_stdout
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402
import kartochki_obrazec as O  # noqa: E402
import kartochki_vybor as kv  # noqa: E402

D = dt.date(2026, 10, 4)


def inn_s_summoj(prefiks8):
    """8 цифр + 9-я подбором → верный ИНН юрлица (10-я — контрольная)."""
    for d9 in "0123456789":
        s = prefiks8 + d9
        k = sum(int(a) * b for a, b in zip(s, kv._VES)) % 11 % 10
        return s + str(k)


def xml_revexp(stroki, s_ns=False):
    ns = ' xmlns="urn:x"' if s_ns else ""
    docs = "".join('<Документ ИдДок="%d" ДатаДок="25.09.2026" ДатаСост="31.12.2025"><СведНП НаимОрг="ООО" ИННЮЛ="%s"/>'
                   '<СведДохРасх СумДоход="%s" СумРасход="1.00"/></Документ>' % (i, inn, doh) for i, (inn, doh) in enumerate(stroki))
    return ('<?xml version="1.0" encoding="utf-8"?><Файл ИдФайл="x" ВерсФорм="4.01"%s>%s</Файл>' % (ns, docs)).encode("utf-8")


class TestRevexp(unittest.TestCase):
    def test_zip_iz_neskolkih_xml_i_otbros(self):
        a, b, c = inn_s_summoj("48250000"), inn_s_summoj("77070000"), inn_s_summoj("66000000")
        plohoj = a[:9] + str((int(a[9]) + 1) % 10)
        d = tempfile.mkdtemp()
        z = os.path.join(d, "revexp.zip")
        with zipfile.ZipFile(z, "w") as zf:
            zf.writestr("VO_1.xml", xml_revexp([(a, "150000000.00"), (plohoj, "9e9"), ("500100732259", "9e9")]))
            zf.writestr("VO_2.xml", xml_revexp([(b, "70000000"), (c, "3000000000.5")], s_ns=True))
            zf.writestr("readme.txt", "не xml")
        self.assertEqual(kv.chitat_revexp(z), {a: 150e6, b: 70e6, c: 3000000000.5})

    def test_odin_xml_i_pustoj(self):
        a = inn_s_summoj("48250001")
        d = tempfile.mkdtemp()
        x = os.path.join(d, "v.xml")
        pathlib.Path(x).write_bytes(xml_revexp([(a, "61000000")]))
        self.assertEqual(kv.chitat_revexp(x), {a: 61e6})
        pathlib.Path(x).write_bytes('<Файл><Документ><Другое ИНН="1"/></Документ></Файл>'.encode("utf-8"))
        self.assertEqual(kv.chitat_revexp(x), {})
        with redirect_stdout(io.StringIO()) as out, mock.patch.object(kv, "ne_sprashivat", return_value=(set(), set())):
            self.assertEqual(kv.main_vybor(["vybor", "--revexp", x], K._arg, D), 1)
        self.assertIn("0 ИНН в наборе", out.getvalue())


class TestVybrat(unittest.TestCase):
    def nabor(self):
        d = {}
        for i in range(40):
            d[inn_s_summoj("48%06d" % i)] = 100e6 + i * 1e6       # Липецкая
            d[inn_s_summoj("50%06d" % i)] = 200e6 + i * 1e6       # ЦФО
            d[inn_s_summoj("66%06d" % i)] = 300e6 + i * 1e6       # другие
        d[inn_s_summoj("66999990")] = 59e6                         # ниже порога
        d[inn_s_summoj("66999991")] = 51e9                         # выше порога (часто закрытая отчётность)
        return d

    def test_kvoty_poryadok_granicy(self):
        d = self.nabor()
        sp = kv.vybrat(d, n=20)
        self.assertEqual(len(sp), 20)
        po = {k: sum(1 for i in sp if kv.kvota_inn(i) == k) for k, _ in kv.KVOTY}
        self.assertEqual(po, {"lipeck": 3, "cfo": 7, "drugie": 10})
        self.assertEqual(sp, sorted(sp, key=lambda i: -d[i]), "запросы — крупные первыми")
        self.assertNotIn(inn_s_summoj("66999990"), sp)
        self.assertNotIn(inn_s_summoj("66999991"), sp)
        # в каждой квоте — самые крупные
        self.assertIn(inn_s_summoj("48000039"), sp)
        self.assertNotIn(inn_s_summoj("48000036"), sp)
        self.assertEqual(sp, kv.vybrat(dict(reversed(list(d.items()))), n=20), "детерминированно")

    def test_nedobor_kvoty_i_isklyuchit(self):
        d = {inn_s_summoj("66%06d" % i): 300e6 + i for i in range(30)}
        d[inn_s_summoj("48000001")] = 100e6
        sp = kv.vybrat(d, n=10)
        self.assertEqual(len(sp), 10, "Липецкой и ЦФО мало — добор из других")
        self.assertIn(inn_s_summoj("48000001"), sp)
        iskl = set(sp[:3])
        sp2 = kv.vybrat(d, n=10, isklyuchit=iskl)
        self.assertFalse(iskl & set(sp2))
        self.assertEqual(len(kv.vybrat(d, n=10 ** 6)), 31, "потолок n и размер набора")
        self.assertLessEqual(kv.VYBOR_N_MAKS, 2000)

    def test_main_pishet_spisok_bez_opublikovannyh(self):
        d = self.nabor()
        t = tempfile.mkdtemp()
        x = os.path.join(t, "v.xml")
        pathlib.Path(x).write_bytes(xml_revexp([(i, "%.2f" % v) for i, v in d.items()]))
        top = max(d, key=lambda i: d[i] if d[i] <= 50e9 else 0)
        vyh = os.path.join(t, "sp.txt")
        with redirect_stdout(io.StringIO()) as out, mock.patch.object(kv, "ne_sprashivat", return_value=({top}, set())):
            self.assertEqual(kv.main_vybor(["vybor", "--revexp", x, "--n", "10", "--vyhod", vyh], K._arg, D), 0)
        sp = pathlib.Path(vyh).read_text(encoding="utf-8").split()
        self.assertEqual(len(sp), 10)
        self.assertNotIn(top, sp)
        self.assertIn("выбрано: 10", out.getvalue())


class TestOtsev(unittest.TestCase):
    def test_fajl_v_repozitorii(self):
        o = kv.chitat_otsev()
        self.assertTrue(o, "tests/kartochki_otsev.txt пуст")
        tekst = pathlib.Path(kv.OTSEV).read_text(encoding="utf-8")
        for s in tekst.splitlines():
            if s.startswith("#"):
                continue
            inn, data, pr = [x.strip() for x in s.split("·", 2)]
            self.assertTrue(kv.inn_yul_ok(inn), s)          # только юрлица; ИП — никогда
            dt.date.fromisoformat(data)
            self.assertTrue(pr)
        self.assertNotRegex(tekst, r"(?i)ооо|пао|ао «|руковод|директор|@|\+7")  # без названий и людей

    def test_srok(self):
        a = inn_s_summoj("77000001")
        o = {a: (dt.date(2026, 7, 7), "нет финансов")}
        self.assertEqual(kv.otsev_dejstvuet(o, dt.date(2026, 10, 4)), {a})       # 89 дней
        self.assertEqual(kv.otsev_dejstvuet(o, dt.date(2026, 10, 5)), set())     # 90 — спросим снова
        self.assertEqual(kv.otsev_dejstvuet(o, dt.date(2026, 7, 1)), set())      # дата из будущего — не верим

    def test_otsev_iz_otvetov_i_zapis(self):
        ok = O.zapis(1)
        bez_fin = O.zapis(2, dohod=None)
        ip = O.zapis(3, inn="500100732259", kind="INDIVIDUAL", name="ИП Примеров Иван Петрович", dohod=None)
        t = tempfile.mkdtemp()
        vhod = os.path.join(t, "x.jsonl")
        put = os.path.join(t, "otsev.txt")
        pathlib.Path(put).write_text("# шапка\n%s · 2026-09-01 · старая причина\n" % ok["company"]["inn"], encoding="utf-8")
        pathlib.Path(vhod).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in (ok, bez_fin, ip)), encoding="utf-8")
        novye, vsego = K.otsev(vhod, D, put)
        self.assertEqual(set(novye), {bez_fin["company"]["inn"]})
        self.assertEqual(vsego, 1, "прошедший ворота ИНН из отсева убран, ИП не записан")
        txt = pathlib.Path(put).read_text(encoding="utf-8")
        self.assertTrue(txt.startswith("# шапка\n"))
        self.assertIn("%s · 2026-10-04 · ворота публикации: нет финансов" % bez_fin["company"]["inn"], txt)
        self.assertNotIn("500100732259", txt)
        K.otsev(vhod, D, put)
        self.assertEqual(pathlib.Path(put).read_text(encoding="utf-8"), txt, "повторный прогон ничего не меняет")


class TestIzApiPropuskaet(unittest.TestCase):
    def test_opublikovannye_i_otsev_ne_sprashivaem(self):
        opub = sorted(kv.opublikovannye())
        self.assertTrue(opub, "на сайте нет карточек /company/<ИНН>-…")
        otsev = sorted(kv.otsev_dejstvuet(kv.chitat_otsev(), D))
        nov = inn_s_summoj("48777777")
        t = tempfile.mkdtemp()
        sp = os.path.join(t, "sp.txt")
        pathlib.Path(sp).write_text("\n".join([opub[0], otsev[0] if otsev else nov, nov]) + "\n", encoding="utf-8")
        zvali = []

        def ne_v_set(req, timeout=0):
            zvali.append(req.full_url)
            raise K.urllib.error.HTTPError(req.full_url, 429, "x", {}, None)

        with mock.patch.object(K, "segodnya_msk", return_value=D), mock.patch.object(K.urllib.request, "urlopen", ne_v_set), \
                mock.patch.object(K.time, "sleep", lambda s: None), redirect_stdout(io.StringIO()) as out:
            K.iz_api(sp, os.path.join(t, "x.jsonl"), pauza=0)
        self.assertEqual(zvali, ["https://api.deloskop.ru/api/check?q=" + nov])
        self.assertIn("уже на сайте 1", out.getvalue())
        zvali.clear()
        with mock.patch.object(K, "segodnya_msk", return_value=D), mock.patch.object(K.urllib.request, "urlopen", ne_v_set), \
                mock.patch.object(K.time, "sleep", lambda s: None), redirect_stdout(io.StringIO()):
            K.iz_api(sp, os.path.join(t, "x.jsonl"), pauza=0, zanovo=True)
        self.assertEqual(len(zvali), 1, "429 на первом — стоп")
        self.assertIn(opub[0], zvali[0])

    def test_haby_ne_kartochki(self):
        t = tempfile.mkdtemp()
        for p in ("company/7736050003-gazprom", "company/otrasl/torgovlya", "company/stranica/2", "company/1234567890-bez-fajla"):
            os.makedirs(os.path.join(t, p))
        for p in ("company/7736050003-gazprom", "company/otrasl/torgovlya", "company/stranica/2"):
            pathlib.Path(t, p, "index.html").write_text("x", encoding="utf-8")
        self.assertEqual(kv.opublikovannye(t), {"7736050003"})


if __name__ == "__main__":
    unittest.main(verbosity=1)
