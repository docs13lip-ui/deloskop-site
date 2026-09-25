#!/usr/bin/env python3
"""Собирает /tarify/index.html из tarify/tarify.json — цены на странице не пишутся руками.
Запуск из корня репозитория: python3 tests/sobrat_tarify.py ."""
import json, html, os, sys

ROOT = sys.argv[1]
D = json.load(open(os.path.join(ROOT, 'tarify/tarify.json'), encoding='utf-8'))
_ix = open(os.path.join(ROOT, 'indeks/index.html'), encoding='utf-8').read()
_css = _ix[_ix.index('<style>') + 7:_ix.index('</style>')]
_PFX = (':root', '*{', 'body{', 'a{', '.top', '.brand', '.btn', '@media (max-width:760px)', 'main{', '.crumbs', '.ver', 'h1{', '.sub{', '.meta{', '.lead', '.cap', 'article ', '.tw{', '.primer', '.status', 'details', '.check', '.src', '.disc', 'footer')
BASE = '\n'.join(l for l in _css.split('\n') if l.startswith(_PFX))  # общий стиль берём со страницы Индекса
NB = ' '


def rub(x):
    return f'{x:,}'.replace(',', NB) + NB + '₽'


def mes_god(t):
    import math
    return math.ceil(t['god'] / 12)


CHECK = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 10.5L8 14L15.5 6.5" stroke="#0B63E5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def li(txt):
    if txt.endswith(' (скоро)'):
        return f'<li>{CHECK}<span>{html.escape(txt[:-8])} <span class="skoro">скоро</span></span></li>'
    return f'<li>{CHECK}<span>{html.escape(txt)}</span></li>'


cards = []
for t in D['tarify']:
    if t['mesyac'] == 0:
        price = f'<div class="price"><b>0{NB}₽</b></div><div class="per">навсегда</div>'
        cta = '<a class="cta ghost" href="/">Проверить бесплатно</a>'
    else:
        ek = t['mesyac'] * 12 - t['god']
        price = (f'<div class="price"><b data-m="{rub(t["mesyac"])}" data-y="{rub(mes_god(t))}">{rub(mes_god(t))}</b><span>в месяц</span></div>'
                 f'<div class="per" data-m="при оплате помесячно" data-y="{rub(t["god"])} за год — экономия {rub(ek)}">{rub(t["god"])} за год — экономия {rub(ek)}</div>')
        subj = 'Подключить тариф ' + t['nazvanie']
        from urllib.parse import quote
        cta = f'<a class="cta {"primary" if t.get("rekomenduem") else "ghost"}" href="mailto:help@deloskop.ru?subject={quote(subj)}">Подключить «{t["nazvanie"]}»</a>'
    badge = ' <span class="badge">Рекомендуем</span>' if t.get('rekomenduem') else ''
    cards.append(f'''<div class="plan{' pro' if t.get('rekomenduem') else ''}" id="t-{t['id']}">
  <div><div class="plan-name">{t['nazvanie']}{badge}</div><div class="plan-for">{html.escape(t['dlya'])}</div></div>
  {price}
  <ul>{''.join(li(x) for x in t['chto'])}</ul>
  {cta}
</div>''')

rows = []
for t in D['tarify']:
    if t['mesyac'] == 0:
        continue
    m12 = t['mesyac'] * 12
    ek = m12 - t['god']
    rows.append(f'<tr><td><b>{t["nazvanie"]}</b></td><td class="n">{rub(m12)}</td><td class="n">{rub(t["god"])}</td><td class="n ok">{rub(ek)}</td><td class="n">{round(ek / m12 * 100, 1):.1f}%</td></tr>'.replace('.0%', '%').replace('.', ','))

