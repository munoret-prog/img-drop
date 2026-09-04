# img-drop

Загрузи картинку — получи прямую публичную ссылку.

- Фронтенд: статический `index.html`, живёт на GitHub Pages.
- Бэкенд: Cloudflare Worker (`worker/`) принимает файл и коммитит его в
  `images/` этого репозитория через GitHub Contents API.
- Ссылка отдаётся через jsDelivr CDN: `cdn.jsdelivr.net/gh/<owner>/<repo>@main/images/<file>`.

## Деплой воркера

```
cd worker
npx wrangler login          # один раз, интерактивный OAuth в браузере
npx wrangler secret put GITHUB_TOKEN   # fine-grained PAT, Contents: Read and write, только этот репозиторий
npx wrangler deploy
```

После деплоя подставить полученный `*.workers.dev` URL в `index.html`
(`WORKER_URL`) и запушить.

## GitHub Pages

Settings → Pages → Source: `main` / root.
