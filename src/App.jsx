import { useEffect, useState, useRef } from 'react'
import { gun, CHAT, BANS, checkAdminPassword, getDeviceId } from './gun'

const ALIAS_KEY = 'chatapp_alias'
const ADMIN_KEY = 'chatapp_admin'
const DEVICE_KEY = 'chatapp_device_id'

export default function App() {
  // device id یکتا
  const [deviceId] = useState(() => {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = getDeviceId()
    }
    return id
  })

  // alias (اسم مستعار)
  const [alias, setAlias] = useState(() => localStorage.getItem(ALIAS_KEY) || '')
  const [aliasInput, setAliasInput] = useState('')

  // state ادمین
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === '1')
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [adminPw, setAdminPw] = useState('')
  const [adminError, setAdminError] = useState('')

  // state اصلی
  const [messages, setMessages] = useState([])
  const [bans, setBans] = useState({})
  const [text, setText] = useState('')
  const [isBanned, setIsBanned] = useState(false)
  const [banInfo, setBanInfo] = useState(null)
  const [menuMsg, setMenuMsg] = useState(null) // پیامی که روش کلیک شده
  const messagesEnd = useRef(null)
  const inputRef = useRef(null)

  // subscribe bans
  useEffect(() => {
    const list = {}
    BANS.map().on((data, id) => {
      if (data && (data.deviceId || data.alias)) {
        list[id] = data
      } else {
        delete list[id]
      }
      setBans({ ...list })
    })
  }, [])

  // subscribe messages
  useEffect(() => {
    const list = []
    const seen = new Set()

    CHAT.map().on((data, id) => {
      if (!data || !data.text || seen.has(id)) return
      seen.add(id)
      list.push({
        id,
        text: data.text,
        who: data.who || 'کاربر',
        deviceId: data.deviceId || '',
        time: data.time || Date.now(),
      })
      list.sort((a, b) => a.time - b.time)
      if (list.length > 300) list.splice(0, list.length - 300)
      setMessages([...list])
    })
  }, [])

  // چک بن
  useEffect(() => {
    const banList = Object.values(bans)
    const myBan = banList.find(
      (b) => b.deviceId === deviceId || (alias && b.alias === alias)
    )
    if (myBan && !isAdmin) {
      setIsBanned(true)
      setBanInfo(myBan)
    } else {
      setIsBanned(false)
      setBanInfo(null)
    }
  }, [bans, deviceId, alias, isAdmin])

  // auto scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showAdminPanel])

  // ثبت alias
  function setNickname(e) {
    e.preventDefault()
    const a = aliasInput.trim().slice(0, 20)
    if (!a) return
    localStorage.setItem(ALIAS_KEY, a)
    setAlias(a)
    setAliasInput('')
  }

  // تغییر alias
  function changeAlias() {
    localStorage.removeItem(ALIAS_KEY)
    setAlias('')
    setText('')
  }

  // ارسال پیام
  function sendMessage(e) {
    e?.preventDefault()
    const t = text.trim()
    if (!t || !alias || isBanned) return
    const id = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
    CHAT.get(id).put({
      text: t,
      who: alias,
      deviceId,
      time: Date.now(),
    })
    setText('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // ورود ادمین
  async function adminLogin(e) {
    e.preventDefault()
    setAdminError('')
    if (!adminPw) {
      setAdminError('رمز رو بزن')
      return
    }
    const ok = await checkAdminPassword(adminPw)
    if (ok) {
      sessionStorage.setItem(ADMIN_KEY, '1')
      setIsAdmin(true)
      setShowAdminLogin(false)
      setShowAdminPanel(true)
      setAdminPw('')
    } else {
      setAdminError('رمز اشتباهه')
    }
  }

  // بن کاربر
  function banUser(msg) {
    if (!isAdmin || !msg) return
    const id = 'b_' + (msg.deviceId || msg.who)
    BANS.get(id).put({
      alias: msg.who,
      deviceId: msg.deviceId,
      by: 'admin',
      time: Date.now(),
      reason: 'توسط مدیر بن شد',
    })
    setMenuMsg(null)
  }

  // رفع بن
  function unbanUser(banId) {
    if (!isAdmin) return
    BANS.get(banId).put(null)
  }

  // ===== RENDER =====

  // 1. صفحه ورود ادمین
  if (showAdminLogin) {
    return (
      <div className="login">
        <div className="login-card">
          <h1>🛡️ پنل مدیریت</h1>
          <p>رمز رو وارد کن</p>
          <form onSubmit={adminLogin}>
            <input
              type="password"
              placeholder="رمز مدیر"
              value={adminPw}
              onChange={(e) => setAdminPw(e.target.value)}
              autoFocus
            />
            <button type="submit">ورود</button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setShowAdminLogin(false)
                setAdminError('')
                setAdminPw('')
              }}
            >
              برگشت
            </button>
            {adminError && <div className="err">{adminError}</div>}
          </form>
        </div>
      </div>
    )
  }

  // 2. صفحه انتخاب اسم
  if (!alias) {
    return (
      <div className="login">
        <div className="login-card">
          <div className="app-logo">💬</div>
          <h1>چت آنلاین</h1>
          <p>یه اسم برای خودت انتخاب کن</p>
          <form onSubmit={setNickname}>
            <input
              type="text"
              placeholder="اسم مستعار"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <button type="submit" disabled={!aliasInput.trim()}>
              شروع چت
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowAdminLogin(true)}
            >
              ورود به پنل مدیریت
            </button>
          </form>
        </div>
      </div>
    )
  }

  // 3. بن شده
  if (isBanned && !isAdmin) {
    return (
      <div className="login">
        <div className="login-card banned">
          <div className="app-logo">🚫</div>
          <h1>دسترسی شما مسدود شد</h1>
          <p>شما از چت بن شدید و نمی‌تونید پیام بفرستید</p>
          <button onClick={changeAlias} className="link-btn" style={{ marginTop: '1rem' }}>
            تغییر اسم
          </button>
        </div>
      </div>
    )
  }

  // 4. پنل ادمین
  if (showAdminPanel && isAdmin) {
    return <AdminPanel
      messages={messages}
      bans={bans}
      onClose={() => setShowAdminPanel(false)}
      onBan={(msg) => banUser(msg)}
      onUnban={unbanUser}
    />
  }

  // 5. چت اصلی
  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <div className="header-title">💬 چت عمومی</div>
        </div>
        <div className="header-right">
          <span className="me-badge">{alias}</span>
          {isAdmin && (
            <button
              className="icon-btn admin-icon"
              onClick={() => setShowAdminPanel(true)}
              title="پنل مدیریت"
            >
              🛡️
            </button>
          )}
          <button
            className="icon-btn"
            onClick={changeAlias}
            title="خروج"
          >
            ⏏
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages" onClick={() => setMenuMsg(null)}>
        {messages.length === 0 && (
          <div className="empty-chat">
            <div className="empty-icon">💬</div>
            <div>پیامی نیست</div>
            <div className="empty-hint">اولین نفر باش!</div>
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.who === alias
          return (
            <div
              key={m.id}
              className={`bubble-wrap ${isMe ? 'me' : 'other'}`}
              onClick={(e) => {
                e.stopPropagation()
                if (isAdmin) setMenuMsg(m)
              }}
            >
              <div className={`bubble ${isMe ? 'me' : 'other'}`}>
                {!isMe && <div className="bubble-who">{m.who}</div>}
                <div className="bubble-text">{m.text}</div>
                <div className="bubble-time">
                  {new Date(m.time).toLocaleTimeString('fa-IR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEnd} />
      </div>

      {/* منوی روی پیام (ادمین) */}
      {menuMsg && isAdmin && (
        <div className="msg-menu" onClick={() => setMenuMsg(null)}>
          <div className="msg-menu-card" onClick={(e) => e.stopPropagation()}>
            <div className="msg-menu-head">
              <strong>{menuMsg.who}</strong>
              <span>{menuMsg.text.slice(0, 30)}</span>
            </div>
            <button
              className="msg-menu-ban"
              onClick={() => banUser(menuMsg)}
            >
              🚫 بن کردن این کاربر
            </button>
            <button className="msg-menu-cancel" onClick={() => setMenuMsg(null)}>
              بستن
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <form className="input-bar" onSubmit={sendMessage}>
        <button type="button" className="emoji-btn">😊</button>
        <input
          ref={inputRef}
          type="text"
          placeholder="پیام..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="send-btn" disabled={!text.trim()}>
          ➤
        </button>
      </form>
    </div>
  )
}

// ===== Admin Panel =====
function AdminPanel({ messages, bans, onClose, onBan, onUnban }) {
  const banList = Object.entries(bans).filter(([_, b]) => b && b.alias)

  return (
    <div className="app">
      <div className="header admin-header">
        <div className="header-left">
          <button className="icon-btn" onClick={onClose}>‹</button>
          <div className="header-title">پنل مدیریت</div>
        </div>
        <div className="header-right">
          <span className="me-badge">مدیر</span>
        </div>
      </div>

      <div className="admin-section">
        <h3>🚫 کاربران بن شده ({banList.length})</h3>
        {banList.length === 0 && <div className="empty-chat">کسی بن نیست ✅</div>}
        {banList.map(([id, b]) => (
          <div key={id} className="ban-row">
            <div>
              <strong>{b.alias}</strong>
              <div className="ban-meta">
                {new Date(b.time).toLocaleString('fa-IR')}
              </div>
            </div>
            <button className="btn-unban" onClick={() => onUnban(id)}>
              رفع بن
            </button>
          </div>
        ))}
      </div>

      <div className="admin-section">
        <h3>💬 پیام‌ها ({messages.length})</h3>
        <p className="admin-hint">روی هر پیام توی چت کلیک کن تا بنش کنی</p>
        <div className="admin-msg-list">
          {messages.slice().reverse().slice(0, 50).map((m) => (
            <div
              key={m.id}
              className="admin-msg-row"
              onClick={() => {
                onBan(m)
                onClose()
              }}
            >
              <div className="admin-msg-head">
                <strong>{m.who}</strong>
                <span className="ban-meta">
                  {new Date(m.time).toLocaleTimeString('fa-IR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="admin-msg-text">{m.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
