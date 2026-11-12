// The game's icon set: small inline SVGs (no image downloads, any colour).
//   <Icon name="run" />        <Icon name="talk" size={34} />
// Controls show icons instead of words, so the game reads the same in any
// language and stays clear on a small screen. Every button still carries an
// aria-label / title in words.

const P = {
  run: ['M15.5 4.6a1.9 1.9 0 1 0 .01 0', 'M13 9l-4 2.6 1.2 4-3.4 4.6', 'M10.2 15.6l3.8 1.6.8 5', 'M13 9l3.6 2.4 3.2-.8', 'M9 11.6l-3.2 1.8'],
  talk: ['M4 5h16v11H11l-5 4v-4H4z', 'M8 9h8', 'M8 12h5'],
  buy: ['M4.5 9h15l-1.6 10.5H6.1z', 'M8.5 9L12 3.5 15.5 9', 'M9.5 12.5v4', 'M14.5 12.5v4'],
  naira: ['M7 20V4l10 16V4', 'M4 10h16', 'M4 14h16'],
  hand: ['M7 13.5V6.2a1.4 1.4 0 0 1 2.8 0V11', 'M9.8 11V4.4a1.4 1.4 0 0 1 2.8 0V11', 'M12.6 11V5.4a1.4 1.4 0 0 1 2.8 0V12', 'M15.4 12V8.2a1.4 1.4 0 0 1 2.8 0V15c0 4-2.6 6-6 6s-5.2-1.2-7.2-5l-1.8-3.4a1.4 1.4 0 0 1 2.4-1.4l1.4 2.3'],
  megaphone: ['M4 10v4h3l8 5V5l-8 5z', 'M18 9.2a4 4 0 0 1 0 5.6', 'M7 14l1.2 5h2.6'],
  fist: ['M6.5 12V8.6a1.5 1.5 0 0 1 3 0', 'M9.5 9V7.4a1.5 1.5 0 0 1 3 0V9', 'M12.5 9V8a1.5 1.5 0 0 1 3 0v1.4', 'M15.5 9.6a1.5 1.5 0 0 1 3 0V14c0 4-2.8 6.5-6.4 6.5S5.5 18.2 5.5 14.6v-1.2a1.4 1.4 0 0 1 1.4-1.4h4.6'],
  boot: ['M8 3v9l-3.4 3.2V19h15v-1.8c0-2.2-2-3.4-5.2-4.2L13.4 3z', 'M4.6 16.5h15'],
  shield: ['M12 3l8 3v6c0 5-3.4 8-8 9.4C7.4 20 4 17 4 12V6z', 'M12 7v10'],
  dodge: ['M9.5 6L4 12l5.5 6', 'M14.5 6L20 12l-5.5 6'],
  bolt: ['M13.5 2L5 14h6l-1.2 8L19 10h-6z'],
  wheel: ['M12 3a9 9 0 1 0 .01 0', 'M12 9.6a2.4 2.4 0 1 0 .01 0', 'M12 9.6V3', 'M9.9 13.2L4.2 16', 'M14.1 13.2l5.7 2.8'],
  bus: ['M4 5.5h16v11H4z', 'M4 11h16', 'M8 5.5V11', 'M16 5.5V11', 'M7.5 16.5v2.3', 'M16.5 16.5v2.3', 'M6.5 13.8h1.5', 'M16 13.8h1.5'],
  people: ['M8.5 8.2a2.6 2.6 0 1 0 .01 0', 'M15.8 9.2a2.2 2.2 0 1 0 .01 0', 'M3.5 20c0-3.6 2.2-5.6 5-5.6s5 2 5 5.6', 'M14.6 14.6c3.2-.5 5.9 1.4 5.9 5.4'],
  radio: ['M4 9h16v10.5H4z', 'M7.5 9l9-5', 'M9 14.2a2.5 2.5 0 1 0 .01 0', 'M14.5 12.8h3.5', 'M14.5 15.8h3.5'],
  quest: ['M12 3.5v10.5', 'M12 18.6v1.2'],
  fuel: ['M5 20.5V4.5h8v16z', 'M3.5 20.5h11', 'M5 11h8', 'M13 8l3.6 2.6V17a1.6 1.6 0 0 0 3.2 0V9.2L17 6.4'],
  gas: ['M6 13l6-6 6 6', 'M6 19l6-6 6 6'],
  brake: ['M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z', 'M8 12h8'],
  horn: ['M3.5 9.5v5h3.2l6.3 4.5V5L6.7 9.5z', 'M16.5 8.5a5 5 0 0 1 0 7', 'M19 6a8.5 8.5 0 0 1 0 12'],
  left: ['M14.5 5L7.5 12l7 7'],
  right: ['M9.5 5l7 7-7 7'],
  up: ['M5 14.5L12 7.5l7 7'],
  down: ['M5 9.5l7 7 7-7'],
  pause: ['M8 5v14', 'M16 5v14'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  stats: ['M5 20V11', 'M12 20V4', 'M19 20v-6'],
  music: ['M9 18V5.5l10-2V16', 'M6.5 20.5a2.5 2.5 0 1 0 .01 0', 'M16.5 18.5a2.5 2.5 0 1 0 .01 0'],
  sound: ['M4 9.5v5h3.2l5.3 4.2V5.3L7.2 9.5z', 'M16 9a4.5 4.5 0 0 1 0 6'],
  mute: ['M4 9.5v5h3.2l5.3 4.2V5.3L7.2 9.5z', 'M16 9.5l5 5', 'M21 9.5l-5 5'],
  door: ['M6 21V3h10v18', 'M4 21h16', 'M13 12v1.5'],
  star: ['M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z'],
}

export const ICON_NAMES = Object.keys(P)

export default function Icon({ name, size = 28, stroke = 2.2, ...rest }) {
  const paths = P[name] || P.quest
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
