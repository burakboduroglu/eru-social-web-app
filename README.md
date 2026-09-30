<div align="center">

<img src="public/assets/social-web-mark.svg" alt="social-web logo" width="88">

# social-web

**An invite-only place for conversations and communities, built on Supabase.**

[![License](https://img.shields.io/badge/license-MIT-000?style=flat-square)](LICENSE)
![React](https://img.shields.io/badge/React-19-000?style=flat-square&logo=react)
![Bun](https://img.shields.io/badge/Bun-runtime-000?style=flat-square&logo=bun)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%C2%B7%20Postgres%20%C2%B7%20Storage-000?style=flat-square&logo=supabase)
![Invite only](https://img.shields.io/badge/sign--up-invite_only-000?style=flat-square)

</div>

---

<div align="center">

<img src="docs/screenshots/feed-desktop.png" alt="social-web home feed with sidebar navigation, the composer, posts and community discovery" width="900">

<sub>Screenshot supplied by the project owner, shown unchanged.</sub>

</div>

social-web brings posts, replies and communities into a dark, X-style interface.
React and TanStack Router handle the browser; a Bun API uses Drizzle to query
Supabase Postgres. Auth and file storage live in the same Supabase project.

## What it is

Join with an **invitation code**, confirm your email and complete your profile.
Share a post with text, emoji or a GIF, reply to a conversation, and find people
through user search. Community feeds keep related conversations together.

The interface uses a **flat feed, neutral dividers and responsive navigation**.
Tabs update their content without remounting the composer or navigation. Page
transitions show a small in-content spinner while keeping the surrounding layout
in place. Pixelarticons, pixel illustrations and seeded fallback avatars share a
consistent visual style. Compact menus and search suggestions support keyboard
navigation. GIF and emoji selectors open as floating panels without moving the
composer or feed. Post details separate the content, date, engagement and inline
reply form. Community destinations appear above the author. Publishing confirms
with a short toast at the top of the screen. Illustrated empty states explain
where to start; error screens distinguish missing pages, connection failures and
temporary service limits.

## Highlights

| | Feature | How it works |
| --- | --- | --- |
| 🔒 | **Invitation-only registration** | An Auth database trigger validates and consumes a hashed invitation atomically, including direct Auth API calls. |
| 💬 | **Conversations** | Paginated feeds, replies, likes, share links and recent reply notifications. |
| 👥 | **Communities** | Create a community, join one, publish to its feed and browse its members. Owners can edit its description. |
| 🪪 | **Profiles** | Onboarding, avatar upload, searchable names, biographies and separate posts/replies tabs. |
| 🎞️ | **Rich posts** | Searchable emoji, 14 bundled animated reaction GIFs, personal uploads, readable links, automatic page previews and YouTube/Spotify embeds. No GIF provider API key. |
| 🛡️ | **Database-enforced ownership** | Verified Auth identities and transaction-local roles preserve RLS through the Drizzle connection. |
| 📱 | **One responsive layout** | Three columns on desktop, compact navigation on smaller screens and a mobile bottom bar. |
| 🖼️ | **Useful error states** | Themed illustrations, retry actions and `Retry-After` countdowns for rate limits and service failures. |

## Install

Requires Bun, the Supabase CLI and a Supabase project.

```sh
git clone https://github.com/burakboduroglu/social-web.git
cd social-web
bun install
```

Create an ignored `.env` with **only the three Supabase settings**:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_URL_ENCODED_PASSWORD@YOUR_POOLER_HOST:6543/postgres
```

Copy the shared transaction-mode pooler connection string from Supabase.
Percent-encode reserved characters in the database password. The CLI login does
not recover that password. Only the URL and publishable key reach the browser;
`DATABASE_URL` stays in the Bun process.

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --linked
supabase config diff --project-ref YOUR_PROJECT_REF
supabase config push --project-ref YOUR_PROJECT_REF
bun run db:check
bun run dev
```

`bun run dev` serves the app at `http://127.0.0.1:5173` and the API at
`http://127.0.0.1:3001`. It stops a previous social-web dev server on those ports
first. If another program already holds either port, the command exits instead of
moving to the next port. Local Auth callbacks for 5173 and 3001 are declared in
`supabase/config.toml`.

The current development project is **social-web**, ref
`wmheubrkrqpaxmsvlqmw`, with pooler host
`aws-1-eu-central-1.pooler.supabase.com`. Restart the dev server after editing `.env`.

## Invitations

Create a code as the project operator:

```sh
bun run db:invite          # One use, expires in 7 days
bun run db:invite 14 5     # Five uses, expires in 14 days
```

The code is displayed once; only its SHA-256 hash is stored. Missing, expired,
revoked and exhausted codes reject account creation. A code is consumed when the
account is created, before email confirmation; deleting an account does not refund
it. Plaintext codes are removed from Auth metadata.

Email confirmation uses Supabase's built-in provider and PKCE. Open the link in
the browser used to sign up; when confirming elsewhere, sign in manually.
Delivery and rate limits are those of the configured Supabase email provider.

## How it works

```text
browser ──▶ React + TanStack Router       navigation, forms, responsive UI
        ├─▶ Supabase Auth                email/password and sessions
        ├─▶ Supabase Storage             avatars and personal GIF uploads
        └─▶ Bun /api                     verifies the bearer token
              └─▶ Drizzle + pooler       transaction-local identity + RLS
                    └─▶ Supabase Postgres
```

Vite proxies `/api` to port 3001 in development. In production, the Bun server
serves both the built frontend and API from port 3001. A static-only host is not
sufficient for this architecture.

SQL migrations are the source of truth for schema, policies and Auth triggers.
Drizzle models provide typed queries; do not replace the migrations with
`drizzle-kit push`, which does not represent all Supabase security policies.

## Security and storage

Each API request verifies its bearer token with Supabase Auth. Database work runs
inside a transaction with verified claims and the `authenticated` role, so pooled
connections do not leak one user's identity into another request. Prepared
statements are disabled for transaction-mode pooling.

Invitation tables are private to the operator. Social data requires authentication.
Storage objects are public for rendering, while upload/delete policies restrict
writes to the owner's UUID folder. Avatars accept JPEG, PNG or WebP up to 5 MB;
the GIF library accepts GIF files up to 5 MB.

## Stack

React 19, TanStack Router and Vite for the browser. Tailwind and shadcn/Radix
primitives for controls. Bun for the API and package management. Drizzle and
postgres-js for SQL, Supabase for Auth, Postgres and Storage. Emoji Mart loads
on demand; YouTube and Spotify use native embeds instead of player SDKs.

## Develop

```sh
bun run dev          # Vite + Bun API
bun run typecheck
bun test             # PGlite database/RLS/API tests and UI helper tests
bun run build
bun run start        # Production server at http://127.0.0.1:3001
bun run db:check      # Live Drizzle connection and schema check
bun run db:studio    # Operator database inspection
```

Tests execute the actual SQL migrations in PGlite and exercise invitation
consumption, row ownership, pooled identities, Storage policies, API queries,
media URL parsing and error classification.

Before deployment, configure the public Auth Site URL and callback URLs, apply
migrations and place the Bun server behind HTTPS. See
[architecture and migration notes](docs/supabase-migration.md).

## Current boundaries

Legacy accounts and posts are not imported. Password recovery, OAuth, private
messages and email/password editing are not implemented. Community member lists
currently show up to 100 people; notifications cover replies from the last 24 hours.
The GIF picker searches a small bundled reaction catalog and your own uploads;
it does not search the wider internet. Page previews depend on publicly reachable
HTTP pages with usable metadata and may fall back to a plain link. Their bounded,
cached fetches validate public addresses and redirects; preview images are fetched
by the server rather than loaded from unverified third-party URLs in the browser.

## License

MIT — see [LICENSE](LICENSE). Interface icons use the MIT-licensed
[Pixelarticons](https://github.com/halfmage/pixelarticons) library. Active illustrations
are native pixel UI components; retained legacy unDraw assets have attribution in
[the illustration notes](src/assets/illustrations/README.md).
Bundled Google Noto Emoji animations use **CC BY 4.0**, independently of the app's
MIT license; sources, credits and license text are in [the GIF catalog notes](public/gifs/README.md).
