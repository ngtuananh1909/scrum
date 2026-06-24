# Changelog

## Unreleased

### Added
- `client/public/brand/` — drop-in logo assets (favicon, mark, logo, wordmark) with usage guide in `brand/README.md`.
- Top-level `README.md` rewrite with feature list, quick start, full API table, troubleshooting, and logo replacement guide.
- `LICENSE` (MIT).

### Changed
- Lobby header now uses `logo-wordmark.svg` instead of plain text.
- In-game top nav uses `logo.svg`.
- Root `layout.tsx` declares `/brand/favicon.svg` as the app icon.
- Lobby form inputs given explicit `id` and `name` (fixes the "form field should have an id or name" console warning).

### Removed
- Unused default Next.js SVG scaffolds from `client/public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`).