pak = D['paket_otchetov']
R = D['raschet']
faq = [
    ("Почему за год дешевле на 20%?", "Оплата вперёд избавляет нас от двенадцати списаний и помогает планировать развитие. Этой экономией мы делимся с вами. Годовая цена округлена вниз до сотни рублей, поэтому скидка никогда не меньше 20%."),
    ("Что такое полный отчёт и чем он отличается от базовой проверки?", "Базовая проверка — светофор рисков и главные факты о компании за секунды. Полный отчёт — досье: отчётность с графиками, Индекс Делоскопа с причинами и PDF с датой проверки. Такой PDF — ваше доказательство осмотрительности, если налоговая спросит о сделке через два года."),
    (f"Что делать, если отчётов не хватило?", f"Докупите пакет: {pak['tekst']} за {rub(pak['cena'])}. Пакет добавляется к любому платному тарифу. Калькулятор выше сам подскажет, когда выгоднее пакет, а когда — тариф выше."),
    ("Можно ли сменить тариф?", "Да, в любой момент. При переходе на тариф выше доплачиваете только разницу за оставшиеся дни."),
    ("Как оплатить компании или ИП?", "Пока тарифы подключаем по заявке: напишите на help@deloskop.ru — пришлём счёт и закрывающие документы для бухгалтерии. Оплата картой на сайте появится скоро."),
    ("Гарантирует ли подписка, что счёт не заблокируют?", "Нет. Решение принимает банк. Делоскоп помогает заранее увидеть то, на что смотрят банк и налоговая, и подготовить документы, пока это ещё легко."),
    ("Влияет ли подписка на Индекс Делоскопа моей компании?", "Нет. Индекс нельзя купить или улучшить за деньги — только фактами из государственных реестров. Это правило записано в открытой методике."),
]
MAIL = '<a href="mailto:help@deloskop.ru">help@deloskop.ru</a>'
faq_html = ''.join('<details><summary>' + html.escape(q) + '</summary><p>' + html.escape(a).replace('help@deloskop.ru', MAIL) + '</p></details>' for q, a in faq)
ld = [
    {"@context": "https://schema.org", "@type": "WebPage", "name": "Тарифы Делоскопа", "url": "https://deloskop.ru/tarify/", "inLanguage": "ru",
     "description": "Тарифы Делоскопа: бесплатно, Старт, Про и Бизнес. За год — скидка 20%. Калькулятор подбирает тариф без переплаты и считает окупаемость в рублях.",
     "dateModified": D['versiya']},
    {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]},
    {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Делоскоп", "item": "https://deloskop.ru/"},
        {"@type": "ListItem", "position": 2, "name": "Тарифы", "item": "https://deloskop.ru/tarify/"}]},
]

