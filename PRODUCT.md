# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Angular v22 (frontend + admin SSR), Node 24 Express backend, MySQL 8, Docker Compose.

## Users
- **Fans / community members** — Thai-speaking followers of BoyAlone99 who earn Alone Coin by following on Twitch / YouTube, subscribing, boosting the Discord, claiming channel points, or accepting the LFG role; redeem the coin for rewards.
- **Admin / streamer** — sole operator behind `BoyAlone99` who manages reward catalog, grants or revokes coins, moderates users (disable accounts), configures Twitch channel rewards + EventSub subscription, posts announcement, curates the SSO allowlist.

## Product Purpose
A self-hosted loyalty + rewards platform for a single Thai livestreamer community, where "Alone Coin" is the only currency and is earned only by supportive actions across Twitch, YouTube, and Discord. Success = fans redeem rewards, admin can run the whole thing from one local panel.

## Positioning
A single Thai-language dashboard that binds Twitch (follow, channel points, sub tenure via EventSub), YouTube (subscribed check via Google OAuth), and Discord (booster / LFG role) into one verifiable coin balance, plus a portable SSO (`/sso`) that approved external sites can use to authenticate the same user. Off-the-shelf bots only handle one platform; BoyAlone99's homegrown pipeline covers all four plus a custom reward catalog with per-reward delivery requirements.

## Operating Context
- Frontend runs at `https://jft-backend.pwisetthon.com` (public); admin at `http://192.168.31.215:4001` (local only, allowed hosts pin to LAN IPs).
- Backend on `:3000`, MySQL on `:3306`, Docker Compose orchestrates three services + volume.
- Fans visit on desktop or mobile, mostly during a live stream. Admin runs the panel from a workstation.
- Content flow: Twitch EventSub → backend → `coin_history` + `users.alone_coin`; reward redemption → backend → `redemption_history`.
- Local-only admin therefore uses 2FA JWT (`ADMIN_2FA_SECRET`) and a hard-coded host allowlist (`allowedHosts`).

## Capabilities and Constraints
- OAuth providers: Discord, Twitch, Google/YouTube (strict `youtube.readonly` scope, channel-id verification against `YOUTUBE_CHANNEL_ID`).
- Reward model: `enabled`, `claimable`, `stock`, `one_per_user`, `sort_order` (drag-reorder), `contact_type` (email / Epic ID / Warframe IGN).
- Users: optional `disabled` flag blocks redemption, claim, and Twitch channel-points crediting (403).
- Public read endpoints: `/rewards` (filtered), `/settings` (claim toggle, alert bar), `/leaderboard` (top 10), `/sso/verify?redirect_uri=`.
- Admin endpoints gated by `x-admin-token` JWT and 2FA on first login.
- Privacy / Terms + Google site-verification meta are first-class routes (`/terms`, `/privacy`).
- Constraints: one operator only, no multi-tenant admin, no public admin, exact-match redirect_uri SSO allowlist.
- Open: future signing of SSO payload (HMAC or JWT) — currently base64 JSON, no signature.

## Brand Commitments
- Name: **BoyAlone99** (small word "Community" remains only as header sub-label; "Alone Coin" is the product term in copy).
- Voice: warm, Thai-first, hand-lettered; the committed visual world is the **paper theme** (cream `#f8f5ec`, peach `#e16b50`, gold `#e0b44f`, mint `#5d8278`, lilac accents; "Playpen Sans Thai" handwriting font; 2px ink-stroke borders; 8px hard shadows).
- No follow count, no third-party ads, no public DMs.

## Evidence on Hand
- Working SSR builds for `frontend` + `admin`, MySQL schema in `backend/schema.sql`, OAuth client IDs in `frontend/src/environments/environment.ts`.
- Manual channel-reward how-to image at `frontend/public/icon-1.png`.
- Real founder audience (Thai viewers on Twitch + YouTube); no fabricated testimonials exist and future work must not invent any.

## Product Principles
1. **Coin only when verified.** A reward or coin grant always passes a server-side proof (sub, follow, role, channel-points); UI hints are advisory, never authoritative.
2. **One operator, full control.** Every admin feature lives in the local admin panel and never on a public surface.
3. **Thai first, English secondary.** All user-facing copy in Thai; route names + variable names stay English.
4. **Self-hosted and portable.** Docker Compose deploys the whole stack; SSO lets approved external sites consume identity without re-implementing it.
5. **Safe defaults.** Disabled users, unclaimable rewards, disabled external sites all 403 by default; explicit enable is the only path.

## Accessibility & Inclusion
- WCAG AA color contrast on the paper palette (verified on cream background).
- All claim / check actions are real `<button>` elements, not `<a>` for actions.
- Thai-friendly font (Playpen Sans Thai) is the primary typeface to keep loops + diacritics readable.
