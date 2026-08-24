# OttLib — Motion, Interaction & Feedback Audit

Reviewed at commit `d55e1d7`, against the working tree. No code changed.

---

## 0. What the codebase actually is today

**Product.** A single-user / trusted-LAN personal movie library. Browse-first: a poster wall
(`LibraryPage`) is the home screen and the surface people spend 90% of their time on. Six routes:
library, movie detail, shelves, shelf detail, torrent search, settings. Three long-running background
jobs (scan, auto-accept backfill, metadata refresh) poll at 1200 ms and surface through a top banner.
No accounts, no charts, no dashboards.

**Stack, verified.**

| Concern | What's installed | Notes |
|---|---|---|
| UI | React `19.2.8` | — |
| Routing | `react-router-dom` `7.18.2` | **Supports `viewTransition` on `<Link>` / `navigate()`** |
| Data | `@tanstack/react-query` `5.66.x` | optimistic updates already used for watched-state |
| Styling | Tailwind `3.4.19`, `darkMode: 'class'` | no plugins |
| Animation libs | **none** | no Framer Motion, GSAP, React Spring, Lottie, Three.js |
| Build | Vite 6 | — |

**Existing motion inventory — the entire list.**

- `animate-spin` — 2 usages: [PlayButton.tsx:58](packages/client/src/components/PlayButton.tsx:58), [MovieActionButtons.tsx:33](packages/client/src/components/MovieActionButtons.tsx:33)
- Bare Tailwind `transition` (150 ms, `cubic-bezier(.4,0,.2,1)`, registers ~12 properties incl. `box-shadow`, `filter`, `backdrop-filter`) — 14 usages
- `transition-opacity duration-200` — 1 usage: [LibraryPage.tsx:53](packages/client/src/pages/LibraryPage.tsx:53)
- `active:scale-95` — **1 usage in the whole app**: [PosterCard.tsx:33](packages/client/src/components/PosterCard.tsx:33)
- `hover:-translate-y-1` — [PosterCard.tsx:28](packages/client/src/components/PosterCard.tsx:28), [ShelfCard.tsx:5](packages/client/src/components/ShelfCard.tsx:5)
- `hover:scale-105` — FAB + logo, [App.tsx:12](packages/client/src/App.tsx:12), [App.tsx:32](packages/client/src/App.tsx:32)

**Zero occurrences** of: `prefers-reduced-motion`, `motion-safe:`, `motion-reduce:`, `@keyframes`,
`will-change`, any custom easing, any duration token.

**The design system is real, but colour-only.** [styles.css](packages/client/src/styles.css) defines 34 semantic
colour tokens as `rgb` triples with light/dark variants, mapped in
[tailwind.config.ts](packages/client/tailwind.config.ts). It's a genuinely well-built token layer — and there is
**no equivalent layer for motion**. That's the single structural gap; every recommendation below hangs
off fixing it first.

### Recommendation on libraries: add none.

Framer Motion is ~34 kB gzip of runtime for an app whose entire current motion budget is two spinners.
Everything in this plan is achievable with Tailwind keyframes, CSS custom properties, the native View
Transition API (already reachable via Router 7.18's `viewTransition` prop), and ~35 lines of
`element.animate()` for one FLIP reorder. **Zero new dependencies.** The two places a JS animation
library would normally earn its keep — shared-layout transitions and drag reorder — are covered by
View Transitions and WAAPI FLIP respectively.

---

## 1. Motion system — proposed tokens

Mirrors the existing colour-token pattern exactly: CSS custom properties in `styles.css`, surfaced as
Tailwind utilities in `tailwind.config.ts`.

### 1.1 `packages/client/src/styles.css` — `@layer base { :root { … } }`

```css
/* Durations — three tiers people actually perceive, plus two edges. */
--motion-instant: 90ms;   /* colour/opacity on hover, focus ring       */
--motion-fast:    150ms;  /* press, chip, badge, dropdown              */
--motion-base:    220ms;  /* the default: enter, cross-fade, FLIP      */
--motion-slow:    300ms;  /* sheets, banner collapse, layout reflow    */
--motion-slower:  400ms;  /* count-up, progress fill, one-off reveals  */

/* Easing */
--ease-standard: cubic-bezier(0.2, 0, 0, 1);        /* enter + move: fast out, soft land */
--ease-exit:     cubic-bezier(0.4, 0, 1, 1);        /* leave: accelerate away            */
--ease-emphasis: cubic-bezier(0.34, 1.56, 0.64, 1); /* overshoot ~7%: press release, pop */
```

**On spring physics.** Real springs need a JS integrator. The honest substitutes, in order of cost:

1. `--ease-emphasis` above (a cubic-bezier that overshoots ~7%) — use for press-release, badge pops,
   chip entrances. Covers 95% of what "springy" means here.
2. CSS `linear()` easing (Chrome 113+, Safari 17.2+, Firefox 112+) for a true sampled spring curve, if
   the FAB press and poster press should feel physical. One extra token, no JS.
3. Do **not** add React Spring for this.

My recommendation: ship `--ease-emphasis`; add a `linear()` spring token only if the press still feels
flat in review.

### 1.2 Reduced motion — token collapse, not a blanket `*` kill-switch

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-instant: 1ms; --motion-fast: 1ms; --motion-base: 1ms;
    --motion-slow: 1ms;    --motion-slower: 1ms;
  }
  /* Kill decorative loops; keep spinners — a loading indicator is information, not decoration. */
  .shimmer::after { animation: none; }
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation-duration: 1ms !important; }
}
```

Rationale for not using the usual `*, *::before, *::after { animation-duration: .01ms !important }`
sledgehammer: it silently disables `animate-spin` on [PlayButton.tsx:58](packages/client/src/components/PlayButton.tsx:58), which is
the only signal that a LAN playback handoff is in flight. WCAG 2.3.3 targets *non-essential* motion.
Because every duration in this system flows through a variable, collapsing the variables is both
complete and surgical.

### 1.3 `packages/client/tailwind.config.ts` — `theme.extend`

```ts
future: { hoverOnlyWhenSupported: true },   // see D2 — one line, fixes sticky hover app-wide
theme: { extend: {
  transitionDuration: {
    instant: 'var(--motion-instant)', fast: 'var(--motion-fast)',
    base: 'var(--motion-base)', slow: 'var(--motion-slow)', slower: 'var(--motion-slower)',
  },
  transitionTimingFunction: {
    standard: 'var(--ease-standard)', exit: 'var(--ease-exit)', emphasis: 'var(--ease-emphasis)',
  },
  keyframes: {
    'fade-in':    { from: { opacity: '0' }, to: { opacity: '1' } },
    'rise-in':    { from: { opacity: '0', transform: 'translate3d(0,8px,0)' },
                    to:   { opacity: '1', transform: 'none' } },
    'pop-in':     { from: { opacity: '0', transform: 'scale(.94)' },
                    to:   { opacity: '1', transform: 'none' } },
    'sheet-in':   { from: { transform: 'translate3d(0,100%,0)' }, to: { transform: 'none' } },
    'toast-in':   { from: { opacity: '0', transform: 'translate3d(-12px,0,0) scale(.97)' },
                    to:   { opacity: '1', transform: 'none' } },
    shimmer:      { from: { transform: 'translate3d(-100%,0,0)' },
                    to:   { transform: 'translate3d(100%,0,0)' } },
    'draw-check': { from: { strokeDashoffset: '24' }, to: { strokeDashoffset: '0' } },
  },
  animation: {
    'fade-in':    'fade-in var(--motion-base) var(--ease-standard) both',
    'rise-in':    'rise-in var(--motion-base) var(--ease-standard) both',
    'pop-in':     'pop-in var(--motion-fast) var(--ease-emphasis) both',
    'sheet-in':   'sheet-in var(--motion-slow) var(--ease-standard) both',
    'toast-in':   'toast-in var(--motion-base) var(--ease-standard) both',
    shimmer:      'shimmer 1400ms linear infinite',
    'draw-check': 'draw-check var(--motion-base) var(--ease-standard) both',
  },
}}
```

### 1.4 Shared interaction constants

Three string constants, colocated the same way [PlayButton.tsx:8](packages/client/src/components/PlayButton.tsx:8) and
[MovieActionButtons.tsx:6](packages/client/src/components/MovieActionButtons.tsx:6) already colocate button classes. New file
`packages/client/src/components/interactionStyles.ts`:

```ts
export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
export const pressable =
  'transition-transform duration-fast ease-emphasis active:scale-[0.97] active:duration-instant';
export const liftable =
  'transition-[transform,box-shadow] duration-base ease-standard hover:-translate-y-1';