CSS = BASE + '''
main{max-width:1120px}
.uzko{max-width:820px}
.period{display:inline-flex;gap:4px;background:#EBEBE6;border-radius:999px;padding:4px;margin:26px 0 0}
.period button{border:0;background:transparent;font:inherit;font-size:15px;font-weight:500;color:var(--ink2);padding:10px 18px;border-radius:999px;cursor:pointer;min-height:44px}
.period button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.period em{font-style:normal;color:var(--ok);font-weight:600}
.plans{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:22px 0 10px}
.plan{background:var(--card);border-radius:var(--r);padding:24px 22px;display:flex;flex-direction:column;gap:12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.plan.pro{box-shadow:0 0 0 2px var(--accent),0 16px 40px rgba(11,99,229,.12)}
.plan-name{font-size:21px;font-weight:600;letter-spacing:-.01em;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.badge{font-size:12px;font-weight:600;color:#fff;background:var(--accent);border-radius:99px;padding:3px 10px}
.plan-for{font-size:15px;color:var(--muted);margin-top:2px}
.price b{font-size:34px;letter-spacing:-.03em;font-variant-numeric:tabular-nums}.price span{font-size:15px;color:var(--muted);margin-left:6px}
.per{font-size:14px;color:var(--muted);min-height:42px}
.plan ul{list-style:none;margin:0;padding:0;font-size:15px;line-height:1.4;flex:1}
.plan li{display:grid;grid-template-columns:22px 1fr;gap:6px;padding:5px 0;color:var(--ink2)}
.skoro{font-size:12px;font-weight:600;color:var(--warn);background:#FFF4E0;border-radius:99px;padding:1px 8px;white-space:nowrap}
.cta{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:14px;font-weight:600;font-size:16px}
.cta.primary{background:var(--accent);color:#fff}.cta.primary:hover{background:var(--accent-hover);color:#fff}
.cta.ghost{background:#EEF3FC;color:var(--accent)}
.pod{font-size:15px;color:var(--muted);margin:6px 0 0}
h2.big{font-size:clamp(28px,4vw,40px);letter-spacing:-.03em;line-height:1.1;margin:72px 0 10px;font-weight:600}
.lid{font-size:19px;color:var(--ink2);margin:0 0 20px;max-width:720px}
.kalk{background:var(--card);border-radius:var(--r);box-shadow:0 1px 2px rgba(0,0,0,.04),0 16px 40px rgba(0,0,0,.05);display:grid;grid-template-columns:1fr 420px;overflow:clip}
.pol{padding:8px 26px 26px}
.pol fieldset{border:0;margin:18px 0 0;padding:0}
.pol legend{font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.f{display:grid;grid-template-columns:1fr 150px;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid #F0F0EC;font-size:16px;line-height:1.35}
.f small{display:block;color:var(--muted);font-size:13px;margin-top:2px}
.f input[type=text],.f select{width:100%;min-height:46px;border:1px solid var(--line);border-radius:12px;padding:0 12px;font:inherit;font-size:17px;font-variant-numeric:tabular-nums;background:#FAFAF8;color:var(--ink)}
.f input[type=text]{text-align:right}
.f input:focus,.f select:focus{outline:2px solid var(--accent);outline-offset:1px;background:#fff}
.g{display:grid;grid-template-columns:22px 1fr;gap:8px;align-items:start;padding:10px 0;border-bottom:1px solid #F0F0EC;font-size:16px;cursor:pointer}
.g input{width:18px;height:18px;margin:2px 0 0;accent-color:var(--accent)}
.itog{background:#111113;color:#F5F5F2;padding:26px 26px 28px;display:flex;flex-direction:column;gap:6px}
.itog .e{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8E8E93}
.itog .nm{font-size:34px;font-weight:600;letter-spacing:-.03em;line-height:1.1}
.itog[data-ton=pro] .nm{color:#6EA8FF}
.itog .cn{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
.itog .pr{font-size:14px;color:#B8B8BD}
.itog ul{margin:8px 0 0;padding-left:18px;color:#D6D6DA;font-size:15px;line-height:1.45}.itog li{margin:3px 0}
.itog .alt{font-size:14px;color:#9FD8B4;margin-top:4px}
.itog a{color:#6EA8FF}
.itog hr{border:0;border-top:1px solid #2C2C30;margin:14px 0 8px;width:100%}
.itog .rw{display:flex;justify-content:space-between;gap:12px;align-items:baseline;font-size:15px;color:#D6D6DA}
.itog .rw b{font-size:20px;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap}
.itog .sost{font-size:13px;color:#8E8E93;margin:-2px 0 6px}
.itog .vv{font-size:17px;line-height:1.45;color:#fff;background:#1E1E22;border-radius:14px;padding:14px 16px;margin-top:10px}
.itog .nal{font-size:14px;color:#FFD08A;margin-top:8px}
.tabl{width:100%;border-collapse:collapse;font-size:16px;background:var(--card);border-radius:16px;overflow:hidden}
.tabl th,.tabl td{text-align:left;padding:13px 16px;border-bottom:1px solid var(--line)}
.tabl thead th{font-size:14px;color:var(--muted);font-weight:600;background:#FAFAF8}
.tabl td.n{font-variant-numeric:tabular-nums;white-space:nowrap}.tabl td.ok{color:var(--ok);font-weight:600}
.tabl tr:last-child td{border-bottom:0}
.pravila{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.pravila li{background:var(--card);border-radius:20px;padding:20px 22px;color:var(--ink2);font-size:16px;line-height:1.5}
.pravila li b{display:block;color:var(--ink);font-size:18px;margin-bottom:4px;letter-spacing:-.01em}
.pravila small{display:block;color:var(--muted);font-size:13px;margin-top:6px}
.besp{background:#E8F5EE;color:#0E4D2A;border-radius:20px;padding:18px 22px;font-size:17px;margin:20px 0 0}
.besp a{color:#0E4D2A;text-decoration:underline}
@media (max-width:1000px){.plans{grid-template-columns:repeat(2,1fr)}.kalk{grid-template-columns:1fr}}
@media (max-width:620px){.plans{grid-template-columns:1fr}.pravila{grid-template-columns:1fr}.f{grid-template-columns:1fr 128px}.pol{padding:4px 16px 18px}.itog{padding:22px 18px}.tabl th,.tabl td{padding:11px 10px;font-size:15px}}
@media print{.top,.kalk,.period,footer{display:none}body{background:#fff}}
'''

