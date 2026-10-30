#!/usr/bin/env python3
"""kommentarii-signal-id-v1 ([Ночные-2] 30.10): Python-копия правила «Комментария команды» (tests/kartochka_render.py,
kom_zapis) ищет запись сначала по коду признака (signal_id / rule_id / однозначный id ответа /api/check), как
js/kommentarii.js. Сверка с JS через node — на одном наборе признаков. Запуск: python3 tests/test_kommentarii_signal_id.py"""
import json
import pathlib
import subprocess
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochka_render as R  # noqa: E402

KOREN = pathlib.Path(__file__).resolve().parent.parent
SPRAV = json.loads((KOREN / "data" / "kommentarii.json").read_text(encoding="utf-8"))
NABOR = [
    {"id": "tax_debt", "title": "Сумма к уплате в бюджет", "status": "bad", "detail": "120 000 ₽"},
    {"id": "tax_debt", "title": "Задолженность по налогам", "status": "ok", "detail": "Нет"},
    {"id": "employees", "title": "Работники", "status": "warn", "detail": "0"},
    {"id": "employees", "title": "Сотрудники", "status": "ok", "detail": "25"},
    {"id": "age", "title": "Дата создания", "status": "warn", "detail": "5 мес"},
    {"id": "age", "title": "Возраст компании", "status": "ok", "detail": "11 лет"},
    {"id": "mass_address", "title": "Адрес у многих", "status": "warn", "detail": "11 компаний"},
    {"id": "fssp", "title": "Взыскания", "status": "warn", "detail": "3 производства"},
    {"id": "status", "title": "Статус", "status": "bad", "detail": "В процессе ликвидации"},
    {"id": "address", "title": "Адрес", "status": "warn", "detail": "Есть отметка о недостоверности"},
    {"signal_id": "novyj_kod", "title": "Задолженность по налогам", "status": "bad", "detail": ""},
    {"rule_id": "shtrafy", "title": "Санкции налоговой", "status": "warn", "detail": "1"},
    {"title": "Компания в процессе ликвидации", "status": "bad", "detail": ""},
    {"id": "constructor", "title": "Новый признак", "status": "warn", "detail": ""},
]


class TestKod(unittest.TestCase):
    def test_vosproizvedenie(self):
        nov = NABOR[0]
        bez = {k: v for k, v in nov.items() if k != "id"}
        self.assertIsNone(R.kom_zapis(SPRAV, bez), "по одному заголовку записи нет — так было на main")
        self.assertEqual(R.kom_najti(SPRAV, nov),
                         R.kom_najti(SPRAV, dict(nov, title="Задолженность по налогам")))

    def test_kak_v_js(self):
        js = ("const K=require('./js/kommentarii.js');const S=require('./data/kommentarii.json');"
              "const N=JSON.parse(process.argv[1]);"
              "process.stdout.write(JSON.stringify(N.map(s=>{const z=K.zapis(S,s);return z?z.id:null;})))")
        out = subprocess.run(["node", "-e", js, json.dumps(NABOR, ensure_ascii=False)], cwd=KOREN,
                             capture_output=True, text=True, check=True).stdout
        py = [(R.kom_zapis(SPRAV, s) or {}).get("id") for s in NABOR]
        self.assertEqual(py, json.loads(out))
        self.assertEqual(py[:8], ["nedoimka", "nedoimka", "net_sotrudnikov", "shtat", "molodaya", "vozrast",
                                  "massovyj_adres", "fssp"])
        self.assertEqual(py[12], "likvidaciya")
        self.assertEqual(py[11], "shtrafy")

    def test_tablica_kak_v_js(self):
        out = subprocess.run(["node", "-e", "process.stdout.write(JSON.stringify(require('./js/kommentarii.js').IZ_API))"],
                             cwd=KOREN, capture_output=True, text=True, check=True).stdout
        self.assertEqual(R.KOM_IZ_API, json.loads(out))


if __name__ == "__main__":
    unittest.main(verbosity=1)