```

### 1.5 Token map — which token for which situation

| Situation | Duration | Easing |
|---|---|---|
| Hover colour, focus ring, border colour | `instant` | `standard` |
| Button press down / release | `instant` / `fast` | `emphasis` |
| Dropdown, chip, badge enter | `fast` | `emphasis` |
| Element exit (anything) | `fast` | `exit` |
| Card enter, cross-fade, FLIP move, image fade | `base` | `standard` |
| Modal panel (desktop), grid reflow | `base` | `standard` |
| Bottom sheet, banner collapse/expand | `slow` | `standard` |
| Progress fill, count-up, first-run reveal | `slower` | `linear` / `standard` |
| Page/route transition | `base` | `standard` |

---

## 2. Findings and recommendations

Format per item: **Where → Problem → Effect → Behaviour → Timing → Implementation → Priority → Perf/A11y.**

---

### A. Foundations

#### A1 · Motion token layer does not exist — P0

- **Component/page:** [styles.css](packages/client/src/styles.css), [tailwind.config.ts](packages/client/tailwind.config.ts)
- **Problem:** every transition in the app is either Tailwind's bare 150 ms default or one hardcoded
  `duration-200`. There is no way to tune the app's feel, and no shared vocabulary, so every new
  animation will be an independent guess. The colour system is disciplined; motion has no system at all.
- **Effect:** the token set in §1.
- **Behaviour:** no runtime behaviour; it is the substrate for everything below.
- **Timing:** n/a
- **Implementation:** §1.1 + §1.3. ~40 lines across two files.
- **Priority:** **P0** — blocking dependency for every other item.
- **Perf/A11y:** CSS custom properties in transitions resolve at style time, no runtime cost. Enables
  §1.2 to be complete by construction.

#### A2 · `prefers-reduced-motion` is entirely unhandled — P0

- **Component/page:** global
- **Problem:** zero occurrences anywhere. Today it barely matters (two spinners); the moment items
  B–L land, a user with vestibular sensitivity gets a poster wall that lifts, fades, staggers and
  slides with no escape.
- **Effect:** token collapse per §1.2.
- **Behaviour:** all transitions/animations become effectively instantaneous; spinners and determinate
  progress bars keep running (they convey state, not decoration); view-transition groups snap.
- **Timing:** 1 ms
- **Implementation:** §1.2, one media block in `styles.css`.
- **Priority:** **P0** — ship in the same commit as A1, never after.
- **Perf/A11y:** WCAG 2.3.3 (AAA) and 2.2.2. Deliberately preserves essential motion.

---

### B. Page / route transitions

#### B1 · Routes swap as a hard cut — P1

- **Component/page:** [App.tsx:32](packages/client/src/App.tsx:32) (`<Routes>`), [MovieDetailPage.tsx:33](packages/client/src/pages/MovieDetailPage.tsx:33)
- **Problem:** navigation replaces the entire `<main>` in one frame. It's worst on library → detail,
  where `MovieDetailPage` also fires `window.scrollTo({ top: 0, behavior: 'auto' })` on mount — so the
  user gets a content swap *and* an instantaneous scroll jump in the same frame, with no signal that
  navigation (rather than a re-render) happened.
- **Effect:** native View Transition cross-fade.
- **Behaviour:** outgoing route fades out over 90 ms while the incoming fades in over 180 ms with a
  4 px rise. Back-navigation reverses the rise direction. No horizontal slide — it would fight
  `useLibraryScrollRestoration`'s restore.
- **Timing:** 180 ms `--ease-standard` in; 90 ms `--ease-exit` out
- **Implementation:** Router 7.18 already ships this. Add `viewTransition` to `<Link>`s in
  [App.tsx](packages/client/src/App.tsx), [PosterCard.tsx](packages/client/src/components/PosterCard.tsx), [ShelfCard.tsx](packages/client/src/components/ShelfCard.tsx) and pass
  `{ viewTransition: true }` to the `navigate()` calls in [PosterCard.tsx:19](packages/client/src/components/PosterCard.tsx:19) and
  [useBackToLibrary.ts](packages/client/src/hooks/useBackToLibrary.ts). Then style `::view-transition-old(root)` /
  `::view-transition-new(root)` in `styles.css`. No JS.
- **Priority:** **P1**
- **Perf/A11y:** the compositor drives it; no main-thread work. In browsers without the API the prop
  is a silent no-op. Must be covered by §1.2 — view transitions are a common vestibular trigger.

#### B2 · Poster → detail has no continuity (shared element) — P1 (premium)

- **Component/page:** [PosterCard.tsx:29](packages/client/src/components/PosterCard.tsx:29) → [MovieDetailPage.tsx:53](packages/client/src/pages/MovieDetailPage.tsx:53)
- **Problem:** the tapped poster (2:3, ~140 px wide in the grid) and the detail poster (2:3, 220 px)
  are the same image at two sizes, but the transition throws it away and redraws. This is the
  most-repeated navigation in the product and the most obvious place premium feel is being left on
  the table.
- **Effect:** shared-element morph — the tapped poster grows into the detail poster.
- **Behaviour:** on click, set `style.viewTransitionName = 'poster'` on **only** the clicked `<img>`;
  the detail page's poster carries the same name. The browser tweens position, size and radius. Clear
  the name in a `finished.then()` so the next tap can claim it. Backdrop image
  ([MovieDetailPage.tsx:51](packages/client/src/pages/MovieDetailPage.tsx:51)) fades in behind at 240 ms.
- **Timing:** 260 ms `--ease-standard`
- **Implementation:** ~15 lines. `openMovie` at [PosterCard.tsx:15](packages/client/src/components/PosterCard.tsx:15) already intercepts
  the click, so the name assignment slots in there with no structural change.
- **Priority:** **P1**, after B1 — depends on it.
- **Perf/A11y:** `view-transition-name` must be unique per document; assigning it to all cards at once
  breaks the transition, hence assign-on-click. Suppressed under reduced motion (§1.2).

---

### C. Modals, sheets, dropdowns, tooltips

#### C1 · Modal has no enter animation, and on mobile it's a sheet that doesn't slide — P0

- **Component/page:** [Modal.tsx:63–66](packages/client/src/components/Modal.tsx:63) — used by 7 dialogs:
  `LibraryFilters`, `MatchReviewDialog`, `MetadataRefreshDialog`, `MovieShelfDialog`,
  `ShelfNameDialog`, `ShelfSelectionDialog`
- **Problem:** `element.showModal()` paints the dialog and its `backdrop:bg-overlay/80` in a single
  frame. On mobile the panel is bottom-anchored (`items-end … sm:items-center`, line 65) — it is
  structurally a bottom sheet, and bottom sheets that appear without sliding read as a rendering
  glitch rather than a deliberate surface. This is the most-touched interactive surface after the
  poster wall.
- **Effect:** backdrop fade + responsive panel entrance.
- **Behaviour:**
  - Backdrop: `opacity 0 → 1`, 200 ms.
  - Panel, `< 640 px`: `translate3d(0,100%,0) → none`, 300 ms `--ease-standard` (sheet).
  - Panel, `≥ 640 px`: `opacity 0 → 1` + `scale(.96) → 1`, 220 ms `--ease-standard`.
- **Timing:** 200 / 300 / 220 ms as above
- **Implementation:** `@starting-style` on `dialog[open]` and `dialog[open]::backdrop` in `styles.css`
  — no JS, no state, works with the current mount-on-open pattern. A media query splits sheet from scale.
- **Priority:** **P0**
- **Perf/A11y:** `transform`/`opacity` only. Native `<dialog>` keeps its focus trap and inert
  background untouched. Focus restoration ([Modal.tsx:57](packages/client/src/components/Modal.tsx:57)) is unaffected.

#### C2 · Modal exit is impossible without a refactor — P2 (deliberately deferred)

- **Component/page:** [Modal.tsx:63](packages/client/src/components/Modal.tsx:63), plus each caller's own guard
  (e.g. [ShelfSelectionDialog.tsx:56](packages/client/src/components/ShelfSelectionDialog.tsx:56), [MovieShelfDialog.tsx:24](packages/client/src/components/MovieShelfDialog.tsx:24))
- **Problem:** `if (!open) return null` at both the Modal level *and* inside most callers means React
  unmounts the `<dialog>` the instant `open` flips false. CSS exit transitions never get a chance to
  run — `transition-behavior: allow-discrete` cannot help, because the element is gone from the tree.
- **Effect:** panel fades and drops 8 px (or slides down on mobile) on close.
- **Timing:** 150 ms `--ease-exit`
- **Implementation:** requires a `useExitTransition(open)` hook inside `Modal` that keeps rendering
  for one animation cycle after `open` flips, **and** changing each caller's early return so it stops
  unmounting Modal. Those caller guards exist to reset dialog-local state (search filters, selected
  IDs) — that behaviour must be preserved via `key={open}` or an explicit reset, or dialogs will
  reopen dirty.
- **Priority:** **P2** — an exit animation on a surface that is leaving is the lower-value half of the
  pair, and the refactor touches 6 files with real state-reset risk. Ship C1 alone first; it captures
  most of the perceived polish.
- **Perf/A11y:** if built, exit must be skippable — a second Escape press should close immediately.

#### C3 · Shelf card dropdown pops in and out — P1

- **Component/page:** [ShelfCardMenu.tsx:29](packages/client/src/components/ShelfCardMenu.tsx:29)
- **Problem:** `{open && <div role="menu">}` — the menu materialises with no origin, so it reads as
  detached from the `⋯` button that spawned it.
- **Effect:** origin-anchored scale + fade.
- **Behaviour:** `transform-origin: top right`, `scale(.94) → 1` with `opacity 0 → 1`. Menu items do
  **not** stagger — three items is too few to justify it, and staggering would delay the third past
  the point of usefulness.
- **Timing:** 150 ms `--ease-emphasis` in; exit skipped (same unmount constraint as C2, and a 3-item
  menu doesn't warrant the machinery)
- **Implementation:** `className="… origin-top-right animate-pop-in"` — one utility from §1.3.
- **Priority:** **P1** (trivial)
- **Perf/A11y:** transform + opacity. Existing outside-press and Escape handlers
  ([ShelfCardMenu.tsx:17–24](packages/client/src/components/ShelfCardMenu.tsx:17)) unaffected. **Worth fixing alongside:** the
  menu items have no `focus-visible` ring (see M4), and there is no roving-tabindex arrow-key
  navigation despite `role="menu"`.

#### C4 · Tooltips — do not build an animated tooltip system

- **Component/page:** `title=` attributes throughout ([PosterCard.tsx:33](packages/client/src/components/PosterCard.tsx:33),
  [App.tsx:12](packages/client/src/App.tsx:12), [MediaInfoPanel.tsx](packages/client/src/components/MediaInfoPanel.tsx), [MovieActionButtons.tsx](packages/client/src/components/MovieActionButtons.tsx))
- **Recommendation:** **leave them native.** They are free, accessible, work on keyboard focus, and
  every icon-only control already pairs `title` with `aria-label` + `.sr-only` text — the
  accessibility work is done correctly. A custom tooltip layer would add a positioning engine, a
  portal, hover-intent timers and a mobile story, to animate a surface nobody in this app waits on.
  Explicitly out of scope.

#### C5 · `<details>` scan history expands instantly — P2

- **Component/page:** [ScanHistoryList.tsx:22](packages/client/src/components/ScanHistoryList.tsx:22)
- **Problem:** native `<details>` toggles `display`, so the `<dl>` snaps open and shoves the sections
  below it down. Failed runs auto-open (`open={run.status === 'failed'}`), so a settings page with a
  failure in history jumps on mount.
- **Effect:** content fades and rises into place.
- **Behaviour:** `details[open] > dl { animation: rise-in }`. Do **not** attempt to animate the
  `<details>` height itself — that needs `grid-template-rows` wrappers or `calc-size()`, not worth it
  for a collapsed log entry.
- **Timing:** 220 ms `--ease-standard`
- **Implementation:** one CSS rule.
- **Priority:** **P2**
- **Perf/A11y:** opacity + transform only.

---

### D. Buttons — hover / press / loading / success

#### D1 · Press feedback exists on exactly one control in the entire app — P0

- **Component/page:** every button. The sole exception is the watched toggle,
  [PosterCard.tsx:33](packages/client/src/components/PosterCard.tsx:33)
- **Problem:** the app is explicitly designed for phone use (`FEATURES.md`: "Android access is via the
  phone's browser"; there's a LAN address panel in Settings for exactly this). On touch there is no
  hover — so every FAB, every dialog footer button, Play, Send to qBittorrent, Accept and Save gives
  the user **zero** feedback between tap and network response. On slow LAN metadata calls that's
  hundreds of milliseconds of apparent unresponsiveness.
- **Effect:** universal press-down scale.
- **Behaviour:** `active:scale-[0.97]`, snapping down in 90 ms and releasing over 150 ms with the
  overshoot curve so the release feels physical. Icon-only 40 px buttons use `0.94` — the effect must
  be proportionally larger on small targets to be visible.
- **Timing:** down `--motion-instant`, up `--motion-fast` `--ease-emphasis`
- **Implementation:** the `pressable` constant from §1.4, appended to the existing class strings:
  `floatingButtonClassName` ([App.tsx:12](packages/client/src/App.tsx:12)), `primaryButtonClassName` /
  `compactButtonClassName` ([PlayButton.tsx:8–9](packages/client/src/components/PlayButton.tsx:8)), `secondaryButtonClassName`
  ([MovieActionButtons.tsx:6](packages/client/src/components/MovieActionButtons.tsx:6)), `buttonClassName`
  ([RevealInFolderButton.tsx:6](packages/client/src/components/RevealInFolderButton.tsx:6)), and inline on the dialog footer buttons.
- **Priority:** **P0** — highest feel-per-line-changed ratio in this document.
- **Perf/A11y:** compositor-only. Must be inside §1.2's collapse. `:active` fires reliably on iOS for
  `<button>`/`<a>`; no `touchstart` shim needed.

#### D2 · `hover:` styles latch on after tap on touch devices — P0

- **Component/page:** global; most visible on [App.tsx:12](packages/client/src/App.tsx:12) (`hover:scale-105` FABs) and
  [PosterCard.tsx:28](packages/client/src/components/PosterCard.tsx:28) (`hover:-translate-y-1`)
- **Problem:** Tailwind 3.4 does **not** wrap `hover:` in `@media (hover: hover)` by default. On
  mobile browsers the hover state sticks after tap until the user taps elsewhere. So a tapped FAB
  stays 5% enlarged, and a tapped poster stays lifted with an accent ring after you navigate back to
  it — it currently reads as a selection state that can't be cleared.
- **Effect:** hover styles apply only on hover-capable pointers.
- **Behaviour:** unchanged on desktop; on touch, hover styles never apply and D1's press state is the
  only feedback, which is correct.
- **Timing:** n/a
- **Implementation:** `future: { hoverOnlyWhenSupported: true }` in
  [tailwind.config.ts](packages/client/tailwind.config.ts). **One line.**
- **Priority:** **P0**
- **Perf/A11y:** removes work on mobile rather than adding it. Worth a quick pass afterwards for
  anywhere `hover:` was carrying meaning rather than affordance — I found none.

#### D3 · Play gives no feedback at the button — P1

- **Component/page:** [PlayButton.tsx:34–41](packages/client/src/components/PlayButton.tsx:34)
- **Problem:** on the local path, success calls `show('Opening your default player.', 'success')` and
  the button snaps straight back to the play glyph. The toast renders at **top-left** on desktop and
  bottom on mobile ([ToastProvider.tsx:28](packages/client/src/components/ToastProvider.tsx:28)) — nowhere near the button the user
  just pressed. The primary action of the entire product confirms itself somewhere the user isn't
  looking.
- **Effect:** in-place success morph.
- **Behaviour:** spinner → check-mark stroke draws on, button background briefly shifts to `success`,
  label reads "Opening…" for 1200 ms, then eases back to the resting Play state. Keep the toast for
  the accessibility announcement.
- **Timing:** check draw 220 ms `--ease-standard`; hold 1200 ms; return 220 ms
- **Implementation:** widen the existing `working` boolean to `'idle' | 'working' | 'done'`; the icon
  swap is already a ternary at [PlayButton.tsx:58](packages/client/src/components/PlayButton.tsx:58), so this is a third branch plus a
  `setTimeout`. Check-draw uses the `draw-check` keyframe (§1.3) with `stroke-dasharray: 24`.
- **Priority:** **P1**
- **Perf/A11y:** SVG `stroke-dashoffset` on a 20 px icon is negligible. Keep the `aria-label` stable
  across states so screen readers aren't spammed; the toast already carries the announcement via
  `role="status"`.

#### D4 · Loading spinners are fine — keep as-is

[PlayButton.tsx:58](packages/client/src/components/PlayButton.tsx:58) and [MovieActionButtons.tsx:33](packages/client/src/components/MovieActionButtons.tsx:33) swap a
partial-arc `animate-spin` in place while preserving the button's label and width, so there's no
layout jump. This is already correct. Do not replace with skeletons or progress bars — the operations
are sub-second and indeterminate. **Only change:** exempt these from §1.2's reduced-motion collapse
(already handled by the token approach).

#### D5 · The watched toggle — the app's most-repeated gesture — barely acknowledges itself — P1

- **Component/page:** [PosterCard.tsx:29,33](packages/client/src/components/PosterCard.tsx:29)
- **Problem:** tapping the toggle flips the SVG child from `<circle>` to `<path>` in one frame, and
  the poster's `opacity-70` dim uses `transition-opacity` with no duration token (inherits 150 ms).
  Because [PosterGrid.tsx:14](packages/client/src/components/PosterGrid.tsx:14) passes `silent: true`, there is deliberately no
  toast either. Net result: the single most-repeated action in a media library produces a 24 px icon
  swap and a slight dim. Optimistic updating is already wired
  ([useMovies.ts:36–43](packages/client/src/hooks/useMovies.ts:36)), so the response is instant — it just isn't *felt*.
- **Effect:** check-mark draw + a one-shot ring pulse.
- **Behaviour:** on mark-watched, the check strokes on over 220 ms while a `ring-success` pulse
  expands from the button and fades (scale 1 → 1.6, opacity .5 → 0). Poster dim eases over 300 ms so
  the state change reads as settling rather than flicker. On unmark, no pulse — just the reverse fade;
  undoing shouldn't be celebrated.
- **Timing:** check 220 ms `--ease-standard`; pulse 400 ms `--ease-exit`; dim 300 ms
- **Implementation:** `draw-check` keyframe (§1.3) on the `<path>`; pulse as an `::after`
  pseudo-element keyed to a transient state. Narrow the poster's `transition-opacity` to
  `duration-slow`.
- **Priority:** **P1**
- **Perf/A11y:** the pulse must be `transform`/`opacity` on a pseudo-element, never `box-shadow`
  (which repaints). `aria-pressed` already communicates state correctly. **Also flag (not motion):**
  the toggle is `h-6 w-6` — 24 px, well under the 44 px touch-target guidance, and sits 12 px from the
  selection checkbox. Enlarge the hit area with a transparent `::before` **before** adding press
  feedback, or the animation will fire on mis-taps and make the problem more visible, not less.

---

### E. Toasts

#### E1 · Toasts appear, vanish, and shove each other with no motion — P0

- **Component/page:** [ToastProvider.tsx:28](packages/client/src/components/ToastProvider.tsx:28)
- **Problem:** three separate issues in one component.
  1. Toasts mount and unmount instantly. A success message that appears and disappears without
     transition is easy to miss entirely — and this is how *every* mutation in the app confirms
     itself (`useMovies`, `useShelves`, `useSettings` all call `show()` on success and error).
  2. The stack holds up to 4 (`.slice(-4)`). When a middle toast's `setTimeout` fires, the ones below
     teleport upward.
  3. Duplicate suppression increments a `count` and renders `(2)`, `(3)` inline
     ([ToastProvider.tsx:21–23](packages/client/src/components/ToastProvider.tsx:21)). The text mutates in place with no signal, so
     repeated identical events — very common during a scan — look like nothing happened.
- **Effect:** directional entrance, soft exit, animated stack reflow, count pop.
- **Behaviour:**
  - Enter: desktop (top-left anchor) slides in from `translateX(-12px)` + `scale(.97)` + fade.
    Mobile (`sm:bottom-24`) rises from `translateY(12px)`.
  - Exit: fade + `translateX(-8px)`, then the stack closes the gap.
  - Stack reflow: FLIP the remaining toasts, 220 ms.
  - Count: the `(n)` suffix pops with `--ease-emphasis` on each increment.
- **Timing:** enter 220 ms `--ease-standard`; exit 150 ms `--ease-exit`; reflow 220 ms
- **Implementation:** enter is the `toast-in` keyframe (§1.3) — free, no state. Exit needs a `leaving`
  flag on the toast record and a delayed `dismiss`; the `dismiss` callback at
  [ToastProvider.tsx:17](packages/client/src/components/ToastProvider.tsx:17) is already centralised, so this is contained. Reflow via
  CSS `transition: translate` plus FLIP measurement, ~20 lines.
- **Priority:** **P0** for enter + count-pop; **P1** for exit + reflow.
- **Perf/A11y:** at most 4 elements. Critically: `role="alert"` (errors) and `role="status"` must be
  announced immediately — **do not** delay mounting for an entrance animation; animate after mount.
  Error toasts have `undefined` timeout ([ToastProvider.tsx:14](packages/client/src/components/ToastProvider.tsx:14)) and never auto-dismiss,
  which is correct — don't change it.

#### E2 · Auto-dismiss has no visible countdown — P2

- **Component/page:** [ToastProvider.tsx:14](packages/client/src/components/ToastProvider.tsx:14)
- **Problem:** success toasts vanish at 4 s and info at 6 s with no warning. That matters specifically
  because success toasts can carry an **Undo** action ([useMovies.ts:52](packages/client/src/hooks/useMovies.ts:52)) — the user
  has an invisible 4-second deadline to act.
- **Effect:** 2 px draining progress rail along the toast's bottom edge.
- **Behaviour:** `scaleX(1) → scaleX(0)`, `transform-origin: left`, linear over the tone's timeout.
  Pauses on hover/focus within the toast. Errors get no rail — they don't expire.
- **Timing:** matches `toastTimeoutByTone`; `linear`
- **Implementation:** one `<span>` plus a CSS animation with `animation-duration` set inline from the
  tone's timeout. Hover pause = `animation-play-state: paused`.
- **Priority:** **P2** — raise to P1 if Undo gets used more.
- **Perf/A11y:** `transform` only; 4 concurrent at most. Hover-pause is a WCAG 2.2.1 courtesy.

---

### F. Cards, grids, lists

#### F1 · Poster hover animates twelve properties to change two — P1

- **Component/page:** [PosterCard.tsx:28](packages/client/src/components/PosterCard.tsx:28), [ShelfCard.tsx:5](packages/client/src/components/ShelfCard.tsx:5)
- **Problem:** `transition hover:-translate-y-1 hover:ring-accent` — Tailwind's bare `transition`
  registers transitions on `color, background-color, border-color, fill, stroke, opacity, box-shadow,
  transform, filter, backdrop-filter` and more. Only `transform` and the ring change. Every hover on a
  wall of 100+ cards asks the style engine to evaluate transitions it will never use, and it means
  **any** future colour change on these cards will silently animate at 150 ms. Separately, keyboard
  users get the inner link's focus ring but no card lift — the hover affordance and the focus
  affordance disagree.
- **Effect:** narrowed transition, plus a shadow lift and a matching focus-within state.
- **Behaviour:** `hover`/`focus-within` → `translateY(-4px)` + shadow deepens from `lg` to `xl` +
  accent ring. Poster image inside the `overflow-hidden` frame scales to `1.03` — a restrained
  Ken-Burns that makes the card feel like a window rather than a tile.
- **Timing:** 220 ms `--ease-standard`
- **Implementation:** replace `transition` with
  `transition-[transform,box-shadow] duration-base ease-standard`, add
  `focus-within:-translate-y-1 focus-within:ring-accent`, and
  `group-hover:scale-[1.03] transition-transform duration-slow` on the `<img>`.
- **Priority:** **P1**
- **Perf/A11y:** `box-shadow` transitions do repaint — at 4 px on a single hovered card that's
  acceptable, but do **not** extend it to `filter: drop-shadow`. The image scale needs
  `will-change: transform` **only** on `:hover`, never statically, or 100+ cards each get a compositor
  layer and mobile memory suffers.

#### F2 · Poster images pop in grey-to-image on every cold load — P1

- **Component/page:** [PosterCard.tsx:29](packages/client/src/components/PosterCard.tsx:29), [ShelfCard.tsx:6](packages/client/src/components/ShelfCard.tsx:6),
  [ShelfMovieGrid.tsx:51](packages/client/src/components/ShelfMovieGrid.tsx:51), [ShelfSelectionDialog.tsx:88](packages/client/src/components/ShelfSelectionDialog.tsx:88),
  [MovieDetailPage.tsx:53](packages/client/src/pages/MovieDetailPage.tsx:53)
- **Problem:** every poster is `<img loading="lazy" decoding="async">` over a `bg-surface-raised`
  block. Posters are served from local disk cache, so they arrive fast but *unevenly* — the wall
  flashes as a scatter of grey rectangles filling in at random. Five separate call sites duplicate the
  same markup with the same gap.
- **Effect:** fade-up on decode.
- **Behaviour:** image starts at `opacity: 0`; on `load`, transitions to 1 over 240 ms. Cached images
  fire `load` fast enough to appear instant. The `NoArtworkCard` fallback
  ([NoArtworkCard.tsx](packages/client/src/components/NoArtworkCard.tsx)) needs no fade — it's rendered, not loaded.
- **Timing:** 240 ms `--ease-standard`
- **Implementation:** extract a `PosterImage` component (~12 lines, `useState` for loaded) and swap it
  into all five call sites. This also de-duplicates markup that's currently copy-pasted, which fits
  the repo's "one responsibility per file" rule in `AGENTS.md`. **Don't** do this CSS-only — a CSS
  `animation` on `<img>` fires at element paint, not image decode, so cached images would fade
  pointlessly and slow ones would fade before they have pixels.
- **Priority:** **P1**
- **Perf/A11y:** opacity only. Add `fetchpriority="high"` to the detail-page poster
  ([MovieDetailPage.tsx:53](packages/client/src/pages/MovieDetailPage.tsx:53)) — it's the LCP element on that route and is
  currently `loading="lazy"`, which is actively wrong for an above-the-fold hero image.

#### F3 · Grid entrance — stagger, but narrowly — P2

- **Component/page:** [PosterGrid.tsx:14](packages/client/src/components/PosterGrid.tsx:14)
- **Problem:** the wall appears all at once. A stagger would add perceived craft — but the library can
  hold hundreds of titles and this grid re-renders on every filter change, sort change, and infinite
  scroll page.
- **Effect:** a strictly bounded first-mount stagger.
- **Behaviour:** on **first mount only**, the first 12 cards (roughly one viewport) fade + rise 8 px
  with a 25 ms step — 300 ms total for the sequence. Cards 13+ and **all** subsequent renders get no
  entrance at all.
- **Timing:** 220 ms per card `--ease-standard`, 25 ms step, hard cap at index 11
- **Implementation:** `animation-delay: calc(var(--i) * 25ms)` with `--i` set inline, gated by a
  `useRef` first-mount flag in `PosterGrid`.
- **Priority:** **P2**
- **Perf/A11y:** the cap is the entire point — uncapped over 300 cards means the last one animates
  7.5 seconds in. Must not apply on filter change: filtering is a frequent, fast workflow and
  animating it makes the app feel slower (see §3).

#### F4 · Infinite-scroll pages append with a pop — P2

- **Component/page:** [LibraryPage.tsx:53](packages/client/src/pages/LibraryPage.tsx:53), [useInfiniteScroll.ts](packages/client/src/hooks/useInfiniteScroll.ts)
- **Problem:** the sentinel has `rootMargin: '600px'`, so the next page loads well before it's visible
  and usually arrives off-screen — the pop is mostly invisible. Low severity.
- **Effect:** plain fade-in on newly appended items, no stagger.
- **Timing:** 200 ms `--ease-standard`
- **Implementation:** falls out of F3's per-item animation if the first-mount gate is relaxed to
  "items beyond the previous length". Optional.
- **Priority:** **P2**
- **Perf/A11y:** never stagger here — pages are ~50 items and the user is actively scrolling.

#### F5 · The whole poster wall dims to 60% during unrelated background refetches — P0

- **Component/page:** [LibraryPage.tsx:53](packages/client/src/pages/LibraryPage.tsx:53)
- **Problem:** this is the one place existing motion is actively hurting.
  ```
  <div className={`transition-opacity duration-200 ${movies.isFetching ? 'opacity-60' : 'opacity-100'}`}>
  ```
  `isFetching` is true for **any** fetch on the `['movies']` key, not just filter changes. Traced
  through the code, that includes:
  - the 15-second poll while a scan runs — [useScanMovieRefresh.ts:19](packages/client/src/hooks/useScanMovieRefresh.ts:19)
  - every watched-toggle's `onSettled` invalidation — [useMovies.ts:56](packages/client/src/hooks/useMovies.ts:56)
  - the "refresh" links in the scan banner — [ScanStatusBanner.tsx:39](packages/client/src/components/ScanStatusBanner.tsx:39)
  - every mutation in `useMovieActions.refresh()` and `useShelfActions.refresh()`

  So during a scan — the app's headline background job — the entire library pulses between 60% and
  100% opacity every 15 seconds. And every single watched toggle dims the whole wall. The dim was
  presumably meant to signal "filters are applying"; `keepPreviousData`
  ([useMovies.ts:24](packages/client/src/hooks/useMovies.ts:24)) makes it fire far more broadly than that.
- **Effect:** replace the whole-grid dim with a scoped indicator.
- **Behaviour:** a 2 px indeterminate accent bar under the sticky header while a *user-initiated*
  query is in flight. The grid never dims. Optionally cross-fade the grid (160 ms) only when the
  filter signature actually changes.
- **Timing:** bar fades in after a 150 ms delay so fast queries never flash it; 160 ms cross-fade
- **Implementation:** drop the `opacity-60` branch. Gate any remaining indicator on
  `movies.isPlaceholderData`, which React Query sets precisely when `keepPreviousData` is showing
  stale results for *new* query params — exactly the condition originally intended.
- **Priority:** **P0** — removing a bad animation before adding good ones.
- **Perf/A11y:** the current behaviour drops the whole grid below the 4.5:1 contrast threshold twice a
  minute during scans; it's a genuine accessibility problem, not only an aesthetic one.

#### F6 · Shelf cards — same bare-`transition` issue as F1 — P2

- **Component/page:** [ShelfCard.tsx:5](packages/client/src/components/ShelfCard.tsx:5)
- Apply F1's narrowing. Additionally: the 2×2 cover mosaic (line 6) is the only "collection" visual in
  the app — a `scale(1.04)` on the mosaic on hover, clipped by the existing `overflow-hidden`, gives
  shelves a distinct identity from movie cards. 300 ms `--ease-standard`. **P2.**

#### F7 · Torrent table sort — do NOT animate the reorder

- **Component/page:** [TorrentResultTable.tsx:16–17](packages/client/src/components/TorrentResultTable.tsx:16)
- **Recommendation:** the table renders every result (commonly 40–200 rows) and re-sorts on a header
  click. A FLIP reorder here would put 200 rows in simultaneous motion for ~250 ms — expensive on
  mobile, and actively harmful to the task, which is *scanning for the best release*. The user wants
  the new order to exist, not to watch it assemble.
- **Do instead:** a 120 ms fade on `<tbody>` across the sort change, and animate the **sort-header
  state** — the active heading's `text-accent` plus a 2 px underline that slides between columns
  (`transform: translateX` on a shared indicator, 200 ms). That's where the feedback belongs.
- **Priority:** P2 for the header indicator; the reorder animation is a **won't-do**.

---

### G. Navigation

#### G1 · The FAB cluster hard-swaps between routes — P1

- **Component/page:** [App.tsx:14–20](packages/client/src/App.tsx:14) (`FloatingNavigationButtons`)
- **Problem:** the cluster is three buttons on `/`, two on `/shelves`, one everywhere else, and the
  set changes in the same frame as the route. Because these are the app's only persistent navigation,
  the discontinuity is noticeable on every single navigation.
- **Effect:** staggered scale-in on route change.
- **Behaviour:** buttons scale from `.8` + fade, bottom-most first, 40 ms step. The Back button —
  present on most routes — should keep a stable `view-transition-name` so it *persists* rather than
  re-entering when moving between two routes that both show it.
- **Timing:** 200 ms `--ease-emphasis`, 40 ms step (max 3 → 280 ms total)
- **Implementation:** `animate-pop-in` with an inline `animation-delay`, keyed on `pathname` so React
  remounts them. Pairs naturally with B1.
- **Priority:** **P1**
- **Perf/A11y:** three elements max. Keep `aria-label`s stable.

#### G2 · Sticky header has no scroll state — P2

- **Component/page:** [App.tsx:32](packages/client/src/App.tsx:32)
- **Problem:** `border-b border-border` is always present, so at `scrollY: 0` the header reads as a
  separate slab rather than part of the page.
- **Effect:** border/shadow appears only once scrolled.
- **Behaviour:** at `scrollY > 4`, border colour fades in and a soft shadow appears. **Do not shrink
  the header** — it hosts the `#library-toolbar` portal containing the search field
  ([LibraryPage.tsx:47](packages/client/src/pages/LibraryPage.tsx:47)); moving or resizing the search box while the user
  scrolls toward it would be hostile.
