import { Component } from 'react'
import { webglSupport } from '../../game/world/webgl.js'
import WebGLHelp from './WebGLHelp.jsx'

// Wraps the 3D view. If the browser can't make a WebGL context, the game
// shows how to fix it instead of crashing to a blank page. Before giving up
// it tries once more with the plainest graphics settings (no antialiasing,
// no high-performance GPU request), which some machines need.
export default class CanvasGuard extends Component {
  constructor(props) {
    super(props)
    this.state = { safe: false, crashed: false, failed: !webglSupport().ok }
  }

  // render nothing for a moment, so the broken view isn't drawn again at once
  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error) {
    const webglProblem = /webgl|context/i.test(String(error?.message || error))
    // first WebGL failure: retry with safe settings; anything else: show help
    this.setState((s) => (webglProblem && !s.safe ? { safe: true, crashed: false } : { failed: true }))
  }

  render() {
    if (this.state.failed) return <WebGLHelp onBack={this.props.onBack} />
    if (this.state.crashed) return null
    return this.props.children(this.state.safe)
  }
}
