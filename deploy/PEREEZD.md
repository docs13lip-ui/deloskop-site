# Переезд deloskop.ru на Dockerfile-приложение (настоящая 404) — nastoyashij-404-v2

[Ночные запуски] 01.10.2026. Для [Выкладки] и владельца. Пока приложение 258987 — тип «HTML/CSS/JS», файлы `Dockerfile`, `.dockerignore`, `deploy/` ни на что не влияют.

## Зачем
- Тип «HTML/CSS/JS» в Timeweb отдаёт главную с кодом 200 на любой адрес, даже с выключенным SPA Fallback ([Выкладка] 01.10 15:40). Для Яндекса это мягкая 404: каждый битый адрес — дубль главной.
- Свой nginx даёт: 404 с кодом 404; 301 для коротких адресов (/cabinet → /cabinet.html) на сервере, а не скриптом; `/company/ИНН` без карточки → 302 на проверку по ИНН; папки `tests/`, `.github/`, файлы `.py`, `.md` не видны снаружи (сейчас, вероятно, видны — фронтенд-приложение публикует весь репозиторий; проверить в браузере: https://deloskop.ru/tests/kartochki.py); gzip и правила кэша.
- Задел на волну карточек: со ступени 2 (5 000+ карточек) статичные файлы упрутся в объём и лимит запросов тарифа фронтенда; со своим nginx `/company/` можно отдавать из API (proxy_pass) без пересборки сайта — это следующий шаг, не этот комплект.

## Шаги (около 20 минут; деньги — только после «да» владельца)
1. Timeweb → App Platform → «Создать» → **Dockerfile** → репозиторий `docs13lip-ui/deloskop-site`, ветка `main`, путь к директории — корень, автодеплой — вкл. Конфигурация — минимальная (nginx со статикой хватает 1 ядра / 1 ГБ). **Цена — та, что покажет мастер: её владельцу на «да» до создания.**
2. Дождаться сборки (в журнале — `nginx: configuration file ... test is successful`). Проверить на техническом домене приложения:
   ```
   curl -s -o /dev/null -w "%{http_code}\n" https://<тех-домен>/net-takoj-stranicy/      # 404
   curl -s -o /dev/null -w "%{http_code}\n" https://<тех-домен>/nalogi/                  # 200
   curl -sI https://<тех-домен>/nalogi | grep -i location                                 # /nalogi/
   curl -sI "https://<тех-домен>/company/7707083893-x/" | grep -i location                # /?inn=7707083893
   curl -s -o /dev/null -w "%{http_code}\n" https://<тех-домен>/tests/kartochki.py       # 404
   ```
   Плюс глазами в браузере на 1280 и 390: главная, /nalogi/, /pasport/kontragent/?demo=1, вход в кабинет (CORS у api.deloskop.ru разрешает только deloskop.ru — на тех-домене вход может не работать, это нормально).
3. «Домены и SSL»: отвязать `deloskop.ru` (и `www`, если есть) от приложения 258987 → привязать к новому. Минута недоступности возможна — делать ночью или утром до 08:00.
4. Сразу после: `curl -s -o /dev/null -w "%{http_code}" https://deloskop.ru/net-takoj/` → 404; главные страницы 200; Вебмастер → «Проверка ответа сервера» на выдуманный адрес.
5. В `.github/workflows/proverka-i-vykladka.yml` заменить `apps/258987/deploy` на id нового приложения (правка .github — слияние только владельцем) — или выключить там шаг деплоя: автодеплой Timeweb сам соберёт main. Шаг «Дождаться новой версии» оставить.
6. Через сутки без жалоб — остановить и удалить приложение 258987.
7. Запись в ленту «Что нового» — в день переезда: «Несуществующий адрес — честная страница «нет такой страницы» с кодом 404».

## Откат
Вернуть домен на 258987 (оно не удаляется до шага 6). Ничего в репозитории откатывать не нужно.

## Проверка в CI
`tests/nginx.test.js`: всегда — статические проверки конфига; если на машине есть nginx (на ubuntu-latest в GitHub он обычно предустановлен; нет — тест пропускается), поднимает его на репозитории и проверяет 404/301/302/200, заголовки и закрытые папки.

## Ступень 2 волны: /company/ из API (obolochka-v1 + kartochki-iz-api-v1) — не раньше 5 000 карточек и «да» [Продукт · Данные]
Сайт держит ступени 0–1 файлами. Дальше nginx отдаёт карточку, если файл есть, иначе спрашивает API; рендер один (`tests/kartochka_render.py`, его копия — в deloskop-api), оболочку API берёт с сайта: `/partials/obolochka.json` (собирает `tests/sobrat_shapku.py`; в нём отпечаток модуля отрисовки — у API другая версия → 503, nginx отдаёт прежнюю копию из кэша).
```nginx
# в http {} (вне server): кэш карточек
proxy_cache_path /var/cache/nginx/company levels=1:2 keys_zone=company:20m max_size=2g inactive=7d use_temp_path=off;

# вместо location @company:
location @company {
    if ($uri !~ "^/company/\d{10}(?:-[a-z0-9-]+)?/?$") { return 404; }
    proxy_pass https://<домен API>;            # тот же, что у api.deloskop.ru
    proxy_set_header Host deloskop.ru;         # иначе прослойка one_host в API ответит 301 на deloskop.ru (петля)
    proxy_ssl_server_name on;
    proxy_cache company;
    proxy_cache_valid 200 301 1d;
    proxy_cache_valid 404 10m;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_cache_lock on;
    proxy_intercept_errors on;                 # 404 из API → наша /404.html
}
```
В API: `KARTOCHKI_API=1` (без него ручки нет). Проверка: `curl -sI https://deloskop.ru/company/<ИНН из базы>/` → 301 на адрес с названием → 200; ИП, ликвидированная, без отчётности → 404.