- **Timing:** 150 ms `--ease-standard`
- **Implementation:** an `IntersectionObserver` on a zero-height sentinel above the header — cheaper
  and jank-free versus a scroll listener. Note `useLibraryScrollRestoration`
  ([useLibraryScrollRestoration.ts:29](packages/client/src/hooks/useLibraryScrollRestoration.ts:29)) already attaches a passive scroll
  listener; don't add a second one.
- **Priority:** **P2**
- **Perf/A11y:** IntersectionObserver, no scroll handler, no layout reads.

#### G3 · `backdrop-blur` on a 95%-opaque header is paying for an invisible effect — P1 (perf)

- **Component/page:** [App.tsx:32](packages/client/src/App.tsx:32) — `bg-canvas/95 … backdrop-blur`
- **Problem:** at 95% opacity only 5% of the backdrop shows through, so the blur is essentially
  invisible — but `backdrop-filter` still forces the browser to snapshot and blur the region behind a
  `position: sticky` element on **every scroll frame**. On the Android browsers this app explicitly
  targets, that's one of the most expensive things a page can do, and it's buying nothing.
- **Effect:** pick one — remove the blur, or make it worth its cost.
- **Behaviour:** either `bg-canvas/95` with **no** `backdrop-blur` (recommended — cheapest, visually
  identical today), or `bg-canvas/80 backdrop-blur-md` if the frosted look is wanted, which at least
  makes the cost visible in the design.
