// How to play: the rules of whatever game is running, for the pause menu.
// The 2D mini-games carry their own rules (games/*.js); the story modes are
// written here, in the same words their intros use.
import { ARCADE_GAMES } from './arcade/index.js'

const ARCADE = Object.fromEntries(ARCADE_GAMES.map((g) => [g.id, g]))
const call = (x, p) => (typeof x === 'function' ? x(p) : x)

const STORY_MODES = {
  feeCollection: () => ({
    title: 'Fee run',
    rules: [
      'Vehicles stop on your side. Walk to each one and press COLLECT.',
      'Each kind pays its own fee (danfo, molue, taxi, keke, okada, lorry). A higher fee means more haggling, refusing and running.',
      "Block am: stand in front of a vehicle that wants to run and it can't move. Refusers pay; the others wait for you.",
      "Bring Baba Ticket's share by the end. Tired drivers late in the day are harder to collect from.",
    ],
  }),
  chase: () => ({
    title: 'Chase',
    rules: ['Run along the pavement after the vehicle and dodge the people in the way.', 'Running burns stamina: ease off before you run dry.', 'Press GRAB when you reach the door. Run out of time and they get away.'],
  }),
  wireSprint: () => ({
    title: 'Beat-the-Bet Wire Sprint',
    rules: [
      'A race across a Wuse street grid. Hit the three drop points (the green beams), in any order, before the bet closes.',
      "If either rival bettor's driver hits all three first, the pool is cleared and you lose.",
      'Blue arrows on the road: a few seconds of boost. Police roadblocks close some avenues; alleys through the blocks are shortcuts the rivals do not take, with carts in the way.',
      'Walls and barriers kill your speed. The radar (top right) shows the drops, the rivals and you, north up.',
      'Arrows / WASD: steer, gas, brake (Space brakes). On a phone: the pedals.',
    ],
  }),
  raidEscape: () => ({
    title: 'EFCC Raid Escape',
    rules: [
      'Night, inside the Rich Street duplex. Operatives come through the front door one after another, torches up, and sweep the rooms.',
      'Take the hard drive (by the server rack), the laptop (on the office desk) and the cash (on the bedroom safe): TAKE IT, or E.',
      'Every thing you carry slows you down. With all three, the back door in the office opens: get out before they seal the house.',
      'In a torch beam a ? fills, then ! and they come for you. Furniture and walls block their view. Running close by is heard.',
      "Beside an operative who hasn't seen you: TAKE DOWN (E).",
    ],
  }),
  shrineHeist: () => ({
    title: 'Steal Untouched',
    rules: [
      "Night in the bush east of Nkwo Agu: a rival confraternity's walled shrine compound. Their regalia is on the altar.",
      'Get in through the gate on the west side, take the regalia (TAKE IT, or E), and get back to the farm road.',
      'Sentries see inside their torch beams; a ? fills, then ! and they come for you. Walls, crates and cartons block their view. Running close by is heard.',
      "Beside a sentry who hasn't seen you: TAKE DOWN (E). A sentry who finds him comes looking.",
      'Nobody sees you all night: untouched, and the respect is tripled. Seen once, and it is just a theft.',
      'Move with the stick or WASD / arrows; run with RUN or Shift; drag the screen or press V to turn the camera.',
    ],
  }),
  sneak: () => ({
    title: 'Back Gate',
    rules: [
      'Night on the Royal Crest campus: get from the hostel out through the back gate before dawn.',
      "A guard sees inside his torch beam (the patch of light in front of him). In it, a ? fills over his head; full, he runs for you. Containers, bins and walls block his view.",
      'You walk crouched. Running is quicker, but a guard close by hears it and turns round.',
      "Come up beside a guard who hasn't seen you and TAKE DOWN (E): he sleeps till morning and drops his money. A guard who finds him comes looking.",
      'Every guard asleep opens the back gate. Caught, you start again from the hostel; out of tries, or dawn, and the night is over.',
      'Move with the stick or WASD / arrows; run with RUN or Shift; drag the screen or press V to turn the camera.',
    ],
  }),
  fight: () => ({
    title: 'Fight',
    rules: [
      'Punch: quick and light; chain them into a combo. Kick: heavy with longer reach; if it is blocked you are open for a moment.',
      'Jump (stick up) hops over a kick; punch or kick in the air for a flying kick. Squat (stick down) ducks punches and the spin kick.',
      'Block (hold, or hold back) takes most of the sting out of any blow. Dodge is a quick step back: nothing touches you.',
      'Landing hits fills your meter. When it is full, use the Special: the Lagos Roundabout.',
      'Empty their health bar before they empty yours. The crowd throws money for combos and specials.',
      'Keys: A/D move · W jump · S squat · J punch · K kick · L block (hold) · Space dodge · U special.',
    ],
  }),
  runner: (p) => ({
    title: 'Run',
    rules: [
      `Reach ${p.goal ?? 540} m to escape${p.endless ? ' (endless: go as far as you can)' : ''}. Grab naira notes on the way.`,
      'Swipe, or use the arrows: left/right change lane, up jumps cartons, down slides under banners.',
      'Danfos and Task Force men come at you: get out of their lane.',
      'Power-ups: the red magnet pulls in notes, the gold star makes you untouchable, the blue charm forgives a stumble.',
      'Empty bottles lie on the road: pick them up (up to 3) and THROW one (T) down your lane to knock over a Task Force man running at you.',
    ],
  }),
  conductor: () => ({
    title: 'Conductor',
    rules: ['Shout the correct route so the correct people enter.', 'Give correct change. Short change means wahala.', 'Remember where each passenger is going. Forget, and more wahala.'],
  }),
  begging: () => ({
    title: 'Begging run',
    rules: ['Ogas love praise. Madams and pastors love a sad story. Big boys love a show.', 'Standing in front of cars pays sometimes, but the estate will remember.', 'Some people you should never beg. Read the signs.', 'Flashy clothes make rich people give less.'],
  }),
  rally: () => ({
    title: 'Rally',
    rules: ['Do the job you were paid for: crowd, chants or posters.', 'Loud moves get noticed by cameras and police.', 'You can fake it and film yourself. Settlement pays half and remembers.', 'Touching their speakers can start a fight.'],
  }),
  initiation: (p) => ({
    title: 'The Shell House',
    rules: [`${(p.questions || []).length || 5} questions, ${p.seconds ?? 12} seconds each.`, 'Answer as a Tortoise answers: remember what Chuks taught you.', 'Too many wrong answers and the brothers will "correct" you.'],
  }),
  exam: (p) => ({
    title: 'Exam',
    rules: [`${p.count ?? 5} questions, ${p.seconds ?? 16} seconds each.`, 'Pick an answer before the time runs out. No answer counts as wrong.', 'Too many wrong answers and you fail.'],
  }),
  drive: () => ({
    title: 'Drive the danfo',
    rules: [
      "Pull onto the shoulder (far right) and stop at bus stops to load passengers. Don't pass anybody's stop.",
      'Watch the fuel. Stop at a filling station to buy more.',
      'Horn makes cars move. Crashes cost repairs, and some drivers come out to fight.',
      "Task Force checkpoint: stop and settle, or floor it and they'll chase you.",
    ],
  }),
  bluff: () => ({
    title: 'Bluff',
    rules: ['Answer before the time runs out. Hesitating looks bad.', 'Whatever you claim is remembered for the rest of the story. Change your story later and people notice.', 'You can always tell the truth. Some truths change everything.'],
  }),
  haggle: () => ({
    title: 'Haggle',
    rules: [
      'One customer at a time. Read them: a car and gold means they can pay more; counting coins means they cannot.',
      'Name your price. Too high and they counter: take it, or push and risk them walking.',
      'Sell enough before the day ends.',
    ],
  }),
  dance: (p) => ({
    title: 'Dance battle',
    rules: [
      'Arrows fall down four lanes. Tap the lane (← ↓ ↑ →, or D F J K) as each arrow reaches the line at the bottom.',
      'On the line is PERFECT, a little off is GOOD; let one pass and it is a MISS, and your combo starts again.',
      `${p.rival || 'Your rival'} dances a phrase first (watch their arrows), then it is your turn. Every arrow you hit is a move your dancer does.`,
      'Three rounds, each busier than the last. The bigger score wins.',
    ],
  }),
}

/** { title, rules: string[] } for a mode and its params, or null if we have none. */
export function howToPlay(mode, params = {}) {
  const g = ARCADE[mode]
  if (g) return { title: call(g.title, params), rules: call(g.rules, params) || [] }
  const f = STORY_MODES[mode]
  return f ? f(params) : null
}

export const HOW_TO_PLAY_MODES = Object.keys(STORY_MODES)