opis = "Тарифы Делоскопа: бесплатно, Старт, Про и Бизнес. За год — скидка 20%. Подбор тарифа без переплаты и окупаемость в рублях: сколько стоит одна неудачная сделка и блокировка счёта."
t_pro = next(t for t in D['tarify'] if t['id'] == 'pro')

page = f'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Тарифы Делоскопа — сколько стоит и сколько экономит</title>
<meta name="description" content="{opis}">
<link rel="canonical" href="https://deloskop.ru/tarify/">
<meta property="og:type" content="website">
<meta property="og:title" content="Тарифы Делоскопа — сколько стоит и сколько экономит">
<meta property="og:description" content="{opis}">
<meta property="og:url" content="https://deloskop.ru/tarify/">
<meta property="og:image" content="https://deloskop.ru/ikonka-512.png">
<meta name="theme-color" content="#F5F5F2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&display=swap" rel="stylesheet">
<style>
{CSS}
</style>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>
<header class="top"><div class="in">
  <a class="brand" href="/" aria-label="Делоскоп — на главную"><svg width="30" height="27" viewBox="0 0 72 64" fill="none" aria-hidden="true"><path d="M36 18.1A16 16 0 0 1 36 45.9A16 16 0 0 1 36 18.1Z" fill="#0B63E5"/><circle cx="28" cy="32" r="16" stroke="#1D1D1F" stroke-width="4.5"/><circle cx="44" cy="32" r="16" stroke="#1D1D1F" stroke-width="4.5"/></svg><span>делоскоп</span></a>
  <nav aria-label="Разделы"><a href="/proverit-schet/">Проверь счёт</a><a href="/delopis/">Делопись</a><a href="/115-fz/">115-ФЗ</a><a href="/nalogi/">Налоги</a><a href="/indeks/">Индекс</a><a href="/cabinet.html">Кабинет</a></nav>
  <a class="btn" href="/">Проверить</a>
</div></header>
<main>
<nav class="crumbs" aria-label="Навигация"><a href="/">Делоскоп</a><span>›</span><span>Тарифы</span></nav>
<article>
<h1>Тарифы</h1>
<p class="sub">Подписка стоит меньше одной ошибки. Мы считаем это в рублях — и советуем тариф дешевле, если его хватит.</p>
<div class="meta">Цены с 26 сентября 2026 · за год — скидка 20%</div>

<div class="period" role="group" aria-label="Период оплаты">
  <button type="button" data-period="mes" aria-pressed="false">Помесячно</button>
  <button type="button" data-period="god" aria-pressed="true" class="on">За год <em>−20%</em></button>
</div>
<div class="plans">
{chr(10).join(cards)}
</div>
<p class="pod">Нужно больше отчётов? {pak['tekst'].capitalize()} — {rub(pak['cena'])} к любому платному тарифу. Компаниям и ИП — по счёту, с закрывающими документами. Оплата картой на сайте — скоро.</p>