- **Timing:** n/a
- **Implementation:** one class change.
- **Priority:** **P1** — the single largest per-frame cost in the app right now.
- **Perf/A11y:** the same audit applies to `Modal`'s backdrop ([Modal.tsx:65](packages/client/src/components/Modal.tsx:65)) — it
  currently uses plain `bg-overlay/80` with **no** blur, which is correct. Do not add one there.

#### G4 · Back-navigation scroll — do NOT add smooth scrolling

- **Component/page:** [useLibraryScrollRestoration.ts:14–27](packages/client/src/hooks/useLibraryScrollRestoration.ts:14),
  [useBackToLibrary.ts:34](packages/client/src/hooks/useBackToLibrary.ts:34), [MovieDetailPage.tsx:33](packages/client/src/pages/MovieDetailPage.tsx:33)
- **Recommendation:** the restoration logic is careful — it saves position on unmount and on scroll,
  restores in `useLayoutEffect`, and re-applies on the next animation frame to survive late layout.
  Both call sites deliberately pass `behavior: 'auto'`. Adding `behavior: 'smooth'` would animate a
  jump of potentially thousands of pixels, race the rAF re-apply, and make returning from a movie feel
  broken. **Leave it.** If B2's shared-element transition lands, it supplies the continuity a smooth
  scroll would be reaching for.

