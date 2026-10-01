# Делоскоп — сайт deloskop.ru как Dockerfile-приложение Timeweb App Platform (nastoyashij-404-v2, 01.10.2026).
# Зачем: настоящая 404 (код 404 вместо главной с кодом 200), служебные папки не наружу, сжатие и кэш под контролем.
# Пока приложение в Timeweb — тип «HTML/CSS/JS», этот файл ни на что не влияет. Переезд — deploy/PEREEZD.md.
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/deploy /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/50x.html \
 && nginx -t
EXPOSE 80
