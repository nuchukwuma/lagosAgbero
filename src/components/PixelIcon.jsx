// Pixel-art icons for the fight buttons, to match the pixel fighters. Each
// icon is a 12×12 grid of colour letters; the dark outline round the shape is
// added automatically, like the fighters' own outline.

const COLORS = { w: '#f1feff', y: '#ffd23a', o: '#ff8a2a', b: '#4b8df0', k: '#0e0d1e', g: '#9aa0b4', r: '#ff5a4a' }
const INK = '#0e0d1e'

const ICONS = {
  fist: [
    '..wwwwwww...',
    '.wwkwwkwwk..',
    '.wwwwwwwwww.',
    '.wwkwwkwwww.',
    '.wwwwwwwwww.',
    '.wwwwwkkkww.',
    '.wwwwwwwwww.',
    '..wwwwwwwww.',
    '...wwwwwww..',
    '....wgggww..',
    '....wggggw..',
    '....wwwwww..',
  ],
  boot: [
    '.....wwww...',
    '.....wkkw...',
    '.....wwww...',
    '.....wwwww..',
    '.y.y.wwwwww.',
    '.....wwwwwww',
    'y.y..wwkwwww',
    '....wwwwwwww',
    '.y.ywwwwwwww',
    '....rrrrrrrr',
    '....gggggggg',
    '............',
  ],
  up: [
    '.....ww.....',
    '....wwww....',
    '...wwwwww...',
    '..www..www..',
    '.www....www.',
    '............',
    '.....yy.....',
    '....yyyy....',
    '...yyyyyy...',
    '..yyy..yyy..',
    '.yyy....yyy.',
    '............',
  ],
  shield: [
    '.wwwwwwwwww.',
    '.wbbbbwbbbw.',
    '.wbbbbwbbbw.',
    '.wbbbbwbbbw.',
    '.wwwwwwwwww.',
    '.wbbbbwbbbw.',
    '..wbbbwbbw..',
    '..wbbbwbbw..',
    '...wbbwbw...',
    '....wbww....',
    '.....ww.....',
    '............',
  ],
  dodge: [
    '............',
    '....w.......',
    '...ww.......',
    '..wwwwwwww..',
    '.wwwwwwwwww.',
    '..wwwwwwww..',
    '...ww.......',
    '....w.......',
    '............',
    '.....y.y.y..',
    '......y.y.y.',
    '............',
  ],
  bolt: [
    '.......yyyy.',
    '......yyyy..',
    '.....yyyo...',
    '....yyyo....',
    '...yyyyyyyy.',
    '..oyyyyyyo..',
    '......yyo...',
    '.....yyo....',
    '....yyo.....',
    '...yo.......',
    '..y.........',
    '............',
  ],
  right: [
    '....w.......',
    '....ww......',
    '....www.....',
    'wwwwwwww....',
    'wwwwwwwww...',
    'wwwwwwwwww..',
    'wwwwwwwww...',
    'wwwwwwww....',
    '....www.....',
    '....ww......',
    '....w.......',
    '............',
  ],
}
ICONS.left = ICONS.right.map((row) => [...row].reverse().join(''))

const cache = {}
function cellsOf(name) {
  if (cache[name]) return cache[name]
  const rows = ICONS[name] || ICONS.fist
  const filled = (x, y) => y >= 0 && y < 12 && x >= 0 && x < 12 && rows[y][x] !== '.'
  const cells = []
  for (let y = -1; y <= 12; y++)
    for (let x = -1; x <= 12; x++) {
      if (filled(x, y)) cells.push([x, y, COLORS[rows[y][x]] || COLORS.w])
      else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) cells.push([x, y, INK])
    }
  cache[name] = cells
  return cells
}

export default function PixelIcon({ name, size = 32 }) {
  return (
    <svg className="icon pixel-icon" width={size} height={size} viewBox="-1 -1 14 14" shapeRendering="crispEdges" aria-hidden="true">
      {cellsOf(name).map(([x, y, c]) => (
        <rect key={`${x},${y}`} x={x} y={y} width="1.02" height="1.02" fill={c} />
      ))}
    </svg>
  )
}