---

### H. Filters

#### H1 · Active-filter chips appear and disappear, shifting the whole page — P1

- **Component/page:** [LibraryFilters.tsx:81](packages/client/src/components/LibraryFilters.tsx:81) (`ActiveFilterChips`), rendered
  into the sticky header portal via [LibraryPage.tsx:47](packages/client/src/pages/LibraryPage.tsx:47)
- **Problem:** the chip row lives inside `<header className="sticky">`. When the first chip appears the
  header grows and the entire poster wall below jumps down; removing the last chip jumps it back.
  Because the chip row also hosts `LibraryOverview` (`trailingContent`), this fires on most filter
  interactions. Layout thrash on the app's primary surface.
- **Effect:** chips animate in/out and the row height transitions rather than snapping.
- **Behaviour:** chip enters with `scale(.9) → 1` + fade, 150 ms `--ease-emphasis`; leaves with
  `scale(.9)` + fade, 120 ms `--ease-exit`. Row height animates via a `grid-template-rows: 0fr → 1fr`
  wrapper over 220 ms, so the grid below slides rather than jumps.
- **Timing:** chip 150/120 ms; row 220 ms `--ease-standard`
- **Implementation:** `animate-pop-in` on the chip button; wrap `ActiveFilterChips`'s output in a grid
  container toggling `grid-rows-[0fr]` / `grid-rows-[1fr]`. Note `ActiveFilterChips` returns `null`
  when empty (line 80), so removal needs a brief mounted-while-leaving state or the exit is skipped —
  acceptable to skip exit initially.
- **Priority:** **P1**
- **Perf/A11y:** `grid-template-rows` on `fr` units does trigger layout, but on a single row of a
  handful of chips that's trivial, and it's the only technique that animates auto height correctly.
  The `aria-label="Active filters"` container keeps announcing normally.

#### H2 · Filter count badge changes silently — P2

- **Component/page:** [LibraryFilters.tsx:91](packages/client/src/components/LibraryFilters.tsx:91)
- **Problem:** the `{activeCount}` pill in the Filters button updates with no acknowledgement, so
  applying a filter from inside the modal produces no visible confirmation on the trigger.
- **Effect:** pop on change.
- **Behaviour:** `scale(1) → 1.25 → 1` with `--ease-emphasis`, keyed on the count value.
- **Timing:** 180 ms
- **Implementation:** `key={activeCount}` + `animate-pop-in`.
- **Priority:** **P2**
- **Perf/A11y:** trivial. Add `tabular-nums` (see J4).

#### H3 · Filter apply → results has no connective tissue — P1

- **Component/page:** [LibraryFilters.tsx:93](packages/client/src/components/LibraryFilters.tsx:93) (modal "Done"),
  [LibraryPage.tsx:53](packages/client/src/pages/LibraryPage.tsx:53)
- **Problem:** pressing Done closes the modal instantly, and the grid dims (F5) then re-renders with
  entirely different content. Nothing links the action to the result.
- **Effect:** with F5 fixed, a scoped cross-fade on genuine filter changes only.
- **Behaviour:** grid cross-fades over 160 ms when the filter signature changes (not on background
  refetch). The `LibraryOverview` "Showing N matching titles" line
  ([LibraryOverview.tsx:19](packages/client/src/components/LibraryOverview.tsx:19)) counts up to the new number over 400 ms — that's
  the actual answer to "what did my filter do", and it should be the thing that moves.
- **Timing:** cross-fade 160 ms; count-up 400 ms `--ease-standard`
- **Implementation:** depends on F5. The 250 ms search debounce
  ([useDebouncedValue.ts:3](packages/client/src/hooks/useDebouncedValue.ts:3)) already spends the user's patience budget — keep the
  cross-fade at 160 ms and never longer.
- **Priority:** **P1**
- **Perf/A11y:** filtering is a *frequent* workflow; total added latency must stay under ~200 ms.

#### H4 · Schedule preset radio cards — P2

[ScheduleSettings.tsx:26–27](packages/client/src/components/ScheduleSettings.tsx:26) already transitions border + background on
selection. Only fixes: narrow the bare `transition` to
`transition-[border-color,background-color] duration-fast`, and add `pressable` (D1) — these are large
tap targets on the settings page and currently give no press feedback.

---

### I. Loading, skeleton, empty states

#### I1 · Every loading state is a sentence of grey text where content will be — P0

- **Component/page:** [LibraryPage.tsx:53](packages/client/src/pages/LibraryPage.tsx:53) ("Loading your library…"),
  [MovieDetailPage.tsx:38](packages/client/src/pages/MovieDetailPage.tsx:38) ("Loading movie…"),
  [ShelfDetailPage.tsx:31](packages/client/src/pages/ShelfDetailPage.tsx:31) ("Loading shelf…"),
  [ShelvesPage.tsx:14](packages/client/src/pages/ShelvesPage.tsx:14) ("Loading shelves…"),
  [SettingsPage.tsx:47](packages/client/src/pages/SettingsPage.tsx:47) ("Loading settings…"),
  [ShelfSelectionDialog.tsx:80](packages/client/src/components/ShelfSelectionDialog.tsx:80), [MatchReviewDialog.tsx:33](packages/client/src/components/MatchReviewDialog.tsx:33)
- **Problem:** seven routes/dialogs, one pattern: `<p className="text-muted">Loading X…</p>`. A single
  line of text stands where a full poster wall is about to appear, so the moment data lands the page
  explodes from 20 px tall to several thousand. Maximum layout shift, and during the wait the app
  looks empty rather than busy. **This is the largest perceived-performance gap in the product.**
- **Effect:** structural skeletons that match the real layout's geometry.
- **Behaviour:**
  - Library / shelf detail: 12 skeleton cards in the exact same
    `grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4` container, each an `aspect-[2/3]`
    `bg-surface-raised` block with two text bars beneath — mirroring `PosterCard`'s structure.
  - Movie detail: poster block + title bar + three paragraph lines + the media-info aside.
  - Shelves: 3 cards with the `aspect-video` mosaic block.
  - Settings: 4 section cards at approximate height.
  - Each carries a shimmer sweep (I2), delayed 200 ms so fast local responses never flash it.
- **Timing:** shimmer 1400 ms linear loop; skeleton→content cross-fade 200 ms `--ease-standard`
- **Implementation:** one `Skeleton.tsx` exporting `<SkeletonBlock>`, `<SkeletonPosterGrid count>`,
  `<SkeletonDetail>`. Consistent with the repo's small-single-purpose-file convention.
- **Priority:** **P0**
- **Perf/A11y:** wrap in `aria-busy="true"` with `aria-live="polite"` on the container, and keep a
  visually-hidden "Loading…" so screen-reader users aren't told about decorative boxes. The 200 ms
  delay matters — a skeleton that flashes for 80 ms is worse than no skeleton.

#### I2 · Shimmer must be transform-based — P0 (with I1)

- **Problem/risk:** the default instinct is a `background-position` animation or Tailwind's
  `animate-pulse`. `background-position` repaints the element every frame; on a 12-card skeleton grid
  that's 12 repaints per frame on mobile.
- **Effect/Behaviour:** an `::after` pseudo-element carrying
  `linear-gradient(90deg, transparent, rgb(var(--color-surface)/.55), transparent)`, translated
  `-100% → 100%` inside the parent's `overflow: hidden`.
- **Timing:** 1400 ms `linear`, infinite
- **Implementation:** the `shimmer` keyframe from §1.3 + a `.shimmer` utility class.
- **Priority:** **P0**
- **Perf/A11y:** `transform` only, compositor-driven. Explicitly disabled by §1.2 — a looping sweep is
  exactly what reduced-motion users are asking not to see; falls back to a flat tint. `animate-pulse`
  is an acceptable second choice (it animates opacity, also compositor-friendly); `animate-bounce` and
  `animate-ping` should appear nowhere in this codebase.

#### I3 · First-run setup card is a one-time moment worth a little delight — P2

- **Component/page:** [LibraryEmptyState.tsx:16–27](packages/client/src/components/LibraryEmptyState.tsx:16)
- **Problem:** the 3-step onboarding checklist (`Add a folder` → `Add a TMDb key` → `Scan`) is the
  first thing a new user ever sees, and it renders flat. Steps flip from a number to a `✓` between
  page loads with no acknowledgement of progress.
- **Effect:** one-time staggered reveal + check-mark draw on completion.
- **Behaviour:** on mount, the three `<Step>` items rise + fade with a 60 ms step. When a step's
  `complete` prop flips true, the badge scales with the emphasis curve and the check strokes on.
- **Timing:** rise 260 ms `--ease-standard`, 60 ms step; check 220 ms
- **Implementation:** `animate-rise-in` + inline `animation-delay` on the `<li>` in `Step`.
- **Priority:** **P2** — low reach, but it is the product's first impression and only ever plays once
  per install.
- **Perf/A11y:** three elements. The `<ol>` semantics stay intact.

#### I4 · Load-more sentinel is a line of text — P1

- **Component/page:** [LibraryPage.tsx:53](packages/client/src/pages/LibraryPage.tsx:53),
  [ShelfSelectionDialog.tsx:85](packages/client/src/components/ShelfSelectionDialog.tsx:85)
- **Problem:** `"Scroll for more titles"` / `"Loading more titles…"` — a centred text line under a
  poster wall, which then vanishes and is replaced by 50 cards. The grid appears to end, then jumps.
- **Effect:** replace with 3–4 skeleton cards while `isFetchingNextPage`.
- **Behaviour:** skeleton cards render inside the grid flow so the wall visibly continues; they're
  replaced in place by real cards.
