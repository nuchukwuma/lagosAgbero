// Tutorials: a short guided tour of each game the first time you play it
// (and from the pause menu any time). Each step points at the control it's
// about (`at`: a CSS selector for something on screen; none = the middle)
// and says what to do with it. The game holds still while you read.
// Shown by components/hud/Tutorial.jsx.

const STICK = '.arcade-stick, .joystick'
const BOARD = '.arcade-canvas'
const SCORE = '.arcade-hud'
const btn = (id) => `[data-tut="${id}"]`

export const TUTORIALS = {
  // ---------------- the 2D mini-games
  escape: [
    { at: BOARD, text: 'Get to the end of the street. Cars, awnings and roofs are platforms; open gutters are deadly.' },
    { at: `${STICK}, ${btn('left')}`, text: 'Move here. A small push creeps (the Task Force sees you from less far), a full push runs.' },
    { at: btn('jump'), text: 'JUMP onto cars and roofs. Press again in the air for a double jump.' },
    { at: btn('roll'), text: 'ROLL under banners and past a swinging baton.' },
    { at: btn('hit'), text: 'HIT an officer. From behind, before he sees you, one blow puts him down.' },
    { at: btn('throw'), text: 'THROW a bottle (pick more up on the way). Hearts heal, stars make you untouchable, magnets pull in money.' },
  ],
  palmClimb: [
    { at: BOARD, text: 'Climb the palm to the calabash at the top, frond by frond.' },
    { at: `${STICK}, ${btn('left')}`, text: 'Move left and right to get under the next frond.' },
    { at: btn('jump'), text: 'JUMP up to it; press again in the air to go higher.' },
    { at: BOARD, text: 'Ants, wasps and falling fruit sting. When the wind comes, stand still on a frond.' },
  ],
  sneak: [
    { at: '.joystick, .controls', text: 'Move with the stick (or WASD / arrows). You walk crouched; running (hold RUN, or Shift) is quicker but guards close by hear it. Drag the screen (or V) to turn the camera.' },
    { at: '.task-panel', text: 'Guards still awake, time till dawn, your tries and the money you have taken. Every guard asleep opens the back gate.' },
    { at: null, text: 'The yellow patch in front of a guard is his torch. Inside it a ? fills over his head; when it is full he runs for you. Containers, bins and walls block his view.' },
    { at: null, text: 'Come up behind a guard who has not seen you: TAKE DOWN appears (or press E). He sleeps till morning and drops his money.' },
  ],
  wireSprint: [
    { at: '.sprint-pedals', text: 'Steer with ◀ ▶, GAS and BRAKE (or the arrows / WASD, Space to brake).' },
    { at: '.sprint-radar', text: 'The radar, north up: green dots are the drops, red the rivals, yellow you. Red marks are police roadblocks.' },
    { at: '.sprint-hud', text: 'The clock, your speed, the drops still to hit and how far, and how far the rivals have got. All three drops first wins the pool.' },
  ],
  shrineHeist: [
    { at: '.joystick, .controls', text: 'Move with the stick (or WASD / arrows). You walk crouched; running (hold RUN, or Shift) is quicker but guards close by hear it. Drag the screen (or V) to turn the camera.' },
    { at: '.task-panel', text: 'Sentries awake, time till first light, your tries, and whether you are still untouched. Take the regalia from the altar, then back to the farm road.' },
    { at: null, text: 'The yellow patch in front of a guard is his torch. Inside it a ? fills over his head; when it is full he runs for you. Containers, bins and walls block his view.' },
    { at: null, text: 'Come up behind a guard who has not seen you: TAKE DOWN appears (or press E). He sleeps till morning and drops his money.' },
  ],
  raidEscape: [
    { at: '.joystick, .controls', text: 'Move with the stick (or WASD / arrows). You walk crouched; running (hold RUN, or Shift) is quicker but guards close by hear it. Drag the screen (or V) to turn the camera.' },
    { at: '.task-panel', text: 'What is still to take and how many operatives are inside. Take all three (each one slows you), then out through the back door in the office before they seal the house.' },
    { at: null, text: 'The yellow patch in front of a guard is his torch. Inside it a ? fills over his head; when it is full he runs for you. Containers, bins and walls block his view.' },
    { at: null, text: 'Come up behind a guard who has not seen you: TAKE DOWN appears (or press E). He sleeps till morning and drops his money.' },
  ],
  penthouseRaid: [
    { at: '.joystick, .controls', text: 'Move with the stick (or WASD / arrows). You walk crouched; running (hold RUN, or Shift) is quicker but guards close by hear it. Drag the screen (or V) to turn the camera.' },
    { at: '.task-panel', text: 'Guards awake, cameras, and what is still to do. CRACK the safe and take the gold (heavy), then over the balcony.' },
    { at: null, text: 'The yellow patch in front of a guard is his torch. Inside it a ? fills over his head; when it is full he runs for you. Containers, bins and walls block his view.' },
    { at: null, text: 'Come up behind a guard who has not seen you: TAKE DOWN appears (or press E). He sleeps till morning and drops his money.' },
  ],
  warehouseHeist: [
    { at: '.joystick, .controls', text: 'Move with the stick (or WASD / arrows). You walk crouched; running (hold RUN, or Shift) is quicker but guards close by hear it. Drag the screen (or V) to turn the camera.' },
    { at: '.task-panel', text: 'What is still to do and the watchmen awake. Cartons, laptops, the ledger, then the loading dock.' },
    { at: null, text: 'The yellow patch in front of a guard is his torch. Inside it a ? fills over his head; when it is full he runs for you. Containers, bins and walls block his view.' },
    { at: null, text: 'Come up behind a guard who has not seen you: TAKE DOWN appears (or press E). He sleeps till morning and drops his money.' },
  ],
  examSneak: [
    { at: '.joystick, .controls', text: 'Move with the stick (or WASD / arrows). You walk crouched; running (hold RUN, or Shift) is quicker but guards close by hear it. Drag the screen (or V) to turn the camera.' },
    { at: '.task-panel', text: 'What is still to do. Never move while an invigilator can see you: it fails at once.' },
    { at: null, text: 'The yellow patch in front of a guard is his torch. Inside it a ? fills over his head; when it is full he runs for you. Containers, bins and walls block his view.' },
    { at: null, text: 'Come up behind a guard who has not seen you: TAKE DOWN appears (or press E). He sleeps till morning and drops his money.' },
  ],
  serverBreak: [
    { at: '.joystick, .controls', text: 'Move with the stick (or WASD / arrows). You walk crouched; running (hold RUN, or Shift) is quicker but guards close by hear it. Drag the screen (or V) to turn the camera.' },
    { at: '.task-panel', text: 'Breakers and drives still to do, and the clock till lockdown.' },
    { at: null, text: 'The yellow patch in front of a guard is his torch. Inside it a ? fills over his head; when it is full he runs for you. Containers, bins and walls block his view.' },
    { at: null, text: 'Come up behind a guard who has not seen you: TAKE DOWN appears (or press E). He sleeps till morning and drops his money.' },
  ],
  hostelDash: [
    { at: '.joystick, .controls', text: 'Move with the stick (or WASD / arrows). You walk crouched; running (hold RUN, or Shift) is quicker but guards close by hear it. Drag the screen (or V) to turn the camera.' },
    { at: '.task-panel', text: 'Security still awake and the clock to roll call. Get to your hostel door.' },
    { at: null, text: 'The yellow patch in front of a guard is his torch. Inside it a ? fills over his head; when it is full he runs for you. Containers, bins and walls block his view.' },
    { at: null, text: 'Come up behind a guard who has not seen you: TAKE DOWN appears (or press E). He sleeps till morning and drops his money.' },
  ],
  paperRelay: [
    { at: '.joystick, .controls', text: 'Move with the stick (or WASD / arrows). You walk crouched; running (hold RUN, or Shift) is quicker but guards close by hear it. Drag the screen (or V) to turn the camera.' },
    { at: '.task-panel', text: 'Drop zones still to reach and the clock to the bell. Then the senate building.' },
    { at: null, text: 'The yellow patch in front of a guard is his torch. Inside it a ? fills over his head; when it is full he runs for you. Containers, bins and walls block his view.' },
    { at: null, text: 'Come up behind a guard who has not seen you: TAKE DOWN appears (or press E). He sleeps till morning and drops his money.' },
  ],
  change: [
    { at: BOARD, text: 'A passenger pays: work out their change (fare taken from what they paid).' },
    { at: '.arcade-pad', text: 'Tap the notes to make up the change. ↶ takes the last one back.' },
    { at: btn('give'), text: 'GIVE when it adds up. Short change makes wahala.' },
  ],
  draughts: [
    { at: BOARD, text: 'International draughts: your red bottle tops move up the board. Tap a piece, then where it goes.' },
    { at: BOARD, text: 'Taking is compulsory, and you must take the most you can: tap each landing square in turn.' },
    { at: SCORE, text: 'Professor\'s level is up here. Beat him to win the stake.' },
  ],
  traffic: [
    { at: BOARD, text: 'You are the traffic light. One road flows at a time; the count shows how many are waiting on each.' },
    { at: btn('switch'), text: 'SWITCH (or tap anywhere) to let the other road go. Keep every road under eight.' },
    { at: BOARD, text: 'A siren means a convoy: let its road flow quickly.' },
  ],
  ayo: [
    { at: BOARD, text: 'Ayò: tap a cup on your side (the near row) to sow its seeds around, anticlockwise.' },
    { at: BOARD, text: 'If your last seed makes 2 or 3 on their side, you take them (and the cups before it too).' },
    { at: SCORE, text: 'More than 24 seeds wins.' },
  ],
  fakeParts: [
    { at: BOARD, text: 'Check each box against Mama Ngozi\'s brand chart: brand, origin, the hologram, the price.' },
    { at: btn('original'), text: 'ORIGINAL if everything matches…' },
    { at: btn('fake'), text: '…FAKE if anything is off. (Swipe works too.)' },
  ],
  akara: [
    { at: BOARD, text: 'Tap an empty place in the oil to drop a ball of batter.' },
    { at: BOARD, text: 'Tap it when it\'s golden to flip it; golden again, tap to lift it out. Too long and it burns.' },
    { at: SCORE, text: 'Fill the orders before the customers lose patience.' },
  ],
  penalty: [
    { at: BOARD, text: 'Shooting: tap where in the goal you aim, then tap again to stop the power bar in the green.' },
    { at: BOARD, text: 'Keeping: their striker waits for you. Read his lean, then DIVE or tap the box you\'ll cover.' },
  ],
  posters: [
    { at: BOARD, text: 'Tap the other side\'s posters to paste yours over them, and tap their boys to chase them off.' },
    { at: btn('refill'), text: 'REFILL your paste bucket when it runs low.' },
  ],
  ballots: [
    { at: BOARD, text: 'Read each ballot: one clear thumbprint in one box counts.' },
    { at: '.arcade-pad', text: 'Put it on its candidate\'s pile, or VOID it if it\'s spoilt.' },
  ],
  riceQueue: [
    { at: BOARD, text: 'Check the person at the front: a ward card from this ward, and no inked thumb (they\'ve collected already).' },
    { at: btn('serve'), text: 'SERVE the real ones…' },
    { at: btn('away'), text: '…SEND AWAY the cheats. Keep the crowd calm.' },
  ],
  pepperSoup: [
    { at: BOARD, text: 'The ticket shows the order Mama adds things: meat, spice mix, leaves, then pepper for the heat.' },
    { at: BOARD, text: 'Tap the bowls on the counter in that order: each one goes into the pot.' },
    { at: btn('serve'), text: 'SERVE when the ticket is all ticked (or tap the pot).' },
  ],
  barRush: [
    { at: BOARD, text: 'Customers sit with their order over their heads. Serve them before they give up.' },
    { at: '.arcade-pad', text: 'Tap the drink they want. Make the target before closing.' },
  ],
  whot: [
    { at: BOARD, text: 'Play a card that matches the top card\'s shape or number. Whot 20 goes on anything (then call a shape).' },
    { at: btn('market'), text: 'Nothing to play? GO TO MARKET for a card.' },
    { at: BOARD, text: 'Specials: 1 hold on, 2 pick two, 5 pick three, 8 suspension, 14 general market. Empty your hand first to win.' },
  ],
  // ---------------- the story games
  fight: [
    { at: '.fight-stick, .joystick', text: 'Walk with the stick. Push up to jump, down to squat under high blows.' },
    { at: '[aria-label="Punch"]', text: 'PUNCH: quick. Hits close together make a combo.' },
    { at: '[aria-label="Kick"]', text: 'KICK: heavy, longer reach. If it\'s blocked you\'re open for a moment.' },
    { at: '[aria-label="Block (hold)"]', text: 'Hold BLOCK to take the sting out of any blow, thrown things too.' },
    { at: '[aria-label="Special move"]', text: 'When the meter is full, the SPECIAL. Stand by a bottle, stone, crate or tyre and THROW appears.' },
  ],
  runner: [
    { at: '.runner-pad, .task-panel', text: 'Run! Swipe or tap the arrows: left/right changes lane, up jumps cartons, down slides under banners.' },
    { at: '[aria-label^="Throw"]', text: 'Pick up bottles on the road and THROW one at a Task Force man running at you.' },
    { at: '.task-panel', text: 'Get to the end before they catch you. Magnets, stars and charms on the road help.' },
  ],
  dance: [
    { at: '.dance-pad, .dance-btn', text: 'Arrows fall down four lanes. Tap the lane as each arrow reaches the line.' },
    { at: null, text: 'Your rival dances first; watch, then it\'s your turn. It starts slow and speeds up a little each round.' },
  ],
  feeCollection: [
    { at: '.joystick', text: 'Walk to each vehicle that stops on your side.' },
    { at: '.action-btn', text: 'Press COLLECT next to it. Stand in front of one that tries to run.' },
    { at: '.task-panel', text: 'Bring Baba Ticket his share. Tap this box to shrink it out of the way.' },
  ],
  chase: [
    { at: '.joystick', text: 'Run after the vehicle along the pavement. Dodge the people.' },
    { at: '.task-panel', text: 'Watch your stamina and the time.' },
    { at: '.action-btn', text: 'Press GRAB when you reach the door.' },
  ],
  drive: [
    { at: null, text: 'Steer, brake and use the horn. Pull onto the shoulder and stop at bus stops for passengers.' },
    { at: '.task-panel', text: 'Watch the fuel; buy more at a filling station.' },
  ],
  conductor: [{ at: null, text: 'Shout the right route, take fares and give correct change, and remember where everyone is going.' }],
  begging: [{ at: null, text: 'Pick who to beg and how: praise, a sad story or a show. Some people you should never beg.' }],
  rally: [{ at: null, text: 'Do the job you were paid for. Loud moves get noticed; faking it pays half.' }],
  bluff: [{ at: null, text: 'Answer before the time runs out. Whatever you claim is remembered for the rest of the story.' }],
  exam: [{ at: null, text: 'Pick the right answer before the bar runs out. Too many wrong and you fail.' }],
  initiation: [{ at: null, text: 'Answer as a Tortoise answers, before the candle burns down.' }],
  haggle: [
    { at: '.haggle-hint', text: 'Read the customer first: a car and gold means they can pay more; counting coins means they can\'t.' },
    { at: '.haggle-price', text: 'Set your price with − and + (or the quick prices).' },
    { at: '.haggle .result-actions', text: 'Ask. Too high and they counter: take it, or push and risk them walking.' },
  ],
}

export const tutorialFor = (mode) => TUTORIALS[mode] || null
