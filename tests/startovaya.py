#!/usr/bin/env python3
"""Стартовая цена тарифа «Старт» — 390 ₽ вместо 490 ₽ (решение владельца 03.10.2026 ≈20:30,
claude/Решения_владельца_03.10_Старт_390_и_НДС-2027.md; тексты — [Право] 03.10.2026 21:10, разд. 1).

Данные — tarify/tarify.json → тариф "start" → поле "startovaya" (одной строкой):
    mesyac, god            — стартовая цена месяца и года (год — по публичному правилу: месяц × 12 × 0,8 вниз до сотни);
    pervaya_oplata_s / _do — окно первой оплаты (п. 3.9 (а) оферты);
    sohranyaetsya_mes      — сколько месяцев цена держится для продлений (п. 3.9 (б));
    vklyuchit              — включать ли вместе с оплатами (false — «Старт» остаётся по обычной цене);
    god_soglasovan         — «да» владельца на годовую цену (до него включение останавливается с понятной ошибкой);
    obychnaya, primenena   — пишет сборщик в момент включения: прежняя цена и дата.

Пока "beta": true — ничего не меняется. Когда "beta": false, vklyuchit = true и сегодня ≤ pervaya_oplata_do,
tests/sobrat_tarify.py ОДИН раз (переход) делает всё сразу:
  1) переписывает mesyac/god «Старта» в самом tarify.json — его читают страница, js/limit.js, js/schet.js и сервер счетов,
     значит, цена везде одна;
  2) на /tarify/ под ценой «Старта» — строка [Право] 1.1 со ссылкой на /oferta/#start;
  3) в оферту — п. 3.9 (#start, [Право] 1.2, вариант «да» по 1.3) и правка о счетах-фактурах ([Право] 1.4),
     новая дата редакции и dateModified.
Повторный запуск ничего не меняет (проверка сборщиков в CI). Обратно сам не откатывает: изменённую оферту
молча не переписываем — это решение человека.
После 28.12.2026 тест tests/test_startovaya.py краснеет, пока поле не снято или не продлено решением владельца
(цену «Старта» с 2027 года владелец решает по продлениям; продлевать «стартовую» новым сроком нельзя — ч. 7 ст. 5 38-ФЗ).
"""
import datetime
import json
import math
import os
import re

MES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
NB = ' '
SROK_RESHENIYA = datetime.date(2026, 12, 28)  # за 3 дня до конца окна — решить цену «Старта» с 2027 года

STROKA_TARIFY = ('Стартовая цена&nbsp;— при первой оплате до&nbsp;{do}. Сохраняется {mes}&nbsp;месяцев '
                 '(<a href="/oferta/#start">п.&nbsp;3.9 оферты</a>).')

PUNKT_OFERTY = ('<!--start--><li id="start"><strong>Стартовая цена тарифа «Старт».</strong>\n<ol class="bukvy">\n'
                '<li>(а)&nbsp;Пользователь, впервые оплативший тариф «Старт» (месяц или год) с&nbsp;{s} по&nbsp;{do} включительно, '
                'получает стартовую цену, указанную на&nbsp;странице <a href="/tarify/#t-start">«Тарифы»</a> на&nbsp;дату этой оплаты.</li>\n'
                '<li>(б)&nbsp;Стартовая цена сохраняется для продлений «Старта» в&nbsp;течение {mes}&nbsp;месяцев с&nbsp;даты первой оплаты, '
                'пока подписка непрерывна. Непрерывность&nbsp;— по&nbsp;правилу п.&nbsp;3.8 (г): оплата нового Периода поступила '
                'не&nbsp;позднее 10&nbsp;календарных дней после окончания текущего. Цена сохраняется и&nbsp;в&nbsp;случаях, указанных '
                'в&nbsp;п.&nbsp;6.4 и&nbsp;6.7. Если мы станем плательщиком НДС, стартовая цена будет включать налог.</li>\n'
                '<li>(в)&nbsp;По&nbsp;истечении {mes}&nbsp;месяцев продление&nbsp;— по&nbsp;цене «Старта» на&nbsp;странице «Тарифы» '
                'на&nbsp;дату продления. Если эта цена выше, мы сообщим о&nbsp;ней письмом не&nbsp;позднее чем за&nbsp;14&nbsp;дней (п.&nbsp;6.4).</li>\n'
                '<li>(г)&nbsp;Переход со&nbsp;«Старта» на&nbsp;другой тариф стартовую цену не&nbsp;сохраняет. Подписка прервана&nbsp;— '
                'стартовая цена не&nbsp;восстанавливается.</li>\n'
                '<li>(д)&nbsp;Право на&nbsp;стартовую цену принадлежит Пользователю (организации или ИП&nbsp;— по&nbsp;ИНН) '
                'и&nbsp;другому лицу не&nbsp;передаётся.</li>\n'
                '</ol></li><!--/start-->')

