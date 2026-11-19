<p align="center">
  <img src="public/logo.svg" width="72" height="72" alt="WhoYouKnow logo" />
</p>

<h1 align="center">WhoYouKnow</h1>

<p align="center"><strong>Every connection counts.</strong><br/>每一段关系都算数。</p>

<p align="center">English · <a href="README.md">简体中文</a></p>

---

WhoYouKnow is a personal relationship system centered on **you**. It is not an arbitrary social graph. You create a separate “My profile” (or migrate an existing contact into it), the people directory contains only contacts, and you organize them with groups, circles and tags.

## Run

```bash
pnpm install
pnpm dev      # development
pnpm build    # typecheck + production build
pnpm preview  # preview the build
pnpm serve    # serve dist + the data-file API; LINKMAP_DATA_FILE selects any file path
```

`pnpm serve` listens on `127.0.0.1:4173` only. Adjust it with `PORT` / `HOST`, for example `HOST=0.0.0.0 pnpm serve`.

Stack: React 18 + Vite + TypeScript + react-router-dom + zustand + lucide-react. pnpm is the package manager and script runner. No UI framework; styles are driven by the semantic tokens in `src/styles/tokens.css`.

## Reverse proxy example

For public deployment, serve `dist` and `/api` from the same origin, terminate TLS at the proxy, and add access control. Keep `serve` bound to `127.0.0.1` as the only write path.

**nginx**

```nginx
server {
  listen 443 ssl;
  server_name whoyouknow.example.com;

  ssl_certificate     /etc/letsencrypt/live/whoyouknow.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/whoyouknow.example.com/privkey.pem;

  root /srv/whoyouknow/dist;
  index index.html;

  location /assets/ {
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  location /api/ {
    proxy_pass http://127.0.0.1:4173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_request_buffering off;
  }

  location / {
    try_files $uri /index.html;
    add_header Cache-Control "no-cache";
  }
}
```

**Caddy**

```caddy
whoyouknow.example.com {
  root * /srv/whoyouknow/dist
  encode gzip

  @assets path /assets/*
  header @assets Cache-Control "public, immutable"

  reverse_proxy /api/* 127.0.0.1:4173

  try_files {path} /index.html
  file_server
}
```

Notes:

- `/api` must share the page origin. Cross-origin deployment needs extra CORS work that this project does not provide.
- Add authentication (Basic Auth / SSO) at the proxy; never expose `4173` directly to the internet.
- Hashed `/assets/*` files can be cached long-term; `index.html` and `/api` must not be cached.

## Core model

- **Who you are**: on first launch you create “My profile”, or migrate an existing contact into it. The current user is stored separately and never appears in the people directory.
- **Everyone is connected**: every contact is assumed to know you. The old “known / unknown” distinction is gone; the People page is the complete contact directory.
- **Network map**: a map centered on you, clustered by group, circle or tag. The system does not store relationships between contacts.
- **Organization**: tags, groups and circles are three separate management pages, each with manual ordering. Group and circle order drives the network map.

## Features

| Area | Capability |
| --- | --- |
| People | All contacts, A-Z pinyin grouping, grid cards, name search |
| Filters | Inline group / circle / tag selects; apply immediately, no modal |
| Person | Add, edit, mark important, delete |
| Network | You-centered map; group/circle/tag switch; zoom, pan, locate, focus |
| Organization | One “Categories” page with tags, groups and circles in three columns; button ordering and drag-and-drop |
| Data | People CSV, full JSON backup; same-name incremental import |

### People page

- Grouped by the first pinyin letter (A-Z); digits, Latin letters and special characters go to a trailing `#` group.
- Grid layout: multiple columns on desktop, two on mobile. Cards show group/tag summaries and the important star.
- A multi-row facet panel filters immediately: one row per dimension (group / circle / tag), with multi-select inside a dimension (OR) and AND across dimensions. Each row has “Unclassified” for people with no value in that dimension; “Clear all” resets everything.
- The people directory contains contacts only; the current user lives in “My profile”.

### Network map

- Centered on “me”. Contacts can be arranged in colored sectors by group, circle or tag. A person who belongs to several groups/circles/tags appears in several clusters.
- Small nodes, generous spacing; sectors grow with the number of people. Drag to pan and open fullscreen for a larger view.
- Outside fullscreen, the mouse wheel scrolls the page; only in fullscreen does it zoom the map.
- Click a dot to focus on a person and see their groups, circles and tags.

### Profile / Categories / Settings

- These are three independent pages in the main navigation, no longer nested under a “Me” page.
- **Profile** (`/profile`): the current user’s details, groups/circles and a relationship overview.
- **Categories** (`/categories`): tags, groups and circles in three columns; each item supports up/down buttons and drag-and-drop; groups and circles open their detail pages.
- **Settings** (`/settings`): project data-file status, JSON full backup/restore, CSV contact import/export; every change is written to the active data file (default `data/linkmap.json`).

### Data

- Shape: `{ version, people, tags, groups, circles, me }`; `people` holds contacts only, `me` holds the current user.
- Data file: defaults to `data/linkmap.json`. `pnpm dev` / `pnpm preview` serve the Vite file API; `pnpm serve` serves static `dist` with the same API.
- Custom path: start any of those with `LINKMAP_DATA_FILE=/absolute/path/data.json`; both the read/write location and the path shown in Settings follow it.
- Fallback: if the file API is unavailable (for example a static host without the server), the app falls back to a localStorage mirror and shows the active mode in Settings.
- Concurrency: every write carries an `If-Match` revision. When two tabs modify the file at once, the later write receives `409`; the client merges “last synced / current local / latest file” and retries instead of overwriting. Writes are serialized in-process and guarded by a cross-process `.lock` file.
- Legacy data: old `friendships`, `edges`, directions and `selfId` are ignored or migrated; important flags and empty notes are migrated. Legacy `selfId` is migrated into `me`.
- CSV: the group column is imported/exported; circles never enter CSV. Same-name imports update incrementally, and rows matching “My profile” are skipped.

## Routes

`/people` (default), `/person/new`, `/person/:id`, `/person/:id/edit`, `/network`, `/profile`, `/profile/edit`, `/categories`, `/categories/groups?name=…`, `/categories/circles/:id`, `/settings`.

Responsive: five-item bottom tab bar below 1024px; sidebar navigation at 1024px and above. Content max-width is 1280px with tighter desktop gutters.

## Known limitations

- Pinyin grouping uses the browser’s Chinese collation plus initial-letter anchors; very rare polyphonic characters may group by their common reading.
- The current user is stored separately; legacy `selfId` data is migrated into `me` on load.
- The map renders synchronously; for thousands of contacts, use group/circle/tag views.
- The project data file requires a local service (`pnpm dev` / `preview` / `serve`); hosting static HTML only falls back to browser storage.
- The `serve` data API has no authentication. It listens on `127.0.0.1` only by default; use `HOST=0.0.0.0` only on a trusted LAN. For public deployment, reverse-proxy `/api` to this service on the same origin and add authentication plus TLS at the proxy.

## License

Private project. All rights reserved.
