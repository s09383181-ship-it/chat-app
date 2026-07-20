import { useEffect, useState, useRef } from 'react'
import { gun, CHAT } from './gun'

const STORAGE_KEY = 'chatapp_user'

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [alias, setAlias] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const messagesEnd = useRef(null)

  // Subscribe to messages
  useEffect(() => {
    if (!user) return

    const list = []
    const seen = new Set()

    CHAT.map().on((data, id) => {
      if (!data || !data.text || seen.has(id)) return
      seen.add(id)
      list.push({
        id,
        text: data.text,
        who: data.who || 'anon',
        time: data.time || Date.now(),
      })
      list.sort((a, b) => a.time - b.time)
      setMessages([...list])
    })

    return () => {
      // GUN doesn't have a clean unsubscribe, but component unmount handles it
    }
  }, [user])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleAuth(e) {
    e.preventDefault()
    setError('')
    if (!alias.trim() || !pass) {
      setError('Alias and password required')
      return
    }
    setBusy(true)

    const cb = (ack) => {
      setBusy(false)
      if (ack.err) {
        setError(ack.err)
        return
      }
      const u = { alias: alias.trim() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
      setUser(u)
    }

    if (mode === 'signup') {
      gun.user().create(alias.trim(), pass, cb)
    } else {
      gun.user().auth(alias.trim(), pass, cb)
    }
  }

  function handleSend(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    const msg = {
      text: t,
      who: user.alias,
      time: Date.now(),
    }
    CHAT.set(msg)
    setText('')
  }

  function logout() {
    gun.user().leave()
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
    setMessages([])
  }

  if (!user) {
    return (
      <div className="login">
        <h1>💬 Chat App</h1>
        <p>{mode === 'signup' ? 'Create an account' : 'Welcome back'}</p>
        <form onSubmit={handleAuth}>
          <input
            type="text"
            placeholder="Username"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            autoComplete="username"
            disabled={busy}
          />
          <input
            type="password"
            placeholder="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            disabled={busy}
          />
          <button type="submit" disabled={busy}>
            {busy ? '...' : mode === 'signup' ? 'Sign up' : 'Sign in'}
          </button>
          <button
            type="button"
            className="toggle"
            onClick={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup')
              setError('')
            }}
            disabled={busy}
          >
            {mode === 'signup'
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
          {error && <div className="error">{error}</div>}
        </form>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <h2>💬 Global Chat</h2>
        <div className="user">
          <span>👤 {user.alias}</span>
          <button className="logout" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty">No messages yet. Say hi! 👋</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.who === user.alias ? 'me' : ''}`}>
            <div className="who">{m.who}</div>
            <div>{m.text}</div>
            <div className="time">
              {new Date(m.time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEnd} />
      </div>
      <form className="input-bar" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
