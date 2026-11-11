# CineVerse Admin Worker

This Worker serves the admin UI and exposes a same-origin, authenticated catalog API. The GitHub token is only read from the Worker secret binding and is never sent to the browser.

## 1. Configure automated deployment

The repository includes a GitHub Actions workflow that deploys this Worker whenever `admin/**` or `worker/**` changes.

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add:

- `CLOUDFLARE_API_TOKEN` — a Cloudflare API token allowed to deploy Workers in this account. The first deployment must be allowed to create the Worker; after creation, the token can be narrowed to the existing Worker.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID.
- `CINEVERSE_GITHUB_TOKEN` — a GitHub fine-grained token scoped only to `megamrtklc/mrtklc`, with **Contents: Read and write**.

Do not paste any of these values into chat or commit them to the repository. After adding the three secrets, open **Actions → Deploy CineVerse Admin Worker → Run workflow**. The workflow deploys the Worker and writes the GitHub token into Cloudflare as an encrypted Worker secret.

## 2. Configure password-based administrator login

Cloudflare Access is not required. The Worker serves a built-in login page and verifies a long administrator password on the server.

1. In GitHub, open **Settings → Secrets and variables → Actions**.
2. Add a repository secret named `CINEVERSE_ADMIN_PASSWORD`.
3. Use a unique password of at least 20 characters. Prefer a randomly generated password or a long passphrase; do not reuse a website password.
4. Never paste the password into chat, source files, or `wrangler.jsonc`.

The deployment workflow stores this value as the encrypted Worker secret `ADMIN_PASSWORD`. It also generates a fresh 256-bit `SESSION_SECRET` at deployment time. Existing sessions are invalidated after each deployment.

The Worker issues a 12-hour, HMAC-signed session cookie with `HttpOnly`, `Secure`, and `SameSite=Strict` attributes. Login attempts are rate-limited to five per minute per client IP using a Worker rate-limiting binding. Catalog writes require a same-origin request and a current GitHub blob SHA.

## 3. Deployment secrets

The workflow requires these repository secrets:

- `CLOUDFLARE_API_TOKEN` — deploy permission for this Worker.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `CINEVERSE_GITHUB_TOKEN` — fine-grained GitHub token scoped to this repository, Contents read/write.
- `CINEVERSE_ADMIN_PASSWORD` — unique administrator password, at least 20 characters.

The workflow stores `ADMIN_PASSWORD`, `SESSION_SECRET`, and `GITHUB_TOKEN` as encrypted Worker secrets. Do not commit `.dev.vars`, `.env`, or any token.

## 4. Open the panel

Open the Worker hostname. The CineVerse login page appears. Enter the administrator password to access the panel.

## API

- `GET /api/session` — verified Access identity.
- `GET /api/catalog` — current catalog and GitHub blob SHA.
- `PUT /api/catalog` — validated catalog update. Requires the latest SHA; stale writes return HTTP 409.

All catalog routes require a valid signed administrator session cookie. The API is same-origin and does not enable cross-origin requests. Catalog writes create a normal Git commit, preserving GitHub history for rollback.

## Notes

- The public GitHub Pages copy of `/admin/` remains a read-only preview. Do not use it for privileged operations.
- The protected Worker URL is the actual management endpoint.
- Never commit `.dev.vars`, `.env`, or any token.