<h2 class="big" id="podbor">Подбор без переплаты</h2>
<p class="lid">Расскажите, как вы работаете, — покажем самый дешёвый тариф, которого хватит, и сколько денег он защищает.</p>
<div class="kalk">
  <div class="pol">
    <fieldset><legend>Что вам нужно</legend>
      <label class="f" for="p-otch"><span>Новых компаний в месяц, которые проверяете подробно<small>Полный отчёт с отчётностью и PDF</small></span><input id="p-otch" type="text" inputmode="numeric" value="5" autocomplete="off"></label>
      <label class="f" for="p-slezh"><span>Постоянных партнёров, за которыми следить<small>Сообщим, если у них что-то изменится</small></span><input id="p-slezh" type="text" inputmode="numeric" value="5" autocomplete="off"></label>
      <label class="f" for="p-lyudi"><span>Сколько человек будут работать в Делоскопе</span><input id="p-lyudi" type="text" inputmode="numeric" value="1" autocomplete="off"></label>
      <label class="g"><input id="p-delopis" type="checkbox"><span>Нужны договоры с защитой под контрагента (Делопись)</span></label>
    </fieldset>
    <fieldset><legend>Ваш бизнес</legend>
      <label class="f" for="p-summa"><span>Обычная сумма договора с поставщиком<small>₽, с НДС</small></span><input id="p-summa" type="text" inputmode="numeric" value="1 000 000" data-den="1" autocomplete="off"></label>
      <label class="f" for="p-rezhim"><span>Режим налогов<small>УСН 15% — «доходы минус расходы», 6% — «доходы»</small></span><select id="p-rezhim"><option value="osn" selected>ОСН</option><option value="usn15">УСН 15%</option><option value="usn6">УСН 6%</option></select></label>
      <label class="g" id="p-pribyl-l"><input id="p-pribyl" type="checkbox"><span>Считать худший случай: налоговая снимет и расходы по налогу на прибыль</span></label>
      <label class="f" for="p-oborot"><span>Сколько проходит по расчётному счёту в месяц<small>₽, поступления</small></span><input id="p-oborot" type="text" inputmode="numeric" value="3 000 000" data-den="1" autocomplete="off"></label>
      <label class="g"><input id="p-nal" type="checkbox"><span>Снимаем наличные со счёта или сдаём выручку инкассацией</span></label>
    </fieldset>
  </div>
  <div class="itog" id="itog" aria-live="polite">
    <div class="e">Вам подойдёт</div>
    <div class="nm" id="i-nazv">—</div>
    <div class="cn" id="i-cena">—</div>
    <div class="pr" id="i-per"></div>
    <ul id="i-pochemu"></ul>
    <div class="alt" id="i-alt"></div>
    <hr>
    <div class="e">Что стоит на кону</div>
    <div class="rw"><span>Одна сделка с «технической» компанией</span><b id="o-nalog">—</b></div>
    <div class="sost" id="o-nalog-sost"></div>
    <div class="rw"><span>Деньги, которые встанут при блокировке счёта на {R['dnej_prostoya_po_umolchaniyu']} рабочих дней</span><b id="o-prostoj">—</b></div>
    <div class="sost">Это не убыток, а деньги, которыми нельзя распоряжаться: зарплата, налоги и поставщики ждут.</div>
    <div class="vv" id="o-vyvod"></div>
    <div class="nal" id="o-nal" hidden>Наличные — отдельная зона внимания банка: частые снятия и крупные суммы наличными — один из признаков из рекомендаций Банка России. <a href="/115-fz/snyatie-nalichnyh-s-raschetnogo-scheta/">Как снимать без вопросов банка →</a></div>
  </div>
</div>
<p class="pod">Расчёт по нормам Налогового кодекса: вычет НДС {R['nds']}%, штраф {R['shtraf_122']}% по ст. 122 НК, пени за 2 года по ст. 75 НК при ключевой ставке {round(R['klyuchevaya_stavka']*100, 2):g}% ({R['klyuchevaya_stavka_istochnik']}). Это пример, а не прогноз по вашей компании. {R['dnej_prostoya_poyasnenie']}</p>

<div class="uzko">
<h2 class="big" id="god">Месяц × 12 или сразу за год</h2>
<p class="lid">Одинаковые возможности, разная цена. Годовая цена округлена вниз до сотни рублей — скидка никогда не меньше 20%.</p>
<div class="tw"><table class="tabl">
<thead><tr><th>Тариф</th><th>12 месяцев помесячно</th><th>Сразу за год</th><th>Экономия</th><th>Скидка</th></tr></thead>
<tbody>{''.join(rows)}</tbody>
</table></div>

