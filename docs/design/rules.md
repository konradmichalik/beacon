# Design rules

These rules are binding for every change to Beacon's popup and the Settings window. The landing page embeds the real popup, so the popup rules cover it there too; it has no screens of its own. When a change needs to break one, change the rule here first, in the same pull request, and say why.

The screens these rules produce are listed in [screens.md](screens.md). The code moves over to them screen by screen; until a screen has moved, the canvas wins over the current markup.

## Principles

1. **What needs me first.** A row answers "do I have to act?" before anything else. Facts that need no action stay quiet.
2. **Colour for meaning, ink for facts.** Colour appears only where it asks for attention or reports an exception. Everything else is text colour.
3. **One control per job.** The same task looks the same everywhere: one segmented control, one icon button, one chip, one dialog.
4. **Nord, readable.** The palette stays Nord, darkened in light mode until every text reaches 4.5:1.
5. **Calm by default.** Nothing moves unless it reports a change the user caused or cares about.

## Colour

All colours come from the `--ds-*` tokens in `src/app.css`, with a light and a dark value. No literal colours in components, no Tailwind palette colours (`text-green-600`), no opacity tricks to make a colour (`text-primary/70`).

| Token                                               | Light                 | Dark                  | Use                                              |
| --------------------------------------------------- | --------------------- | --------------------- | ------------------------------------------------ |
| `--ds-surface`                                      | `#f5f7fa`             | `#1e222a`             | Popup and window background                      |
| `--ds-surface-raised`                               | `#ffffff`             | `#2e3440`             | Cards, segment thumb, source badge on the avatar |
| `--ds-surface-overlay`                              | `#ffffff`             | `#353c4a`             | Menus, popovers, dialogs                         |
| `--ds-surface-sunken`                               | `#e6eaf0`             | `#2a303b`             | Segment trough, count pills, neutral chips       |
| `--ds-surface-hovered`                              | `#e9edf2`             | `#3b4252`             | Hovered and keyboard-focused rows and menu items |
| `--ds-text`                                         | `#2e3440`             | `#e5e9f0`             | Titles, labels, primary text                     |
| `--ds-text-subtle`                                  | `#4c566a`             | `#a3abbb`             | Inactive tabs, icon buttons, section headers     |
| `--ds-text-subtlest`                                | `#5c6578`             | `#8f99aa`             | Repo line, time, meta facts, help text           |
| `--ds-text-brand`                                   | `#4a6a91`             | `#88c0d0`             | Links, tab indicator, new dot, brand chips       |
| `--ds-background-brand-bold`                        | `#4a6a91`             | `#88c0d0`             | Primary button, active tab count                 |
| `--ds-background-selected`                          | `#e3eaf3`             | `#263240`             | Brand chip fill, highlight of a new row          |
| `--ds-text-success` / `--ds-background-success`     | `#4a6e35` / `#e6efe0` | `#a3be8c` / `#2d3828` | Ready to merge, Approved, CI passed              |
| `--ds-text-warning` / `--ds-background-warning`     | `#9a5236` / `#f8eae3` | `#ebcb8b` / `#38331e` | Draft, Changes requested, CI running             |
| `--ds-text-danger` / `--ds-background-danger`       | `#a3434d` / `#f8e5e7` | `#e0939a` / `#3d2b2e` | CI failed, Disconnect, destructive actions       |
| `--ds-text-discovery` / `--ds-background-discovery` | `#7f5a79` / `#f1e7ef` | `#c9a6c2` / `#362a3c` | Merged, Review submitted                         |
| `--ds-border`                                       | `#2e3440` at 10 %     | `#d8dee9` at 9 %      | Row separators, card outlines                    |
| `--ds-border-strong` (new)                          | `#2e3440` at 18 %     | `#d8dee9` at 18 %     | Secondary buttons, label pills, `kbd`            |
| `--ds-border-input`                                 | `#858d9e`             | `#7a8294`             | Text input outlines                              |
| `--ds-blanket`                                      | `#2e3440` at 28 %     | black at 45 %         | Scrim behind dialogs                             |
| `--ds-brand-flash`                                  | `#6fb3c9`             | `#d8f1f7`             | Colour the logo arcs flash in                    |

