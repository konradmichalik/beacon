# Screen designs

The reference designs for every Beacon screen. They live on a design canvas: https://claude.ai/artifact/PW7jSkiDYgcAS8RP7LE1XK. The canvas is private to its owner until it is shared from its Share menu.

Board titles on the canvas are German; the app copy on the boards is English and can be taken as is. Values on the boards are demo data. The board "Ist-Zustand" shows the popup before the redesign and is not a target.

The rules behind these screens are in [rules.md](rules.md). The previews are exports of the canvas; click one for the full size. When a board changes on the canvas, export it again and replace its file in `screens/`.

## Popup

| Board | Screen                    | What it settles                                                   | Preview                                                                                                             |
| ----- | ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1     | Inbox                     | Header, filter bar, row anatomy, Read footer, light tokens        | <a href="screens/01-inbox.png"><img src="screens/01-inbox.png" width="140" alt="Board 1"></a>                       |
| 1d    | Inbox, dark mode          | Dark token values                                                 | <a href="screens/01d-inbox-dark.png"><img src="screens/01d-inbox-dark.png" width="140" alt="Board 1d"></a>          |
| 2     | Inbox with Issues enabled | Three tabs in one header row                                      | <a href="screens/02-inbox-issues-tab.png"><img src="screens/02-inbox-issues-tab.png" width="140" alt="Board 2"></a> |
| 3     | My PRs                    | Role sections, attention chip plus meta facts, collapsed Reviewed | <a href="screens/03-my-prs.png"><img src="screens/03-my-prs.png" width="140" alt="Board 3"></a>                     |
| 4     | Issues                    | Created by me and Assigned to me, label pills, comment count      | <a href="screens/04-issues.png"><img src="screens/04-issues.png" width="140" alt="Board 4"></a>                     |
| 5     | All clear                 | Party popper empty state above the Read footer                    | <a href="screens/05-all-clear.png"><img src="screens/05-all-clear.png" width="140" alt="Board 5"></a>               |
| 6     | Not connected             | Empty state with one primary action, no filter bar                | <a href="screens/06-not-connected.png"><img src="screens/06-not-connected.png" width="140" alt="Board 6"></a>       |
| 7     | Context menu              | Placement at the pointer, shortcut hints, highlighted row         | <a href="screens/07-context-menu.png"><img src="screens/07-context-menu.png" width="140" alt="Board 7"></a>         |
| 8     | Filters                   | Search, segmented single choices, project checkboxes              | <a href="screens/08-filters.png"><img src="screens/08-filters.png" width="140" alt="Board 8"></a>                   |
| 9     | Snooze                    | Options with time and number key, wake on activity                | <a href="screens/09-snooze.png"><img src="screens/09-snooze.png" width="140" alt="Board 9"></a>                     |
| 10    | Mute                      | Criteria with values, match preview, one primary action           | <a href="screens/10-mute.png"><img src="screens/10-mute.png" width="140" alt="Board 10"></a>                        |
| 11    | Mark all as read          | All clear plus the undo toast                                     | <a href="screens/11-undo-toast.png"><img src="screens/11-undo-toast.png" width="140" alt="Board 11"></a>            |

## Settings window

| Board | Screen      | What it settles                                                      | Preview                                                                                                                      |
| ----- | ----------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 12    | Connections | Connected account card, disconnected form with visible labels        | <a href="screens/12-settings-connections.png"><img src="screens/12-settings-connections.png" width="160" alt="Board 12"></a> |
| 13    | Preferences | Toolbar panes, grouped cards, segmented controls, swatches, switches | <a href="screens/13-settings-preferences.png"><img src="screens/13-settings-preferences.png" width="160" alt="Board 13"></a> |
| 14    | Alerts      | Delivery modes, dependent rows (interval, sound)                     | <a href="screens/14-settings-alerts.png"><img src="screens/14-settings-alerts.png" width="160" alt="Board 14"></a>           |
| 15    | Shortcuts   | Global shortcut, every key named, two columns                        | <a href="screens/15-settings-shortcuts.png"><img src="screens/15-settings-shortcuts.png" width="160" alt="Board 15"></a>     |
| 16    | About       | Mark, version, update state, links                                   | <a href="screens/16-settings-about.png"><img src="screens/16-settings-about.png" width="160" alt="Board 16"></a>             |

## Building blocks and motion

| Board     | What it settles                                                                                                                                                                                                  | Preview                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 17        | Row states                                                                                                                                                                                                       | Every row state for inbox, pull requests and issues, chip tones with contrast before and after, the chip rules | <a href="screens/17-row-states.png"><img src="screens/17-row-states.png" width="200" alt="Board 17"></a> |
| 18        | Motion                                                                                                                                                                                                           | Every animation with duration, easing and the Svelte tool to build it                                          | <a href="screens/18-motion.png"><img src="screens/18-motion.png" width="200" alt="Board 18"></a>         |
| Prototype | Clickable popup on the canvas (press Play): tab and source switches, mark as read, mark all as read with undo, refresh with a new item, context menu, filter, snooze and mute dialogs. Not exportable as a still |                                                                                                                |
