import StealthMode from './StealthMode.jsx'

// The stealth missions that each have a mode of their own (story JSON / Games
// tab / Lagos Online name them by these ids). Each is StealthMode with its mission.
export const PenthouseRaidMode = (props) => <StealthMode {...props} mission="penthouseRaid" />
export const WarehouseHeistMode = (props) => <StealthMode {...props} mission="warehouseHeist" />
export const ExamSneakMode = (props) => <StealthMode {...props} mission="examSneak" />
export const ServerBreakMode = (props) => <StealthMode {...props} mission="serverBreak" />
export const HostelDashMode = (props) => <StealthMode {...props} mission="hostelDash" />
export const PaperRelayMode = (props) => <StealthMode {...props} mission="paperRelay" />
