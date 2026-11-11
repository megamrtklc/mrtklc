# CineVerse Admin Worker

This Worker serves the admin UI and exposes a same-origin, authenticated catalog API. The GitHub token is only read from the Worker secret binding and is never sent to the browser.

## 1. Configure automated deployment

The repository includes a GitHub Actions workflow that deploys this Worker whenever `admin/**` or `worker/**` changes.

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add:

- `CLOUDFLARE_API_TOKEN` — a Cloudflare API token allowed to deploy Workers in this account. The first deployment must be allowed to create the Worker; after creation, the token can be narrowed to the existing Worker.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID.
- `CINEVERSE_GITHUB_TOKEN` — a GitHub fine-grained token scoped only to `megamrtklc/mrtklc`, with **Contents: Read and write**.

Do not paste any of these values into chat or commit them to the repository. After adding the three secrets, open **Actions → Deploy CineVerse Admin Worker → Run workflow**. The workflow deploys the Worker and writes the GitHub token into Cloudflare as an encrypted Worker secret.

## 2. Protect the Worker with Cloudflare Access

1. In Cloudflare Zero Trust, create a Self-hosted Access application for the exact Worker hostname shown after deployment (the `*.workers.dev` hostname).
2. Add an Allow policy restricted to the administrator email address(es). Do not use an Everyone policy.
3. Copy the application's Audience (AUD) tag.
4. Set `CF_ACCESS_TEAM_DOMAIN` to the team domain without protocol, for example `example.cloudflareaccess.com`.
5. Set `CF_ACCESS_AUD` to the copied AUD tag, then deploy again.

The Worker independently validates the `Cf-Access-Jwt-Assertion` signature, issuer, audience, and expiry. If Access is not configured, the Worker fails closed and does not serve the panel.

## 3. Add the GitHub token as a Worker secret

The GitHub fine-grained token is supplied to the deployment workflow as the `CINEVERSE_GITHUB_TOKEN` repository secret and stored in Cloudflare as an encrypted Worker secret. Do not paste the token into chat, source files, or `wrangler.jsonc`.

The deployment workflow runs the equivalent of `wrangler secret put GITHUB_TOKEN`; the secret value is not written to the repository.

## 4. Open the panel

Open the Worker hostname. Cloudflare Access will authenticate the administrator before the Worker serves the UI or API.

## API

- `GET /api/session` — verified Access identity.
- `GET /api/catalog` — current catalog and GitHub blob SHA.
- `PUT /api/catalog` — validated catalog update. Requires the latest SHA; stale writes return HTTP 409.

All routes require a valid Cloudflare Access JWT. The API is same-origin and does not enable cross-origin requests. Catalog writes create a normal Git commit, preserving GitHub history for rollback.

## Notes

- The public GitHub Pages copy of `/admin/` remains a read-only preview. Do not use it for privileged operations.
- The protected Worker URL is the actual management endpoint.
- Never commit `.dev.vars`, `.env`, or any token.
