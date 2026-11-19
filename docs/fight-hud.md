# Fights: HUD design

Following the Claude Code Game Studios HUD template (philosophy, information
architecture, then the elements).

## 1. Philosophy

A fight is short and fast: the player's eyes belong on the two fighters. The
HUD lives at the edges in hard-edged pixel boxes that match the art, and only
shows what changes a decision in the next second.

**Visibility principle:** contextual by default; health and the special meter
always show during a fight.

**Rule of necessity:** an element earns its place when the player would throw
the wrong move without it.

## 2. Information architecture

| Information | Always | Contextual | Reasoning |
|---|---|---|---|
| Both fighters' health | ✓ | | Decides attack, block or run every second |
| Special meter | ✓ | | Decides when the special can be thrown |
| Who you're fighting | ✓ | | Name and pixel portrait by their bar |
| Combo count | | ✓ while a chain is alive | Only matters while it can grow |
| Crowd money (purse) | | ✓ during the fight, pops when coins land | A reward, not a decision |
| Move list | | ✓ before the fight starts | Learnt once, not needed mid-fight |
| Hit words, sparks, swooshes | | ✓ on impact | Feedback, gone in under a second |

## 3. Elements

- **Health bars:** top of the screen, square-ended rectangles with a 3 px
  navy border, ten tick marks, a light top edge; green for you, red for the
  opponent; they drain in steps. A square pixel portrait of each fighter sits
  at the outer end and blinks when health is low.
- **Special meter:** a thin square-ended bar under your health; it blinks
  yellow when full.
- **Purse:** a square box top left with a pixel coin and the naira total.
- **Buttons (touch):** round and see-through so the fight shows through,
  each with a pixel-art icon (fist, kicking shoe, double chevron jump,
  shield, dash arrow, lightning special, chunky arrows); punch is the largest.
- **Keys (desktop):** a one-line reminder at the bottom.
