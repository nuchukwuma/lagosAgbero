# Fights: art direction

The look of the 2D street fights (`src/game/modes/fight/`). Written in the
Claude Code Game Studios art-direction form so new fighters, places and
effects stay in one style. The character design follows a small free pixel
pack the project owner chose ("thicc n juicy"): it is recreated in code, not
copied, and dressed as NaijaVice's own cast.

**Mood.** A noisy, funny scrap in a real place: the bus stop, under the
bridge, the village square, the hostel. Cute and snappy rather than gory;
nobody bleeds, a knock-out is a flop with crosses for eyes.

**Camera.** Side-on, both fighters always in shot, fighters about 30% of the
screen tall so the place around them shows. The camera slides; it never
zooms (zooming breaks the pixel grid). Shake moves in whole sprite pixels.

**Shapes.** Pixel people about 21 pixels tall: a big round-cornered head half
their height, two tall dot eyes with a white glint, blush under them, a stubby
body, nub arms with block fists, short legs, little shoes. Scenery is boxes
and blocks on the same pixel grid: plank and block buildings, zinc roofs,
umbrellas, palms, pillars.

**Values.** Fighters are the brightest, highest-contrast things on screen
(full colour, dark outline). Passers-by are smaller and hazed into the scene;
far layers are flat silhouettes. At dusk and night the scene darkens and only
windows, lamps and signboards glow.

**Palette.** Outline #0e0d1e (navy, as in the pack). Each fighter wears their
own colours from their look; shade is the same colour darker and cooler. Sky
in four or five flat bands with dithered seams. Lagos: painted shop walls,
yellow-and-black kerbs, yellow danfo. Village: red earth, mud brown, zinc
grey, palm green. Campus: cream and terracotta blocks, lawn green.

**Detail.** One-pixel outline round every part; back arm and leg one shade
darker; a shadow row under the chin; hair and hats as pixel shapes per body
(fade, afro, dreads, puffs, bun, cap, beret, gele...). Signboards use a 3×5
pixel font. Animation is snappy: a few held frames per move, like the pack.

**Rules.**
- Pixels stay square: integer scaling only, no smoothing, no zoom.
- A fighter's face is never covered by its own guard.
- Nothing behind the fighters is as bright or as big as they are.
- The backdrop is where the fight is (world and nearest place).
- Background people use the same frames as the fighters (walk, stand,
  cheer), kept few (6, or 3 on Low) and hazed.
- Every blow gets feedback within a frame: flash, swoosh, spark, word, freeze.

**Signature.** Big-headed pixel brawlers in recognisably Nigerian places,
with the crowd's naira coins spinning up into the purse.
