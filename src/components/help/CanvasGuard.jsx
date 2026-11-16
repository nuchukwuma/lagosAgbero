import { Component, Fragment } from 'react'
import { webglSupport } from '../../game/world/webgl.js'
import WebGLHelp from './WebGLHelp.jsx'

// Wraps the 3D view. If the browser can't make a WebGL context, the game
// shows how to fix it instead of crashing to a blank page. Before giving up
// it tries once more with the plainest graphics settings (no antialiasing,
// no high-performance GPU request), which some machines need.
export default class CanvasGuard extends Component {
  constructor(props) {
    super(props)
    this.state = { safe: false, crashed: false, failed: webglSupport().ok ? null : 'webgl', tries: 0 }
  }

  // render nothing for a moment, so the broken view isn't drawn again at once
  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error) {
    const webglProblem = /webgl|context/i.test(String(error?.message || error))
    // WebGL: retry once with safe settings, then the 3D help.
    // Anything else is a bug in a scene, not the browser: say so plainly.
    this.setState((s) => (webglProblem ? (s.safe ? { failed: 'webgl' } : { safe: true, crashed: false }) : { failed: 'error' }))
  }

  render() {
    if (this.state.failed === 'webgl') return <WebGLHelp onBack={this.props.onBack} />
    if (this.state.failed === 'error')
      return (
        <div className="screen webgl-help" role="alert">
          <h2>This scene didn't load</h2>
          <p>Something went wrong drawing it. Your progress is saved.</p>
          <div className="menu">
            <button className="btn btn-primary" onClick={() => this.setState((s) => ({ failed: null, crashed: false, tries: s.tries + 1 }))}>
              Try again
            </button>
            {this.props.onBack && (
              <button className="btn" onClick={this.props.onBack}>
                Back to title
              </button>
            )}
          </div>
        </div>
      )
    if (this.state.crashed) return null
    return <Fragment key={this.state.tries}>{this.props.children(this.state.safe)}</Fragment>
  }
}
