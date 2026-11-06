# Design system

A calm table, not a dashboard. The room is quiet, the felt is the game, and ivory tiles do the talking. One brass accent marks “this is yours” (your turn, a drawn tile, a primary action). Danger red is only for winning, leaving, or kicking.

The rules engine is untouched. This system is presentation: color, type, spacing, and the components screens are built from.

## Direction

- **Room.** Warm near-black by default. A light room follows the system theme or the person’s choice. The felt does not invert.
- **Table.** Deep green felt, a thin wood rail, ivory tiles with a real face (dots, bamboo, characters, honors, flowers).
- **Accent.** Brass, used once per decision: the primary button, the turn, the tile you just drew. Not a second palette.
- **Seats.** Four functional hues — East cinnabar, South brass, West celadon, North ink — only as a ring or bar so you can tell people apart. Names stay in the text color.
- **Light and dark.** Chrome (landing, lobby, sheets, the style guide) swaps surface and text. Tile inks, felt, and seat hues stay put so a tile means the same thing in both rooms.

## Principles

1. **The hand is the product.** Your tiles are the largest type on the screen. Other people’s hands are backs. Discards and melds stay face-up and big enough to read.
2. **One next action.** Your turn, a claim, or “waiting” is obvious without reading the whole table. Claims name the tile, who threw it, and every legal call, including pass.
3. **Plain words.** “Your turn”, “Pong”, “The table is holding for you”. Chinese terms stay where players expect them (莊, 過水), with a short explanation.
4. **Same components everywhere.** Buttons, tiles, seats, inputs, cards, sheets, and toasts come from this system. Screens do not invent one-off colors or sizes.
5. **Motion is short.** Tiles travel under a third of a second. People who prefer reduced motion get the same states with no travel and no pulse.
6. **Don’t pretend the rules changed.** A claim has no clock unless the server sends a deadline. The screen says the table is waiting. It does not auto-pass.

## Tokens

All raw values live in `client/src/styles/tokens.css`. Everything else uses the custom properties.

| Role | Token | Use |
| --- | --- | --- |
| Room | `--room`, `--surface`, `--surface-strong` | Page background and panels |
| Text | `--text`, `--text-muted` | Body copy and labels. Muted still meets AA on the surface |
| Accent | `--accent`, `--accent-ink` | Primary actions, your turn, drawn tile |
| Danger / success | `--danger`, `--success` | Win, exit, kick, and money that went up |
| Table | `--table-felt`, `--on-table` | Felt and type that sits on it. Stable in both themes |
| Tiles | `--tile-face`, `--tile-ink`, `--tile-red`, `--tile-green`, `--tile-blue` | Faces only |
| Seats | `--seat-east`, `--seat-south`, `--seat-west`, `--seat-north` | Identity mark only |
| Type | `--font-ui`, `--text-*`, `--leading-*`, `--weight-*` | One stack. No display font |
| Space | `--space-1` (4px) through `--space-16` (64px) | 4px base. Don’t use odd padding |
| Radius | `--radius-sm` to `--radius-pill` | Tiles sm, controls md, sheets lg |
| Elevation | `--shadow-rest`, `--shadow-raised`, `--shadow-overlay`, `--shadow-tile` | Panels, sheets, tiles |
| Layer | `--z-seat` … `--z-toast` | Flights under claims, claims under sheets, toasts on top |
| Motion | `--motion-fast` 120ms, `--motion-normal` 200ms, `--motion-slow` 320ms | Zeroed when `prefers-reduced-motion` is set |

Breakpoints are tokens too (`--bp-phone` 40rem, `--bp-tablet` 64rem, phone landscape height 31.25rem). Media queries repeat those lengths because a custom property cannot set a query. Phone portrait is below 40rem. Tablet is 40rem to 64rem. Desktop is 64rem and up. Phone landscape is a short viewport in landscape, and it compacts the table further.

## Components

Built in `client/src/ui/` and `client/src/components/Tile.tsx`. A dev-only gallery is at `#/styleguide` while `npm run dev` is running.

- **Button** — `primary`, `secondary`, `ghost`, `danger`. Sizes `sm`, `md`, `lg`. Every size is at least 44px tall. Disabled and a visible focus ring come free.
- **Tile** — sizes `hand`, `discard`, `meld`, and `back`. States: hover (fine pointer only), selected, just drawn, claimable, disabled. Faces are drawn, not a font glyph, so Safari and Chrome match. The corner index (`5p`, `E`) stays on hand tiles for anyone still learning the suits.
- **Seat panel** — wind, name, score, dealer / bot / away / 過水. The wind color is the ring, not the label.
- **Claim and action bar** — one button row for chi, pong, gang, win, and pass. The claim sheet also shows the tile and who threw it.
- **Modal / sheet** — centered for results. Confirmations dock to the bottom on a phone.
- **Toast** — errors. They sit above the hand, in danger colors that pass AA.
- **Badge, input, card** — lobby, rules, and status.

## Accessibility

- Text on room, surface, felt, accent, and danger meets WCAG AA (4.5:1 for body, 3:1 for large type).
- Controls are at least 44px on the short side. Hand tiles are at least 44px wide; the row scrolls instead of shrinking them off the screen.
- `:focus-visible` uses a 2px ring in `--focus`, offset from the control.
- Tiles expose an English accessible name (`5 Dots`, `Red Dragon`). Claim and result dialogs are named. The turn status is a live region.
- Color is never the only signal: your turn is also the words “Your turn”, a claimable tile is also labeled in the sheet, and a dim tile is one you are not allowed to throw.

## Usage rules

- Add a color only as a token with a job. Don’t drop a hex into a component.
- Prefer a component over a new class. If a screen needs a new pattern, add it to the gallery in the same change.
- Don’t use seat colors for buttons. Don’t use the accent for errors.
- Don’t animate layout. Animate a tile or a ring, then stop.
- Keep hit targets on the control, not on a tiny icon inside it.
- Copy stays short. If a rule needs a paragraph, it belongs in the lobby hint, not on the felt.
