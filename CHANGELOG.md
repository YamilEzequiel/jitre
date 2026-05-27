# Changelog

All notable changes to **Jitre** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Public `/changelog` page in the app that renders this file as a timeline.
- Public `/license` page in the app that surfaces the PolyForm Noncommercial 1.0.0 terms.
- Dashboard footer with current version, GitHub repository link, and quick access to changelog & license.

### Changed

- Project license switched from PolyForm Internal Use 1.0.0 to **PolyForm Noncommercial 1.0.0** to explicitly disallow commercial reselling / SaaS resale while keeping the source open for noncommercial use.

---

## [0.1.0] — 2026-05-27

First tagged baseline. Snapshot of the auth & dashboard polish that landed in this session.

### Added

- Brand-panel canvas **hyperspeed effect** on the auth pages (left, dark side):
  - 220 stars in 3D perspective projection (`screen = (xy/z) * focal + center`).
  - Hover accelerates speed from 1× to 4× with eased lerp — classic warp-drive look.
  - Vanishing point follows the cursor at 30% range (you "steer" into the warp).
  - HSLA brand-palette strokes (indigo / violet / purple / fuchsia / blue) on a dark bg with `globalCompositeOperation = 'lighter'` for additive neon glow.
  - Trail/motion-blur via per-frame translucent dark rect — no history array needed.
  - Respects `prefers-reduced-motion`, DPR-aware (capped at 2), ResizeObserver-driven canvas resize, RAF runs in `runOutsideAngular`.
- Branded **J logo** on auth pages (matches favicon gradient indigo→violet→fuchsia).
- Live indicator badge with animated ping dot on the brand-panel.
- **Custom branded checkboxes** in login and register (peer + `appearance-none` + sibling SVG check) — full control over checked/unchecked states, no reliance on `accent-color`.
- Auth-light backdrop on the form side: static, professional, indigo + sky blur blobs with subtle grid overlay.

### Changed

- Removed the fake "Maya R." testimonial from the auth brand-panel.
- Replaced the comparative "Jira + Trello + Tempo · one flow" pitch with the branded line **"One workspace · Zero context switching"**.
- Auth form inputs: `bg-slate-100/80 border-slate-200` → `bg-white border-slate-300` with `focus:border-indigo-500 focus:ring-indigo-500/25`. Cleaner, no longer reads as disabled.
- Mobile brand bar now uses the same inline J-logo gradient as desktop.

### Fixed

- **Inputs "turned gray" on autofill**: added scoped `-webkit-box-shadow: 0 0 0 1000px #ffffff inset` to `jt-auth-layout input:-webkit-autofill` in `styles.css`. Chrome / Edge no longer override our `bg-white` with their autofill color.
- AI Settings panel: `by-user` / `by-operation` endpoints now receive the required `period` query param.

### Removed

- Static RAF-driven CSS blob orbs on the brand-panel (replaced by the hyperspeed canvas).
- Dual-side animated backdrop on the form column (form side is now intentionally clean).

---

## Conventions

- **Version bumps**: bump `version` in root `package.json` and the matching workspace `package.json` files together.
- **Section order per release**: Added → Changed → Fixed → Removed → Security → Deprecated.
- **Each release** must list a `## [X.Y.Z] — YYYY-MM-DD` heading. The `/changelog` page parses this format.
- **Unreleased section** at the top accumulates work that has merged but not yet been tagged.

[Unreleased]: https://github.com/YamilEzequiel/jitre/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/YamilEzequiel/jitre/releases/tag/v0.1.0