- **Timing:** reuses I1/I2
- **Implementation:** the sentinel `<div>` keeps its `ref` and `aria-live="polite"`; its *contents*
  become `<SkeletonPosterGrid count={4} />` plus visually-hidden status text.
- **Priority:** **P1**
- **Perf/A11y:** keep the `aria-live` announcement — don't let skeletons silence it.

---

### J. Background jobs and live data

#### J1 · The scan banner slams the page down and back up — P0

- **Component/page:** [ScanStatusBanner.tsx:38,41](packages/client/src/components/ScanStatusBanner.tsx:38), mounted at
  [App.tsx:32](packages/client/src/App.tsx:32) between `<header>` and `<main>`
- **Problem:** `if (…) return null` — when a scan starts, a ~37 px banner materialises in the document
  flow and shoves the entire page down in one frame; when it finishes, everything snaps back up.
  Scanning is the app's core background job, and up to three banners (scan, auto-accept, metadata
  refresh) can appear and disappear independently, each producing its own jump. If the user is
  mid-scroll on the poster wall when a scheduled rescan fires, the content moves under their cursor.
- **Effect:** collapse/expand instead of appear/disappear.
- **Behaviour:** banner container animates `grid-template-rows: 0fr → 1fr` while its content fades and
  slides down from `translateY(-8px)`. Reverse on finish.
- **Timing:** 300 ms `--ease-standard` in; 240 ms `--ease-exit` out
- **Implementation:** wrap the banner region in a grid container that's always mounted, with an inner
  `overflow-hidden`; the `return null` moves inside the wrapper. Since three banners can stack, each
  collapses independently.
- **Priority:** **P0**
- **Perf/A11y:** `grid-template-rows` triggers layout, but at most 3× per scan lifecycle — not
  per-frame. The banner has no live-region role today; adding `role="status"` would be a genuine
  improvement, but with a 1200 ms poll it must **not** re-announce on every tick — announce
  transitions only.

#### J2 · Progress is text-only and steps in 1200 ms jumps — P1

- **Component/page:** [ScanStatusBanner.tsx:41](packages/client/src/components/ScanStatusBanner.tsx:41); polling at
  [useScanStatus.ts:6](packages/client/src/hooks/useScanStatus.ts:6), [useSettings.ts:11](packages/client/src/hooks/useSettings.ts:11),
  [useMetadataRefresh.ts:10](packages/client/src/hooks/useMetadataRefresh.ts:10)
- **Problem:** all three banners report `"{filesProcessed} of {filesFound}"` as bare text updated every
  1200 ms. There is no spatial sense of how far along a scan is, and long scans (thousands of files)
  give the user nothing but two numbers to mentally divide. The Settings page's "Accept N of M…"
  button label ([SettingsPage.tsx:150](packages/client/src/pages/SettingsPage.tsx:150)) has the same problem.
- **Effect:** a determinate 2 px rail across the bottom of each banner.
- **Behaviour:** `transform: scaleX(filesProcessed / filesFound)` with `transform-origin: left` and a
  **1200 ms linear** transition — matched to the poll interval, so the bar glides continuously between
  polls instead of stepping. When `filesFound` is 0 (early scan), show an indeterminate sweep instead.
- **Timing:** 1200 ms `linear` — deliberately matched to `refetchInterval`
- **Implementation:** one `<span>` per banner plus an inline `transform` style. All three banners share
  the `ScanRun` shape, so it's one small `ProgressRail` component used three times.
- **Priority:** **P1**
- **Perf/A11y:** `transform` only. Add `role="progressbar"` with `aria-valuenow/min/max`; the visual
  smoothing is decorative and the ARIA values stay truthful to the last poll.

#### J3 · Live counters — count up, but only where it settles — P2

- **Component/page:** [ScanStatusBanner.tsx:40](packages/client/src/components/ScanStatusBanner.tsx:40) (`titlesAdded`),
  [LibraryOverview.tsx:15–19](packages/client/src/components/LibraryOverview.tsx:15)
- **Problem:** `LibraryOverview`'s title count jumps from `—` to `1,284` in one frame after a scan, and
  the "Showing N matching titles" line changes with no acknowledgement.
- **Effect:** eased count-up on meaningful changes only.
- **Behaviour:** animate over 400 ms with an ease-out curve when the value changes by more than 1.
  Changes of exactly 1 (single watched toggle, single accept) render instantly — animating those would
  be noise. Never count-up the per-poll `filesProcessed`, which changes every 1200 ms and would never
  settle.
- **Timing:** 400 ms `--ease-standard`, rAF-driven
- **Implementation:** a ~20-line `useCountUp(value)` hook. Format with the existing `toLocaleString()`
  at [LibraryOverview.tsx:9](packages/client/src/components/LibraryOverview.tsx:9).
- **Priority:** **P2**
- **Perf/A11y:** rAF text updates on 1–2 elements are cheap. Mark the animating span `aria-hidden` and
  keep a static `.sr-only` with the true value, so assistive tech never reads intermediate numbers.

#### J4 · Digits jitter because nothing uses tabular numerals — P0 (trivial)

- **Component/page:** [ScanStatusBanner.tsx:41](packages/client/src/components/ScanStatusBanner.tsx:41),
  [LibraryOverview.tsx:16–19](packages/client/src/components/LibraryOverview.tsx:16),
  [TorrentResultTable.tsx:20](packages/client/src/components/TorrentResultTable.tsx:20) (seeders/leechers),
  [SettingsPage.tsx:150](packages/client/src/pages/SettingsPage.tsx:150)
- **Problem:** proportional figures mean `"1 of 900"` → `"11 of 900"` changes the text width, so every
  live counter in the app visibly shuffles the words around it 50 times a minute during a scan. Not an
  animation problem, but it's the difference between "solid" and "twitchy", and it undermines every
  other polish item here.
- **Effect:** `font-variant-numeric: tabular-nums`.
- **Timing:** n/a
- **Implementation:** add Tailwind's `tabular-nums` utility to those spans. ~6 class additions.
- **Priority:** **P0** — lowest effort / highest polish ratio in the document.
- **Perf/A11y:** none.

---

### K. Drag and drop

#### K1 · Shelf reorder teleports every card — P0 (for that feature)

- **Component/page:** [ShelfMovieGrid.tsx:25–31](packages/client/src/components/ShelfMovieGrid.tsx:25) (`move`),
  [ShelfMovieGrid.tsx:50](packages/client/src/components/ShelfMovieGrid.tsx:50)
- **Problem:** `move()` splices the array and calls `setOrdered`, so React re-renders the grid with a
  new order and **every** affected card jumps instantly to a different cell. There is no positional
  continuity at all: dragging a card from position 12 to position 3 makes nine other cards teleport.
  This is the app's only drag interaction and it currently reads as broken rather than unpolished —
  worse, because `movePointerDrag` reorders on every `pointermove`
  ([ShelfMovieGrid.tsx:38](packages/client/src/components/ShelfMovieGrid.tsx:38)), it can teleport repeatedly per second mid-drag.
- **Effect:** FLIP — cards glide to their new cells.
- **Behaviour:** before each `setOrdered`, record `getBoundingClientRect()` for every
  `[data-shelf-movie-id]`. In `useLayoutEffect` after paint, compute each card's delta, apply the
  inverse transform, then animate to `none`. The dragged card is excluded — it follows the pointer.
