# Fights: art direction

The look of the 2D street fights (`src/game/modes/fight/`). Written so new
fighters, stages and effects stay in one style. Inspired by cartoon mobile
brawlers in general; it copies none of them.

**Mood.** A noisy, funny Lagos street scrap: more Nollywood slapstick than
blood sport. Nobody bleeds; a knock-out is a flop to the road with crosses for
eyes.

**Camera.** Side-on, at the fighters' waist height, both always in shot. It
slides and eases out as they move apart. Shake, freeze and slow motion are
for impact only.

**Shapes.** Round and chunky. Fighters are about three heads tall: big round
heads in three-quarter view, short thick limbs, oversized fists and shoes.
Buildings are boxes with pitched zinc roofs; the HUD is circles and pills.

**Values.** Fighters are the brightest, highest-contrast things on screen.
The street behind is darker and flatter, further back is darker again (three
layers: far towers, rooftop silhouettes, shopfronts). At night the moon and
the lamps are the only near-white shapes besides the fighters.

**Palette.** Clothes and skin a little more saturated than life. Night:
deep blue to teal sky (#081a36 to #2c6688), blue silhouettes, warm lamp yellow
(#fff3a0). Day: clear blue sky, sun-bleached painted walls. Effects: yellow
and orange for hits, blue for blocks, red and white for the special, gold
coins.

**Detail.** Thick dark outlines (#120a08) round every fighter part, about 2.5
times thicker than the backdrop's lines. Two-tone cel shading with a small
highlight; no gradients on fighters. Faces: two big eyes with two shines,
heavy brows angled down, a mouth that changes with the moment. Lagos
specifics in the backdrop: signboards, water tanks, power lines,
yellow-and-black kerbs, "THIS LAND IS NOT FOR SALE".

**Rules.**
- A fighter's silhouette must read at phone size: no thin parts.
- The face is never hidden by the guard; fists sit below the chin.
- Nothing behind the fighters is as bright or saturated as they are.
- Every blow gets feedback within a frame (spark, word, freeze).
- Budget phones (Light mode) lose glows and frames, never readability.

**Signature.** The moon over the empty lot, the street lamps, and a crowd of
big-eyed fans throwing naira coins.
