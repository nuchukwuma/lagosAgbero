import { useRef } from 'react'
import { modeComponent } from '../../game/modes/modeRegistry.js'
import { bus } from '../../game/narrative/eventBus.js'

// Shows the gameplay mode the story asked for, and sends its result back to
// the story through the event bus (the story never imports a mode directly).
export default function ModeHost({ view }) {
  const Mode = modeComponent(view.mode)
  const finished = useRef(false)
  const onFinish = (result) => {
    if (finished.current) return // a mode reports exactly once
    finished.current = true
    bus.emit('mode:result', result)
  }
  return <Mode mode={view.mode} params={view.params} outcomes={view.outcomes} onFinish={onFinish} />
}