- **An outline that identifies a control reaches 3:1** against both sides (WCAG 1.4.11). Text inputs use `--ds-border-input` (3.3:1 on white, 3.7:1 on the dark field). Outlines that only decorate, because a label or the pill text already identifies the element, may use `--ds-border-strong`.
- Light values above replace the pastel Nord values (`#7b9e64`, `#d08770`, `#b48ead`, `#bf616a`, `#5e81ac`), which reach only 2.4 to 3.4:1 as chip text.
- **Source colours never appear in data.** GitHub and GitLab are told apart by their icon, not by blue and orange.
- **Avatar fallbacks** use the dark token values (`#4a6a91`, `#4a6e35`, `#7f5a79`, `#9a5236`, `#a3434d`, `#5c6578`) with white initials. Pastel Nord fills fail with white text.
- The toast is inverted and has its own tokens: `--ds-toast-background` (`#2e3440` light, `#e5e9f0` dark), `--ds-toast-text` (`#eceff4` light, `#2e3440` dark) and `--ds-toast-accent` for its action (`#a3d4e0` light, `#3a5a80` dark, both 4.5:1 or better on the action's fill).
- Status colours differ from text in lightness, not only in hue, and never carry information alone: every coloured chip has an icon and a word.

## Typography

System stack only (`-apple-system`, SF Pro). No web fonts.

| Role                                       | Size                                    | Weight                                                 |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------------------ |
| Wordmark `beacon`                          | 17px                                    | 700, tracking -0.4px                                   |
| Empty and dialog titles                    | 14 to 15px                              | 600                                                    |
| Row title                                  | 13px, line height 18px                  | 600 unread, 400 read, 500 for pull requests and issues |
| Body, menu items, buttons                  | 12 to 12.5px                            | 400 to 600                                             |
| Tabs                                       | 12px                                    | 600 active, 500 inactive                               |
| Repo line, time, segments, section headers | 11.5px                                  | 400 to 600                                             |
| Chips, meta facts, `kbd`                   | 11px                                    | 600 for chips                                          |
| Counts, label pills                        | 10.5px                                  | 600 to 700                                             |
| Group headings (Settings, Filters)         | 10.5 to 11px, uppercase, tracking 0.5px | 700                                                    |

- **10.5px is the minimum.** No `text-[9px]` or `text-[10px]`.
- Counts and times use tabular digits (`tabular-nums`).
- Row titles wrap to two lines and then truncate (`line-clamp-2`). Everything else in a row is one line.

## Layout

| Element                        | Value                                                           |
| ------------------------------ | --------------------------------------------------------------- |
| Popup                          | 420 × 520px, radius 12px                                        |
| Settings window                | 480 × 480px                                                     |
| Horizontal gutter              | 16px                                                            |
| Header                         | 44px, one row                                                   |
| Filter bar                     | 40px                                                            |
| Section header and Read footer | 32px, sticky                                                    |
| Row                            | 12px vertical padding, 10px dot column, 32px avatar, 8px gap    |
| Icon button                    | 28px square, radius 6px, no border                              |
| Segmented control              | trough radius 8px with 2px padding, thumb 24px high, radius 6px |
| Chip                           | 20px high, radius 6px, 7px horizontal padding                   |
| Label pill                     | 18px high, fully rounded, outlined                              |
| Menu                           | 268px wide, radius 10px, items 28px                             |
| Filter popover                 | 300px wide, radius 12px, anchored top right under its button    |
| Dialog                         | 320px wide, radius 12px, centred, 92px from the top             |
| Settings card                  | radius 10px, rows at least 44px (34px for shortcut rows)        |

- Group with sections and cards, not with extra dividers. A hairline separates rows inside a list or card, nothing else.
- Icon buttons are 28px: Beacon is pointer-only, so the 44px touch-target rule does not apply. Rows and menu items stay full width.

## Header and navigation

- **One header row, always.** Wordmark left, tabs centred, actions right. Turning on the Issues tab must not add a second row.
- Tabs are text with a count: `Inbox`, `My PRs`, `Issues`. No icons in tabs. The active tab is `--ds-text` in 600 with a 2px `--ds-text-brand` underline that slides between tabs; its count is a filled brand pill. Inactive counts sit on `--ds-surface-sunken`.
- Header actions are Refresh and Settings only. Quit lives in Settings and the tray menu, never next to Settings.
- The filter bar holds, left to right: the source control (All, GitHub, GitLab with counts), a spacer, then icon buttons. Mark as read (Inbox only, with a chevron for its options), Filter (with a brand dot when a filter is active), Sort.
- With one connected service the source control is replaced by a static label; nothing else moves.

## List rows

One row component for notifications, pull requests and issues.

- **Left to right:** new dot column, avatar with source badge, content.
- **New dot:** 7px `--ds-text-brand` dot in the left column, only for items new since the popup was last opened. It is not the unread marker.
- **Unread** is the title weight (600). Read rows keep full opacity and use weight 400. Never `opacity-45` or `opacity-60` on a row.
- **Avatar:** 32px circle. The source icon (GitHub or GitLab) sits in a 17px `--ds-surface-raised` badge on its bottom right. The repo line carries no source icon.
- **Line 1:** `owner/name · type` (`PR`, `MR`, `Issue`) for notifications, `owner/name · #339` or `owner/name · !87` for pull requests and issues. Time on the right, short form without "ago": `now`, `5m`, `3h`, `2d`, then a date (`12 Sep`).
- **Line 2:** the title.
- **Line 3:** chips, then meta facts, then labels. The line is left out when it would be empty.

### Chips, meta facts and labels

| Kind         | Look                                                    | Used for                                                                                                                                                     |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status chip  | Filled tone background, tone text, icon and word        | What needs attention or an exception: Ready to merge, Your review, Review requested, Mentioned, CI failed, Draft, Merged, Closed, Approved, Review submitted |
| Neutral chip | `--ds-surface-sunken`, `--ds-text-subtle`               | A reason without urgency: Comment, Assigned                                                                                                                  |
| Meta fact    | 12px icon plus `--ds-text-subtlest` text, no background | Facts: CI state (icon only, with tooltip), review state, target branch when not `main` or `master`, comment count                                            |
| Label pill   | `--ds-border-strong` outline, `--ds-text-subtle` text   | Issue labels, at most two, then `+N`                                                                                                                         |

- **At most one status chip per row, two when the second is a state** (Draft, Merged, Closed). When several apply, the failure comes first: CI failed before Draft before Changes requested.
- **Open is never shown.** It is the default. Draft, Merged and Closed are.
- **Synthetic notifications** (`synthetic: true`) carry a small sparkle after the chip label, with the tooltip "detected by Beacon". There is no separate "Beacon" badge.
- The CI icon shapes differ (check, cross, spinner), so the state never depends on colour.
- A row with nothing to do shows only meta facts.

## Lists and sections

- Section headers are sticky buttons: chevron, 12px icon, label, count on the right. The chevron turns 90° when open.
- Pull requests group into Starred, Created by me, To review and Reviewed. Reviewed starts collapsed. Issues group into Created by me and Assigned to me.
- In the Inbox, Read and Snoozed sit at the bottom as sticky collapsible footers.
- Inside a section, rows with an attention state sort first.
- Long lists use "Load more (N)" in place, never a nested scroll area.

## Overlays

| Overlay               | Rules                                                                                                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context menu          | Opens at the pointer, clamped inside the popup. Items with a shortcut show it as `kbd` on the right, and only for a key that really triggers that item. A divider separates read actions from the rest                                                                       |
| Filter popover        | Single choices are segmented controls without counts. Multiple choices are toggle chips with counts (Type, Status) or checkboxes with visible labels (Project, Author). The footer with "Reset all filters" appears only while a filter is active                            |
| Dialog (Snooze, Mute) | Title, one line of context (the item's title, or what the rule does), the choices, Cancel and at most one primary button. Snooze options show their time and a number key. Mute shows how many items the rule would hide before it is created                                |
| Toast                 | Bottom centre, above the Read footer, inverted colours, 3.6s. Bulk actions (mark all as read) carry Undo; single actions do not. Undo is only honest because the server hears about a bulk action after the 3.6s window, GitHub and GitLab cannot mark a thread unread again |

- Menus and popovers dismiss on outside click and Escape. Dialogs trap focus, close on Escape and return focus to the row.
- Only one overlay at a time. Opening a dialog from the context menu replaces the menu.

## States

| State                | Treatment                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading (first load) | Skeleton rows in the row layout, count pills as pulse placeholders                                                                                                                |
| All clear            | The party popper in an 80px `--ds-surface-sunken` circle, "All clear" and one sentence ("No unread notifications.", "No open pull requests.", "No open issues."). Keep the popper |
| Not connected        | 64px `--ds-background-selected` tile with the beacon mark, "Connect GitHub or GitLab", one sentence, one primary button "Open Settings". No filter bar, no counts                 |
| Hidden items         | "N hidden, muted or snoozed" as a link to the mute rules                                                                                                                          |
| Connection error     | On the service's card in Settings, in `--ds-text-danger` with an icon                                                                                                             |

## Settings window

- A toolbar of five panes, icon over label, 80 × 48px each: Connections, Preferences, Alerts, Shortcuts, About. The active pane sits on `--ds-surface-sunken` with `--ds-text-brand`.
- Content is grouped cards under uppercase group headings. Each row: label and optional help text left, one control right.
- Single choices are the popup's segmented control. Booleans are switches (34 × 20px, brand when on). Colour choices are 20px swatches with a ring on the selected one.
- Every input has a visible `<label>`. Placeholders show a format (`glpat-…`), never the label.
- A connected service shows the account (`Signed in as @login`), the platform status as dot plus words, and Disconnect in `--ds-text-danger`. A disconnected service shows its form in the same card.
- Settings that depend on another one appear only when it applies (Summary interval only for Summary, Sound only when notifications are on).
- The Shortcuts pane names every key in words and lists all of them, including `3` for Issues.

## Motion

Motion is opt-in for people who allow it. One rule in `src/app.css` cuts every CSS animation and transition to zero under `prefers-reduced-motion: reduce`, and Svelte transitions get their durations through `motionMs`, which returns 0 under Reduce Motion. Start from no motion and opt in: a new animation must work with both mechanisms. Under Reduce Motion every change shows its end state at once.

| Token        | Value                           |
| ------------ | ------------------------------- |
| `--dur-base` | 200ms                           |
| `--dur-slow` | 380ms                           |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` |

| Where                  | What                                                                                                                                          | Timing                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Popup opens            | Fade, 8px from above, scale 0.98 to 1, origin top centre. Starts on the `popup-shown` event that `show_and_focus` emits in Rust, not on mount | 180 / 380ms                                 |
| List appears           | Rows 6px up and fade, staggered, at most 7 staggered                                                                                          | 30ms apart, 360ms                           |
| Tab change             | Underline slides; the list enters 16px from the side of the change                                                                            | 340ms                                       |
| Source change          | Segment thumb slides, list fades in                                                                                                           | 300ms                                       |
| Mark as read           | Row moves 36px right and fades, then its height closes; rows below follow with `animate:flip`                                                 | 200ms, height 280ms after 150ms             |
| Mark all as read       | The same, cascading                                                                                                                           | 45ms apart                                  |
| New item after a poll  | Slides in at the top, `--ds-background-selected` fades out, the tab count ticks                                                               | 280ms, fade 1.4s                            |
| Refresh                | One full turn per click; it keeps spinning only while the request takes longer than 800ms                                                     | 800ms                                       |
| Section open and close | Chevron turns, content slides                                                                                                                 | 220 / 480ms                                 |
| Menu, popover, dialog  | Scale 0.96 and 4 to 6px, origin at the pointer or the button; scrim fades                                                                     | 220ms in, 140ms out                         |
| Toast                  | Rises 14px and fades                                                                                                                          | 380ms                                       |
| All clear              | Circle scales to 1, confetti bursts out of the popper (`burst` keyframes)                                                                     | 520ms, 100 to 260ms delays                  |
| Logo, popup opens      | Dot grows, then the inner and the outer arcs scale out from the centre                                                                        | 260ms dot, 480ms arcs, 150 and 290ms delays |
| Logo, new items        | The dot swells and the arcs flash in `--ds-brand-flash`, inner arcs first, once                                                               | 560 to 640ms, arcs 80 and 230ms delay       |
| Switch                 | Knob slides, track colour changes                                                                                                             | 260 / 200ms                                 |

- Animate `transform` and `opacity` only, plus height when a row or section closes.
- **The store updates first.** Never delay a store change with `setTimeout` to let an animation finish; use `out:` transitions and `animate:flip`.
- A background poll animates new rows only. It never restaggers the whole list.
- Nothing loops except the refresh spinner during a slow request and loading skeletons.

## Accessibility

- Text contrast at least 4.5:1, icons and large text at least 3:1, in light and dark. Check new colours with a contrast tool before adding a token.
- Every icon-only button has an `aria-label`. Decorative icons are `aria-hidden`.
- Tabs use `role="tab"` with `aria-selected` and arrow-key navigation, segments and toggles `aria-pressed`, switches `role="switch"` with `aria-checked`, sections `aria-expanded`.
- Every `<button>` has an explicit `type`.
- Focus is visible on every control. Rows keep the inset focus bar.
- Keyboard covers everything the pointer does; new actions get a shortcut and appear in the Shortcuts pane.

## Copy

- The app is English. Sentence case for labels, buttons and menu items.
- Name things the same everywhere: Inbox, My PRs, Issues, Read, Snoozed, Starred, Created by me, To review, Reviewed, Assigned to me, Mark as read, Snooze, Mute.
- Repo and type are joined by `·`. Menu items that open a dialog end in `…`.

## Brand

- Wordmark `beacon` in lowercase, the `o` replaced by the signal mark in `--ds-text-brand` (`BeaconLogo`).
- The arcs of the mark are the signal, the only part that moves: once when the popup opens and once when a poll brings new unread items. Never as a loop, static under Reduce Motion.
- The beacon mark stands for Beacon only. GitHub and GitLab logos appear only to identify a source.

## Pull request checklist

- [ ] Colours come from `--ds-*` tokens, no literals and no opacity-derived colours
- [ ] No text below 10.5px
- [ ] At most one status chip per row, Open not shown, read rows at full opacity
- [ ] Header stays one row with every tab combination
- [ ] Motion only behind reduced-motion opt-in, store updates not delayed
- [ ] Light, dark and Reduce Motion checked, screenshot in the PR
- [ ] A rule that changed is updated in this file
