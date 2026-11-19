#!/usr/bin/env python3
"""dostovernost-v1 (аудит 19.11, п. 22 (а)): методика /indeks/ и сайт говорят о источниках то же, что реестр
data/istochniki.json и код отчёта. python3 tests/test_indeks_istochniki.py"""
import json
import pathlib
import re
import subprocess
import sys
import unittest

KOREN = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KOREN / 'tests'))
import sobrat_indeks_istochniki as S  # noqa: E402

REESTR = json.loads((KOREN / 'data' / 'istochniki.json').read_text(encoding='utf8'))
# как сайт называет источник в тексте
IMENA = {'kad': r'арбитраж|картотек', 'fssp': r'пристав|ФССП|исполнительн', 'efrsb': r'банкрот|ЕФРСБ|Федресурс'}
PROPUSK = ('tests', 'node_modules', 'сайт', '.git', 'b')  # js/b — пакеты из исходников js/


def tekst(s):
    s = re.sub(r'<script[^>]*type="application/(?:ld\+)?json"[^>]*>.*?</script>', ' ', s, flags=re.S)
    s = re.sub(r'<[^>]+>', ' ', s)
    return s.replace('&nbsp;', ' ').replace(' ', ' ').replace('\\u00a0', ' ')


class TestIndeksIstochniki(unittest.TestCase):
    def test_stroka_gruppy_iz_reestra(self):
        r = subprocess.run([sys.executable, str(KOREN / 'tests' / 'sobrat_indeks_istochniki.py'), '--check'], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_net_ne_podklyuchili_u_podklyuchennyh_v_gruppe(self):
        h = (KOREN / 'indeks' / 'index.html').read_text(encoding='utf8')
        m = re.search(r'<!--ist-gruppa-->(.*?)<!--/ist-gruppa-->', h, re.S)
        t = tekst(m.group(1))
        for s in REESTR['istochniki']:
            if s.get('metodika') in ('sudy', 'fssp', 'fedresurs') and s['sostoyanie'] == 'podklyuchen':
                self.assertIn(s['nazvanie'], t.split(' подключены')[0], s['id'])
        self.assertNotIn('не подключили', t)

    def test_faktory_v_balle_kak_v_kode_otcheta(self):
        """faktory_v_balle в реестре = факторы группы «Суды и долги», которые js/indeks-otvet.js действительно ставит"""
        js = (KOREN / 'js' / 'indeks-otvet.js').read_text(encoding='utf8')
        stavit = set(re.findall(r'fakty\.(\w+) = true', js))
        M = S.metodika((KOREN / 'indeks' / 'index.html').read_text(encoding='utf8'))
        po_ist = {}
        for f in M['faktory']:
            if f['gruppa'] == S.GRUPPA:
                po_ist.setdefault(f['istochnik'], set())
                if f['id'] in stavit:
                    po_ist[f['istochnik']].add(f['id'])
        for s in REESTR['istochniki']:
            if s.get('metodika') in po_ist:
                self.assertEqual(set(s.get('faktory_v_balle') or []), po_ist[s['metodika']], s['id'])
                self.assertEqual(s['v_indekse'], bool(po_ist[s['metodika']]), s['id'] + ': v_indekse')

    def test_na_sajte_net_ne_podklyuchili_u_podklyuchennyh(self):
        """ни на одной странице и ни в одном модуле — «не подключили / не подключён» рядом с подключённым источником"""
        podkl = [k for k, v in IMENA.items() if any(s['id'] == k and s['sostoyanie'] == 'podklyuchen' for s in REESTR['istochniki'])]
        oshibki = []
        for f in KOREN.rglob('*'):
            if f.suffix not in ('.html', '.js') or any(p in PROPUSK for p in f.relative_to(KOREN).parts[:-1]):
                continue
            if f.name.startswith('obnovleniya'):
                continue  # лента — журнал: цитирует, что было
            t = f.read_text(encoding='utf8', errors='ignore')
            if f.suffix == '.js':  # в модулях — только строки, которые увидит человек (комментарии и регулярки не в счёт)
                t = re.sub(r'/\*.*?\*/', ' ', t, flags=re.S)
                t = re.sub(r'(?m)^\s*//.*$|\s//\s.*$', ' ', t)
                t = re.sub(r"'\s*\+\s*NB\s*\+\s*'", ' ', t)
                t = '. '.join(re.findall(r"'((?:[^'\\\n]|\\.)*)'", t))
            t = tekst(t)
            for pred in re.split(r'(?<=[.!?])\s+', t):
                if not re.search(r'не\s?подключ(или|ён|ены|ен)\b', pred):
                    continue
                for k in podkl:
                    if re.search(IMENA[k], pred, re.I):
                        oshibki.append(f'{f.relative_to(KOREN)}: {k}: {pred.strip()[:160]}')
        self.assertEqual(oshibki, [], '\n'.join(oshibki))


if __name__ == '__main__':
    unittest.main()