SF_STAROE = 'Счета-фактуры не&nbsp;выставляются.'
SF_STAROE2 = 'Счета-фактуры не выставляются.'
SF_NOVOE = 'Пока действует освобождение, счета-фактуры не&nbsp;выставляются.'


def data_ru(iso, god=True):
    d = datetime.date.fromisoformat(iso)
    return f'{d.day}{NB}{MES[d.month - 1]}' + (f' {d.year}{NB}года' if god else '')


def god_po_pravilu(mesyac, skidka=20):
    return int(math.floor(mesyac * 12 * (100 - skidka) / 100 / 100) * 100)


def start(D):
    return next(t for t in D['tarify'] if t['id'] == 'start')


def aktivna(D):
    """Стартовая цена уже действует (цены «Старта» в файле = стартовые)."""
    st = start(D).get('startovaya')
    return bool(st and st.get('primenena') and start(D)['mesyac'] == st['mesyac'])


def pora(D, segodnya=None):
    """Пора включить: бета закончилась, включение разрешено, окно первой оплаты не прошло, ещё не включена."""
    st = start(D).get('startovaya')
    if not st or D.get('beta') is not False or not st.get('vklyuchit') or aktivna(D):
        return False
    segodnya = segodnya or datetime.date.today()
    return segodnya <= datetime.date.fromisoformat(st['pervaya_oplata_do'])


def _zapisat_tarify(koren, D):
    """Точечно: строка цен «Старта» и строка startovaya — остальной файл байт в байт прежний."""
    p = os.path.join(koren, 'tarify', 'tarify.json')
    s = open(p, encoding='utf-8').read()
    i = s.index('"id": "start"')
    j = s.index('"chto"', i)
    blok = s[i:j]
    t = start(D)
    blok2, n = re.subn(r'"mesyac": \d+, "god": \d+,', f'"mesyac": {t["mesyac"]}, "god": {t["god"]},', blok, count=1)
    blok2, n2 = re.subn(r'"startovaya": \{.*?\},\n', lambda m: '"startovaya": ' + json.dumps(t['startovaya'], ensure_ascii=False) + ',\n', blok2, count=1)
    assert n == 1 and n2 == 1, 'tarify.json: не нашёл строку цен или startovaya у «Старта»'
    open(p, 'w', encoding='utf-8').write(s[:i] + blok2 + s[j:])


def _oferta(koren, st, segodnya):
    p = os.path.join(koren, 'oferta', 'index.html')
    s = open(p, encoding='utf-8').read()
    if '<li id="start">' in s:
        return False
    kon = '</ol></li>\n</ol>\n<h2 id="o4">'
    assert s.count(kon) == 1, 'оферта: не нашёл конец п. 3.8'
    punkt = PUNKT_OFERTY.format(s=data_ru(st['pervaya_oplata_s'], god=False), do=data_ru(st['pervaya_oplata_do']),
                                mes=st['sohranyaetsya_mes']).replace(NB, '&nbsp;')
    s = s.replace(kon, '</ol></li>\n' + punkt + '\n</ol>\n<h2 id="o4">', 1)
    if SF_STAROE in s:
        s = s.replace(SF_STAROE, SF_NOVOE, 1)
    elif SF_STAROE2 in s:
        s = s.replace(SF_STAROE2, SF_NOVOE, 1)
    else:
        raise AssertionError('оферта: не нашёл «Счета-фактуры не выставляются.»')
    iso = segodnya.isoformat()
    s, n = re.subn(r'(<p class="meta">Редакция от )\d{1,2} [а-я]+ 2026', lambda m: m.group(1) + f'{segodnya.day} {MES[segodnya.month - 1]} {segodnya.year}', s, count=1)
    s, n2 = re.subn(r'"dateModified": "\d{4}-\d{2}-\d{2}"', f'"dateModified": "{iso}"', s, count=1)
    assert n == 1 and n2 == 1, 'оферта: не нашёл строку редакции или dateModified'
    open(p, 'w', encoding='utf-8').write(s)
    return True


