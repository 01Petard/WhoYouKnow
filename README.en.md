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
pnpm test     # Data flow regression tests
pnpm build    # typecheck + production build
pnpm preview  # preview the build
pnpm serve    # serve dist + the data-file API; LINKMAP_DATA_FILE selects any file path
```

`pnpm serve` listens on `127.0.0.1:4173` only. Adjust it with `PORT` / `HOST`, for example `HOST=0.0.0.0 pnpm serve`.

Stack: React 18 + Vite + TypeScript + react-router-dom + zustand + lucide-react. pnpm is the package manager and script runner. No UI framework; styles are driven by the semantic tokens in `src/styles/tokens.css`.

## Docker deployment

On the Docker host, clone the repository and run `bash deploy.sh` for both initial deployment and updates. It fast-forwards the current branch, builds the image for a new commit, and deploys it with Docker Compose. The service uses the checkout’s `data/` directory and listens on `127.0.0.1:4173`. See the [deployment and recovery instructions](README.md#docker-部署和更新).

Run `bash deploy.sh --rebuild` to rebuild without the Docker build cache, even if the Git commit is unchanged.

The runtime image uses Alpine. After the new container passes its health check, the script removes the previous container and image. If a rollout fails, the script can still restore the previous image. After a successful rollout, `bash deploy.sh <Git-SHA>` rebuilds the selected image if needed.

Health checks require Docker Engine 25 or newer and Compose support for `healthcheck.start_interval`. Docker probes every second during startup for up to 30 seconds, then every 30 seconds after the first successful check.

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

- **Who you are**: on first launch you create “My profile”, migrate an existing contact, or restore a JSON backup. The current user is stored separately and never appears in the people directory.
- **Everyone is connected**: every contact is assumed to know you. The old “known / unknown” distinction is gone; the People page is the complete contact directory.
- **Network map**: a map centered on you, clustered by group, circle or tag. The system does not store relationships between contacts.
- **Organization**: the Categories page provides separate views and manual ordering for tags, groups and circles. Group and circle order drives the network map.

## Features

| Area | Capability |
| --- | --- |
| People | Contact directory, A–Z pinyin grouping, name and note search |
| Filters | An expandable panel for groups, circles and tags with immediate results |
| Person | Add, edit, mark important, delete |
| Network | You-centered map; group/circle/tag switch; zoom, pan, locate, focus |
| Organization | One “Categories” page with tags, groups and circles in three views; button ordering and drag-and-drop |
| Data | People CSV, full JSON backup; same-name incremental import |

### People page

- Grouped by the first pinyin letter (A-Z); digits, Latin letters and special characters go to a trailing `#` group.
- Directory rows show names, the important star, groups, and the last contact date. Desktop layouts place follow-up and group shortcuts beside the directory, with the follow-up summary above the list on small screens.
- A multi-row facet panel filters immediately: open it from Filters to see one row per dimension (group / circle / tag), with multi-select inside a dimension (OR) and AND across dimensions. Each row has “Unclassified” for people with no value in that dimension; “Clear all” clears the category selections.
- The people directory contains contacts only; the current user lives in “My profile”.

### Contact journal

- Add as many entries as needed per day from a contact's profile. Record an in-person visit, call, message, or another kind of contact.
- Open the journal from People to browse entries by month and filter by name, note, or method. On This Day revisits entries recorded on the same calendar date in previous years.
- The latest entry or manually marked date drives follow-up status. JSON backups include journal entries.

### Network map

- Centered on “me”. Contacts can be arranged in colored sectors by group, circle or tag. A person who belongs to several groups/circles/tags appears in several clusters.
- Small nodes, generous spacing; sectors grow with the number of people. Drag to pan and open fullscreen for a larger view.
- Outside fullscreen, the mouse wheel scrolls the page; only in fullscreen does it zoom the map.
- Click a dot to focus on a person and see their groups, circles and tags.

### Profile / Categories / Settings

- These are three independent pages in the main navigation, no longer nested under a “Me” page.
- **Profile** (`/profile`): the current user’s details, groups/circles and a relationship overview.
- **Categories** (`/categories`): tags, groups and circles in three views; each item supports up/down buttons and drag-and-drop; groups and circles open their detail pages.
- **Settings** (`/settings`): project data-file status, JSON full backup/restore, CSV contact import/export. Changes go to the active data file when available (default `data/linkmap.json`). You can also restore a JSON backup directly from setup.

### Data

- Shape: `{ version, people, tags, groups, circles, me }`; `people` holds contacts only, `me` holds the current user.
- Data file: defaults to `data/linkmap.json`. `pnpm dev` / `pnpm preview` serve the Vite file API; `pnpm serve` serves static `dist` with the same API.
- Custom path: start any of those with `LINKMAP_DATA_FILE=/absolute/path/data.json`; both the read/write location and the path shown in Settings follow it.
- Fallback: if the file API is unavailable (for example a static host without the server), the app keeps pending drafts in browser storage and shows the active mode in Settings.
- Follow-up: filter important contacts or see which of them have no contact date or a date at least 30 days ago. Record, backdate, or clear the date from the contact details. JSON backups include this date.
- Concurrency: each write carries an `If-Match` revision. Ordinary edits are merged against their base before retrying a conflict. A full restore requires a fresh read and confirmation if the file changed. Browser drafts are retried after reopening, reconnecting, or saving manually.
- Legacy data: old `friendships`, `edges`, directions and `selfId` are ignored or migrated; important flags and empty notes are migrated. Legacy `selfId` is migrated into `me`.
- CSV: import matches columns by their headers. A legacy “圈子” column is treated as a group column. Same-name imports update incrementally, and rows matching “My profile” are skipped.

## Routes

`/people` (default), `/journal`, `/person/new`, `/person/:id`, `/person/:id/edit`, `/network`, `/profile`, `/profile/edit`, `/categories`, `/categories/groups?name=…`, `/categories/circles/:id`, `/settings`.

Responsive: five-item bottom tab bar below 1024px; sidebar navigation at 1024px and above. Content max-width is 1460px with responsive side padding.

## Known limitations

- Pinyin grouping uses the browser’s Chinese collation plus initial-letter anchors; very rare polyphonic characters may group by their common reading.
- The current user is stored separately; legacy `selfId` data is migrated into `me` on load.
- The map renders synchronously; for thousands of contacts, use group/circle/tag views.
- The project data file requires a local service (`pnpm dev` / `preview` / `serve`); hosting static HTML only falls back to browser storage.
- The `serve` data API has no authentication. It listens on `127.0.0.1` only by default; use `HOST=0.0.0.0` only on a trusted LAN. For public deployment, reverse-proxy `/api` to this service on the same origin and add authentication plus TLS at the proxy.

## License

Private project. All rights reserved.