<h2 class="big" id="pravila">Честные правила подписки</h2>
<p class="lid">Подписку должно быть легко не только оформить, но и отменить.</p>
<ul class="pravila">
<li><b>Не продлеваем молча</b>За 3 дня до каждого списания пришлём письмо: сумма, дата и ссылка на отмену.</li>
<li><b>Отмена — одной кнопкой</b>В кабинете, без звонков и писем. Доступ сохраняется до конца оплаченного срока.</li>
<li><b>Отказались — карту не трогаем</b>После отказа от автосписания карту больше не используем — ни для физлиц, ни для компаний.<small>Для физлиц это требование закона: ст. 16.1 Закона о защите прав потребителей в ред. № 376-ФЗ, с 1 марта 2026</small></li>
<li><b>Цена года не меняется</b>Оплатили год — цена зафиксирована до его конца, даже если тарифы вырастут.</li>
<li><b>Переход выше — только разница</b>Доплачиваете за оставшиеся дни, а не полную цену нового тарифа.</li>
<li><b>Индекс не продаётся</b>Подписка никак не влияет на оценку ни одной компании, включая вашу. <a href="/indeks/">Методика открыта →</a></li>
</ul>
<p class="besp"><b>Бесплатно навсегда:</b> 3 проверки в день, <a href="/proverit-schet/">«Проверь счёт»</a> перед оплатой, статьи <a href="/delopis/">«Делописи»</a> по 115-ФЗ и налогам и <a href="/indeks/">открытая методика Индекса</a>.</p>

<h2 class="big" id="voprosy">Вопросы</h2>
{faq_html}

<div class="check"><h2>Начните с бесплатной проверки</h2><p>Проверьте свою компанию или поставщика по ИНН — без регистрации.</p><form action="/" method="get"><input name="inn" inputmode="numeric" maxlength="12" pattern="\d{10}|\d{12}" required placeholder="ИНН компании или ИП" aria-label="ИНН компании или ИП"><button type="submit">Проверить</button></form></div>

<section class="src"><h2>Источники</h2><ol>
<li><a href="https://www.consultant.ru/law/hotdocs/91121.html" rel="noopener" target="_blank">Федеральный закон от 15.10.2025 № 376-ФЗ — запрет автосписаний после отказа потребителя, с 1 марта 2026</a></li>
<li><a href="https://www.consultant.ru/document/cons_doc_LAW_19671/" rel="noopener" target="_blank">Налоговый кодекс РФ: ст. 54.1, 75, 122, 171–172</a></li>
<li><a href="https://www.cbr.ru/press/keypr/" rel="noopener" target="_blank">Банк России: ключевая ставка 14% с 11 сентября 2026</a></li>
<li><a href="https://www.consultant.ru/document/cons_doc_LAW_32834/" rel="noopener" target="_blank">Федеральный закон № 115-ФЗ, ст. 7 — отказ в операциях и реабилитация</a></li>
</ol></section>
<p class="disc">Цены указаны за доступ к сервису. Материалы носят информационный характер и не заменяют консультацию юриста.</p>
</div>
</article>
</main>
<footer><span>© 2026 Делоскоп · Материалы носят информационный характер и не заменяют консультацию юриста</span>
<span><a href="/proverit-schet/">Проверь счёт</a> · <a href="/delopis/">Делопись</a> · <a href="/115-fz/">115-ФЗ</a> · <a href="/nalogi/">Налоги</a> · <a href="/indeks/">Индекс</a> · <a href="mailto:help@deloskop.ru">help@deloskop.ru</a></span></footer>
<script type="application/json" id="tarify-data">{json.dumps(D, ensure_ascii=False)}</script>
<script src="tarify.js" defer></script>
<script src="/obnovleniya.js" defer></script>
</body>
</html>
'''
open(os.path.join(ROOT, 'tarify/index.html'), 'w', encoding='utf-8').write(page)
print('ok', len(page))