METKA_RED = re.compile(r'<!--redakciya-pri-oplatah:[^>]*-->\n?')
RED_RE = re.compile(r'<p class="meta">Редакция от (\d{1,2} [а-я]+ \d{4})')
META_OF = re.compile(r'<meta name="deloskop-oferta" content="[^"]*">')


def redakciya_pri_oplatah(koren, D, segodnya=None):
    """oplata-schet-v1 ([Право] 10.10 01:20, О1–О3: редакция оферты к началу оплат). Правки оферты лежат
    в половинах <!--oplata--> — их показывает tests/sobrat_shapku.py при "beta": false. Дата редакции должна
    стать датой включения оплат: ОДИН раз — пока в оферте есть метка <!--redakciya-pri-oplatah…-->;
    дата ставится, метка снимается, повторная сборка ничего не меняет. Обратно (beta снова true) — не откатываем."""
    if D.get('beta') is not False:
        return False
    p = os.path.join(koren, 'oferta', 'index.html')
    s = open(p, encoding='utf-8').read()
    if not METKA_RED.search(s):
        return False
    segodnya = segodnya or datetime.date.today()
    s = METKA_RED.sub('', s, count=1)
    s, n = re.subn(r'(<p class="meta">Редакция от )\d{1,2} [а-я]+ \d{4}', lambda m: m.group(1) + f'{segodnya.day} {MES[segodnya.month - 1]} {segodnya.year}', s, count=1)
    s, n2 = re.subn(r'"dateModified": "\d{4}-\d{2}-\d{2}"', f'"dateModified": "{segodnya.isoformat()}"', s, count=1)
    assert n == 1 and n2 == 1, 'оферта: не нашёл строку редакции или dateModified'
    open(p, 'w', encoding='utf-8').write(s)
    return True


def redakciya_v_schet(koren):
    """О5: счёт пишет «акцепт оферты … в редакции от {дата}» — дату js/schet-dokument.js берёт из
    <meta name="deloskop-oferta"> страницы счёта; сюда её кладёт сборщик из строки «Редакция от …» оферты."""
    of = open(os.path.join(koren, 'oferta', 'index.html'), encoding='utf-8').read()
    data = RED_RE.search(of).group(1)
    p = os.path.join(koren, 'schet', 'dokument', 'index.html')
    s = open(p, encoding='utf-8').read()
    meta = f'<meta name="deloskop-oferta" content="{data}">'
    s2 = META_OF.sub(meta, s, count=1) if META_OF.search(s) else s.replace('<meta name="robots" content="noindex">', '<meta name="robots" content="noindex">\n' + meta, 1)
    if s2 != s:
        open(p, 'w', encoding='utf-8').write(s2)
    return data


def vklyuchit(koren, D, segodnya=None):
    """Переход «Старт» → стартовая цена. Возвращает (D, izmeneno). Ошибка — если нет «да» на годовую цену."""
    if not pora(D, segodnya):
        return D, False
    segodnya = segodnya or datetime.date.today()
    t = start(D)
    st = t['startovaya']
    if not st.get('god_soglasovan'):
        raise SystemExit(
            'Стартовая цена «Старта»: нет «да» владельца на годовую цену ' + f'{st["god"]:,}'.replace(',', ' ') + ' ₽.\n'
            'Либо «да» владельца → tarify.json, start.startovaya.god_soglasovan: true; '
            'либо start.startovaya.vklyuchit: false — тогда «Старт» по обычной цене. '
            'Решение — claude/Решения_владельца_03.10_Старт_390_и_НДС-2027.md; годовая — [Право] 03.10 21:10, разд. 0 п. 1.')
    st['obychnaya'] = {'mesyac': t['mesyac'], 'god': t['god']}
    st['primenena'] = segodnya.isoformat()
    t['mesyac'], t['god'] = st['mesyac'], st['god']
    _zapisat_tarify(koren, D)
    _oferta(koren, st, segodnya)
    return D, True


def stroka_tarify(t):
    """Строка под ценой карточки «Старта» на /tarify/ — только когда стартовая цена действует."""
    st = t.get('startovaya')
    if not st or not st.get('primenena') or t['mesyac'] != st['mesyac']:
        return ''
    do = data_ru(st['pervaya_oplata_do']).replace(NB, '&nbsp;')
    return '<p class="startovaya">' + STROKA_TARIFY.format(do=do, mes=st['sohranyaetsya_mes']) + '</p>'