- **Timing:** 220 ms `--ease-standard`
- **Implementation:** ~35 lines using `element.animate()` — no dependency. The `data-shelf-movie-id`
  attribute needed for measurement **already exists** on line 50 (it's used by `movieIdAtPoint`), so
  the wiring is minimal.
- **Priority:** **P0** for this feature; **P1** overall — shelf organising is a lower-traffic flow than
  browsing.
- **Perf/A11y:** all reads must happen *before* any write, and the writes all after — one layout pass,
  no thrash. Grids are typically 10–40 cards. Keyboard users have Move up/Move down in
  `ShelfCardMenu`, which routes through the same `move()`, so they get the animation free — a
  genuinely valuable case, since keyboard reordering is where positional continuity matters most.

#### K2 · The dragged card reads as deleted, not lifted — P1

- **Component/page:** [ShelfMovieGrid.tsx:50](packages/client/src/components/ShelfMovieGrid.tsx:50) —
  `draggingId === movie.id ? 'opacity-50 ring-accent' : ''`
- **Problem:** halving opacity is the visual language of *removal*. Physical drag needs the opposite:
  the grabbed object should come toward the user.
- **Effect:** lift.
- **Behaviour:** on grab — `scale(1.05)`, shadow deepens to `2xl`, `z-index` raised, opacity stays at
  ~0.92, `cursor: grabbing` (already set). The card *under* the pointer gets a dashed accent outline as
  the drop target. On release, scale settles back with `--ease-emphasis`.
- **Timing:** lift 150 ms `--ease-emphasis`; settle 220 ms
- **Implementation:** class swap on line 50, plus tracking the hovered target id — already computed by
  `movieIdAtPoint` at line 39, it just needs storing in state.
- **Priority:** **P1**
- **Perf/A11y:** `transform` + `box-shadow`; one element at a time. `touch-none` on the handle
  (line 53) is already correct for touch dragging.

#### K3 · Throttle pointermove before adding FLIP — P0 (with K1)

- **Component/page:** [ShelfMovieGrid.tsx:36–40](packages/client/src/components/ShelfMovieGrid.tsx:36)
- **Problem:** `movePointerDrag` calls `document.elementFromPoint()` — a forced layout read — on every
  `pointermove` (up to 240 Hz on modern touch panels) and may call `setOrdered` on each one. Today
  that's merely wasteful; once K1 adds a `getBoundingClientRect()` sweep over every card per reorder,
  it becomes a real layout-thrash risk on a 40-card shelf.
- **Effect:** coalesce to one reorder evaluation per animation frame.
- **Behaviour:** identical, but at most 60 evaluations/sec.
- **Timing:** n/a
- **Implementation:** store the latest `clientX/clientY` in a ref; do the `elementFromPoint` + `move()`
  inside a `requestAnimationFrame` guarded by a pending flag. ~10 lines.
- **Priority:** **P0** — must land in the same change as K1.
- **Perf/A11y:** strictly removes work.

---

### L. Scroll-triggered effects

#### L1 · Reveal-on-scroll for the poster wall — do NOT add

- **Component/page:** [PosterGrid.tsx:14](packages/client/src/components/PosterGrid.tsx:14), [LibraryPage.tsx](packages/client/src/pages/LibraryPage.tsx)
- **Recommendation:** three concrete reasons it's wrong here.
  1. The library is a **fast-scan browse surface**. Users flick through a hundred posters looking for
     one; content that fades in as you reach it makes fast scrolling feel laggy.
  2. It directly fights `useLibraryScrollRestoration` — returning from a movie restores you to scroll
     position 3000 px, where an IntersectionObserver-based reveal would land you on a screen of
     not-yet-revealed cards that pop in after the fact.
  3. `useInfiniteScroll` already uses `rootMargin: '600px'` to pre-load — the design intent is
     explicitly *"content should be ready before you get there."* Scroll reveal contradicts it.

  F2 (fade on image load) delivers the pleasant part of this with none of the downside.

#### L2 · Movie-detail backdrop parallax — P2 (premium)

- **Component/page:** [MovieDetailPage.tsx:51](packages/client/src/pages/MovieDetailPage.tsx:51)
- **Problem:** the backdrop is a 224–320 px tall hero at `opacity-60` that scrolls away rigidly with
  the content. It's the one genuinely cinematic surface in the app and it's completely static.
- **Effect:** light parallax.
- **Behaviour:** backdrop translates at ~0.15× scroll rate (max ~40 px displacement) and fades toward 0
  as it leaves. Movement stays subtle enough to read as depth, never as a separate scrolling layer.
- **Timing:** scroll-linked, no easing — it must track the finger 1:1 or it feels rubbery
- **Implementation:** CSS `animation-timeline: scroll()` where supported (Chrome 115+) so it runs off
  the main thread entirely, with no JS fallback — the effect degrades to static, which is fine. Do
  **not** implement with a scroll listener writing `transform` from JS.
- **Priority:** **P2**
- **Perf/A11y:** scroll-driven animation is a classic vestibular trigger — must be inside §1.2. Only
  viable because this page is low-density; the same effect on the library grid would be a performance
  and comfort mistake.

---

### M. Forms and validation

#### M1 · Cron validation feedback snaps in — P1

- **Component/page:** [ScheduleSettings.tsx:32,41](packages/client/src/components/ScheduleSettings.tsx:32)
- **Problem:** `customError` cycles through "Enter a cron expression" → "Checking schedule…" → the
  server error, appearing and disappearing instantly beneath the field while the border flips between
  `border-error` and `border-border`. The "Checking schedule…" state occupies the same slot as real
  errors, so an in-flight validation looks like a validation failure. The whole settings form shifts
  as the message line appears.
- **Effect:** distinguish pending from invalid; animate the message.
- **Behaviour:** while `validation.isFetching`, the field border pulses subtly in `accent` (not
  `error`) and the message slot holds its previous height. On resolve, the error message slides down
  8 px with a fade; the border colour transitions rather than snapping.
- **Timing:** message 180 ms `--ease-standard`; border 150 ms
- **Implementation:** `animate-rise-in` on the feedback `<span>`, `transition-colors duration-fast` on
  the input, and split the pending branch out of the `customError` ternary at line 32.
- **Priority:** **P1**
- **Perf/A11y:** `aria-invalid` should be `false` while merely pending — it's currently
  `Boolean(customError)`, which marks the field invalid during validation. `role="status"` on the
  feedback span is already correct.

#### M2 · ApiKeyField swaps two different-height layouts instantly — P1

- **Component/page:** [ApiKeyField.tsx:33–46](packages/client/src/components/ApiKeyField.tsx:33)
- **Problem:** the resting view (a masked `<span>` + two buttons) and the replacing view (an input +
  Test + Cancel, `flex-col` on mobile) have different heights. Clicking "Replace key" swaps them in one
  frame and everything below in the settings form jumps — noticeably on mobile where the replacing
  view is three stacked rows.
- **Effect:** cross-fade with height transition.
- **Behaviour:** outgoing fades over 100 ms, container height eases to the new value over 200 ms,
  incoming fades in. The input's existing autofocus ([ApiKeyField.tsx:26](packages/client/src/components/ApiKeyField.tsx:26)) fires
  immediately — do not delay it behind the animation.
- **Timing:** 200 ms `--ease-standard`
- **Implementation:** `grid-template-rows` wrapper, same technique as H1/J1.
- **Priority:** **P1**
- **Perf/A11y:** focus must land before or during the animation, never after — a keyboard user should
  not be typing into a moving target. Since focus is already in a separate effect, verify ordering.

#### M3 · Settings save confirms itself in the opposite corner — P1

- **Component/page:** [SettingsPage.tsx:128](packages/client/src/pages/SettingsPage.tsx:128),
  [useSettings.ts:33](packages/client/src/hooks/useSettings.ts:33)
- **Problem:** the Save button reads "Saving…" then reverts to "Save settings"; the only success signal
  is a toast rendered at top-left, while the button sits at the bottom of a long form. Same structural
  issue as D3 — and here the form is long enough that the toast may be entirely off-screen.
- **Effect:** inline success state on the button.
- **Behaviour:** on success, the button becomes `bg-success` with a drawn check and "Saved" for
  1600 ms, then eases back. Same treatment for "Test key"
  ([ApiKeyField.tsx:36](packages/client/src/components/ApiKeyField.tsx:36)) and "Test saved connection"
  ([QbittorrentSettingsSection.tsx:28](packages/client/src/components/QbittorrentSettingsSection.tsx:28)).
- **Timing:** into success 220 ms; hold 1600 ms; out 220 ms
- **Implementation:** `actions.update.isSuccess` is already exposed by the mutation; combine with a
  timer. Reuse D3's success-morph pattern — build it once as a `useSuccessPulse(isSuccess)` hook and
  use it in all four places.
- **Priority:** **P1**
- **Perf/A11y:** keep the toast for the screen-reader announcement; the button change is visual
  reinforcement, so don't change its `aria-label` mid-flight.

#### M4 · Focus rings are inconsistent, and one uses the wrong pseudo-class — P0

- **Component/page:** audited across all components
- **Problem:** the house style —
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`
  — is applied carefully in some places and **missing entirely** in others:
  - **Missing:** Modal close button ([Modal.tsx:67](packages/client/src/components/Modal.tsx:67)); all Modal footer buttons
    (Done/Cancel/Save across 6 dialogs); `MatchCandidateRow` Accept
    ([MatchCandidateRow.tsx:24](packages/client/src/components/MatchCandidateRow.tsx:24)); `ActiveFilterChips`
    ([LibraryFilters.tsx:81](packages/client/src/components/LibraryFilters.tsx:81)); `ShelfCardMenu` items
    ([ShelfCardMenu.tsx:29](packages/client/src/components/ShelfCardMenu.tsx:29)); both `TorrentSendButton` buttons; the
    `TorrentResultTable` sort headings ([TorrentResultTable.tsx:19](packages/client/src/components/TorrentResultTable.tsx:19)); most Settings
    inputs; `ShelfCard`; `PosterCard`'s title link.
  - **Wrong pseudo-class:** the library search input
    ([LibraryFilters.tsx:91](packages/client/src/components/LibraryFilters.tsx:91)) uses `outline-none … focus:ring`, so it rings on
    mouse click too — inconsistent with every other control, and it strips the outline unconditionally.
  - **No transition:** every focus ring appears and vanishes instantly, so tabbing through the settings
    form is a series of hard jumps.
- **Effect:** one ring, everywhere, that eases.
- **Behaviour:** the `focusRing` constant from §1.4 applied universally, plus
  `transition-[outline-color] duration-instant` so the ring fades rather than snaps. Ring colour stays
  `accent` except on destructive controls, which use `error`.
- **Timing:** 90 ms
- **Implementation:** import `focusRing` and append. ~20 sites. Mechanical.
- **Priority:** **P0** — this is the "keyboard focus states" item from the brief, and it's currently a
  genuine WCAG 2.4.7 gap on several interactive controls, not a polish issue.
- **Perf/A11y:** `outline` doesn't affect layout (unlike `ring`, which is a box-shadow) — prefer it, as
  the codebase already does. Never animate `outline-width`; animate colour only, or a fast ring can be
  missed entirely.

---

### N. Mobile and touch

Covered above, consolidated here:

| Item | Where | Priority |
|---|---|---|
| `hoverOnlyWhenSupported` — stops hover latching after tap | [tailwind.config.ts](packages/client/tailwind.config.ts) | **P0** (D2) |
| Press feedback — the only feedback touch users get | all buttons | **P0** (D1) |
| Bottom-sheet slide for dialogs | [Modal.tsx:65](packages/client/src/components/Modal.tsx:65) | **P0** (C1) |
| Sheet grabber bar (visual affordance, no drag logic) | [Modal.tsx:66](packages/client/src/components/Modal.tsx:66) | P2 |
| Watched toggle is a 24 px target 12 px from another control | [PosterCard.tsx:33](packages/client/src/components/PosterCard.tsx:33) | **P1** (D5) |
| Drop `backdrop-blur` from the sticky header | [App.tsx:32](packages/client/src/App.tsx:32) | **P1** (G3) |
| Cap grid stagger — never animate 300 cards on a phone | [PosterGrid.tsx:14](packages/client/src/components/PosterGrid.tsx:14) | P2 (F3) |

**Drag-to-dismiss sheets: recommend against.** Seven dialogs would each need gesture handling, velocity
thresholds, and scroll-conflict resolution against `ShelfSelectionDialog`'s internal scroll container.
Backdrop tap-to-close ([Modal.tsx:65](packages/client/src/components/Modal.tsx:65)) and the close button already cover dismissal.

---

### O. Charts and statistics

**There are none, and none should be added.** [LibraryOverview.tsx](packages/client/src/components/LibraryOverview.tsx) — four
inline counts separated by hairlines — is the app's entire statistics surface, and that restraint is
correct for a browse-first media library. `FEATURES.md` scopes v1 explicitly and contains no analytics.
The only items that apply are J3 (count-up on `LibraryOverview`) and J4 (tabular numerals). **Do not**
introduce a charting dependency, a stats dashboard, animated donuts, or "library insights" — that would
be scope invented by the audit rather than found in the product.

---

## 3. Where animation should NOT be added

Consolidated, with reasons grounded in this codebase:

1. **Torrent table sort reorder** — [TorrentResultTable.tsx:16](packages/client/src/components/TorrentResultTable.tsx:16). 40–200 rows in
   simultaneous motion; the user wants the answer, not the shuffle. (F7)
2. **Poster wall scroll-reveal** — fights scroll restoration and the 600 px pre-load; makes fast
   browsing feel laggy. (L1)
3. **Smooth scroll on back-navigation** — would race the rAF restore in
   [useLibraryScrollRestoration.ts:24](packages/client/src/hooks/useLibraryScrollRestoration.ts:24). (G4)
4. **Custom tooltips** — native `title` is already paired with `aria-label` throughout; replacing it
   adds a positioning engine to solve nothing. (C4)
5. **Filter/search result transitions over ~200 ms** — `useDebouncedValue`'s 250 ms already spends the
   latency budget. Filtering is the most frequent workflow in the app; every added millisecond taxes
   it. (H3)
6. **The silent watched toggle** — [PosterGrid.tsx:14](packages/client/src/components/PosterGrid.tsx:14) passes `silent: true`
   deliberately so bulk marking doesn't spam toasts. Keep it silent; D5's local feedback is the right
   channel. Do **not** make it show toasts.
7. **Per-poll animation on scan counters** — with `refetchInterval: 1200`, animating each tick means
   permanent motion for the length of a scan. Only the progress rail (J2) should move continuously.
8. **Stagger inside dialogs** — `MatchReviewDialog`'s candidate list and `ShelfSelectionDialog`'s grid
   load while the user is actively waiting to make a decision. Fade the container, never sequence the
   contents.
9. **Modal exit animations, for now** — genuinely lower value than the entrance and requires
   restructuring 6 callers' state-reset behaviour. (C2)
10. **`animate-bounce`, `animate-ping`, page-level parallax beyond L2, 3D transforms, Lottie,
    Three.js** — the posters are the visual payload; decorative motion competes with them.
11. **Loading spinners on buttons that already swap their label** —
    [PlayButton.tsx:58](packages/client/src/components/PlayButton.tsx:58) is correct as-is. Don't add skeletons to sub-second
    indeterminate operations.

---

## 4. Top 10 highest-impact improvements

Ranked by UX impact ÷ implementation effort. Effort is rough dev-hours.

| # | Change | Items | Effort | Why it ranks here |
|---|---|---|---|---|
| 1 | **Motion tokens + reduced-motion** | A1, A2 | 1 h | Nothing else can be built consistently without it, and it makes reduced-motion correct by construction rather than by 30 individual `motion-reduce:` classes |
| 2 | **Skeleton loading states** | I1, I2, I4 | 4 h | Seven "Loading…" text lines become structural placeholders. Largest perceived-performance gain available, and it removes the app's biggest layout shift |
| 3 | **Press states + `hoverOnlyWhenSupported`** | D1, D2 | 1 h | One config line plus one shared class string fixes both "no touch feedback anywhere" and "hover latches after tap". Highest feel-per-line in the document |
| 4 | **Fix the `isFetching` grid dim** | F5 | 30 m | Deleting a branch stops the poster wall pulsing every 15 s during scans and after every watched toggle. Removing bad motion beats adding good motion |
| 5 | **Modal entrance + mobile sheet slide** | C1 | 2 h | Seven dialogs, one `@starting-style` block, no JS. The most-touched surface after the poster wall |
| 6 | **Scan banner collapse + progress rail + tabular-nums** | J1, J2, J4 | 3 h | Stops the page slamming up and down on every scan; gives the core background job a real sense of progress |
| 7 | **Focus-ring consistency** | M4 | 2 h | ~20 controls currently have no visible focus indicator. Accessibility gap first, polish second |
| 8 | **Toast entrance + count pop** | E1 (enter half) | 1.5 h | Every mutation in the app confirms through toasts; today they're easy to miss entirely |
| 9 | **Poster image fade + hover refinement** | F1, F2 | 2.5 h | Removes the grey-rectangle flash on every cold load; extracting `PosterImage` also de-duplicates five copies of the same markup |
| 10 | **Shelf drag FLIP + lift + rAF throttle** | K1, K2, K3 | 4 h | Lower traffic than 1–9, but it's the one interaction that currently reads as *broken* rather than plain |

**Next tier (premium, after the above):** B1 + B2 view transitions and the poster shared-element morph
— highest ceiling for "premium", but they depend on the foundation and are best evaluated once the
basics feel right.

---

## 5. Implementation roadmap

### Phase 1 — Quick wins (≈ 1 day)

Config and mechanical changes; no structural refactors.

| Item | File(s) |
|---|---|
| A1 motion tokens | [styles.css](packages/client/src/styles.css), [tailwind.config.ts](packages/client/tailwind.config.ts) |
| A2 reduced-motion collapse | [styles.css](packages/client/src/styles.css) |
| D2 `hoverOnlyWhenSupported` | [tailwind.config.ts](packages/client/tailwind.config.ts) |
| §1.4 shared constants | new `components/interactionStyles.ts` |
| D1 press states | [App.tsx:12](packages/client/src/App.tsx:12), [PlayButton.tsx:8](packages/client/src/components/PlayButton.tsx:8), [MovieActionButtons.tsx:6](packages/client/src/components/MovieActionButtons.tsx:6), [RevealInFolderButton.tsx:6](packages/client/src/components/RevealInFolderButton.tsx:6), dialog footers |
| M4 focus rings | ~20 sites (list in M4) |
| F5 remove the grid dim | [LibraryPage.tsx:53](packages/client/src/pages/LibraryPage.tsx:53) |
| J4 tabular numerals | [ScanStatusBanner](packages/client/src/components/ScanStatusBanner.tsx), [LibraryOverview](packages/client/src/components/LibraryOverview.tsx), [TorrentResultTable](packages/client/src/components/TorrentResultTable.tsx) |
| G3 drop header `backdrop-blur` | [App.tsx:32](packages/client/src/App.tsx:32) |
| F1/F6/H4 narrow bare `transition` | [PosterCard.tsx:28](packages/client/src/components/PosterCard.tsx:28), [ShelfCard.tsx:5](packages/client/src/components/ShelfCard.tsx:5), [ScheduleSettings.tsx:26](packages/client/src/components/ScheduleSettings.tsx:26) |
| C3 dropdown pop-in | [ShelfCardMenu.tsx:29](packages/client/src/components/ShelfCardMenu.tsx:29) |
| H2 filter badge pop | [LibraryFilters.tsx:91](packages/client/src/components/LibraryFilters.tsx:91) |
| C5 `<details>` rise | [ScanHistoryList.tsx:22](packages/client/src/components/ScanHistoryList.tsx:22) |

### Phase 2 — Medium effort (≈ 2–3 days)

New components and contained refactors.

| Item | File(s) |
|---|---|
| I1/I2/I4 skeletons + shimmer | new `components/Skeleton.tsx`; wired into 7 loading sites |
| C1 modal entrance + sheet | [Modal.tsx:65](packages/client/src/components/Modal.tsx:65) + `styles.css` |
| E1 toast enter/exit/reflow | [ToastProvider.tsx](packages/client/src/components/ToastProvider.tsx) |
| J1/J2 banner collapse + rail | [ScanStatusBanner.tsx](packages/client/src/components/ScanStatusBanner.tsx), new `ProgressRail` |
| F2 image fade | new `components/PosterImage.tsx`; 5 call sites |
| H1 chip enter + row height | [LibraryFilters.tsx:81](packages/client/src/components/LibraryFilters.tsx:81) |
| H3 filter cross-fade | [LibraryPage.tsx:53](packages/client/src/pages/LibraryPage.tsx:53) |
| M1 cron validation feedback | [ScheduleSettings.tsx:32](packages/client/src/components/ScheduleSettings.tsx:32) |
| M2 ApiKeyField cross-fade | [ApiKeyField.tsx:33](packages/client/src/components/ApiKeyField.tsx:33) |
| D3/M3 success morphs | new `hooks/useSuccessPulse.ts`; [PlayButton](packages/client/src/components/PlayButton.tsx), [SettingsPage:128](packages/client/src/pages/SettingsPage.tsx:128), [ApiKeyField](packages/client/src/components/ApiKeyField.tsx), [QbittorrentSettingsSection](packages/client/src/components/QbittorrentSettingsSection.tsx) |
| G1 FAB stagger | [App.tsx:14](packages/client/src/App.tsx:14) |
| K1/K2/K3 drag FLIP + lift + throttle | [ShelfMovieGrid.tsx](packages/client/src/components/ShelfMovieGrid.tsx) |

### Phase 3 — Premium polish (≈ 2 days)

Evaluate after Phases 1–2 ship; some may prove unnecessary once the basics feel right.

| Item | File(s) |
|---|---|
| B1 route view transitions | [App.tsx](packages/client/src/App.tsx), all `<Link>`s, `styles.css` |
| B2 poster shared-element morph | [PosterCard.tsx:15](packages/client/src/components/PosterCard.tsx:15), [MovieDetailPage.tsx:53](packages/client/src/pages/MovieDetailPage.tsx:53) |
| D5 watched check-draw + pulse | [PosterCard.tsx:33](packages/client/src/components/PosterCard.tsx:33) |
| F3/F4 capped grid stagger | [PosterGrid.tsx:14](packages/client/src/components/PosterGrid.tsx:14) |
| J3 count-up | new `hooks/useCountUp.ts`; [LibraryOverview](packages/client/src/components/LibraryOverview.tsx) |
| I3 first-run reveal | [LibraryEmptyState.tsx:16](packages/client/src/components/LibraryEmptyState.tsx:16) |
| L2 backdrop parallax | [MovieDetailPage.tsx:51](packages/client/src/pages/MovieDetailPage.tsx:51) |
| E2 toast countdown rail | [ToastProvider.tsx:14](packages/client/src/components/ToastProvider.tsx:14) |
| F7 sort-header indicator | [TorrentResultTable.tsx:19](packages/client/src/components/TorrentResultTable.tsx:19) |
| C2 modal exit (if still wanted) | [Modal.tsx](packages/client/src/components/Modal.tsx) + 6 callers |

---

## 6. Cross-cutting performance and accessibility rules

Applies to every item above; worth encoding in `AGENTS.md` once agreed.

**60 FPS / GPU**
- Animate **only** `transform` and `opacity`. The exceptions permitted in this plan, each justified:
  `box-shadow` on a single hovered card (F1); `grid-template-rows` for auto-height collapse (H1, J1,
  M2) where nothing else animates auto height correctly; `outline-color` on focus (M4).
- Never animate `width`, `height`, `top`, `left`, `margin`, `background-position`, or `filter`.
- `will-change: transform` only on `:hover`/`:active`, never statically — 100+ statically-promoted
  poster cards would each get a compositor layer and blow out mobile memory.

**Layout thrash**
- In FLIP (K1): all `getBoundingClientRect()` reads before any style write. One layout pass.
- Throttle any pointer/scroll handler that reads layout to one rAF (K3).
- Prefer `IntersectionObserver` over scroll listeners (G2); the codebase already does this correctly in
  `useInfiniteScroll`.

**Mobile**
- `hoverOnlyWhenSupported` (D2) is a prerequisite for every hover style in this plan.
- Zero `backdrop-filter` on scroll-pinned elements (G3).
- Cap stagger counts (F3); cap concurrent animated elements at roughly one viewport.

**Reduced motion**
- Every duration flows through a CSS variable, so §1.2 collapses all of them at once.
- Deliberately preserved: `animate-spin` on in-flight buttons, determinate progress rails.
- Deliberately suppressed: shimmer loops, view transitions, scroll-linked parallax, stagger, card lift.

**Assistive tech**
- Never gate an announcement on an animation. `role="alert"` toasts must mount immediately and animate
  after (E1).
- Skeletons: `aria-busy` + a visually-hidden status string; the boxes themselves stay decorative (I1).
- Count-up spans: `aria-hidden`, with the true value in an `.sr-only` sibling (J3).
- Progress rails: honest `aria-valuenow` from the last poll; the smoothing is visual only (J2).

**Frequent workflows must not get slower**
- Filter and search: total added motion ≤ 200 ms, on top of an existing 250 ms debounce (H3).
- Watched toggle: already optimistic; local feedback must not delay the state flip (D5).
- Infinite scroll: no stagger, no reveal (F3, F4, L1).
