import StealthMode from './StealthMode.jsx'

// EFCC Raid Escape (the Lekki arc): the operatives come through the front door
// of the Rich Street duplex; take the hard drive, the laptop and the cash, and
// get out through the back.
export default function RaidEscapeMode(props) {
  return <StealthMode {...props} mission="raidEscape" />
}
