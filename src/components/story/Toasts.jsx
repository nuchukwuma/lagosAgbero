import { useEffect } from 'react'

// Short notices like "Professor will remember that." They fade on their own.
function Toast({ toast, onDone }) {
  useEffect(() => {
    const id = setTimeout(() => onDone(toast.id), 3200)
    return () => clearTimeout(id)
  }, [toast.id, onDone])
  return <div className="toast">{toast.text}</div>
}

export default function Toasts({ toasts, onDone }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDone={onDone} />
      ))}
    </div>
  )
}
