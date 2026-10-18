# Делоскоп — сайт deloskop.ru как Dockerfile-приложение Timeweb App Platform (nastoyashij-404-v2, 01.10.2026).
# Зачем: настоящая 404 (код 404 вместо главной с кодом 200), служебные папки не наружу, сжатие и кэш под контролем.
# vizual-v3.0b: при сборке образа — сжатые копии .gz (gzip_static в deploy/nginx.conf); brotli в официальном образе nginx нет —
# сжатие gzip -9 (≈ на 15–20 % больше brotli); модуль brotli — отдельной сборкой образа, если понадобится.
# Пока приложение в Timeweb — тип «HTML/CSS/JS», этот файл ни на что не влияет. Переезд — deploy/PEREEZD.md.
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/deploy /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/50x.html \
 && find /usr/share/nginx/html -type f -size +512c \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.json' \
      -o -name '*.svg' -o -name '*.xml' -o -name '*.txt' -o -name '*.webmanifest' \) -exec sh -c 'gzip -9 -n -c "$1" > "$1.gz"' _ {} \; \
 && nginx -t
EXPOSE 80
