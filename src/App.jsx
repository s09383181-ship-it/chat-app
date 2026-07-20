import { useEffect, useState, useRef } from 'react'
import { gun, CHAT, BANS, USERS, checkAdminPassword } from './gun'

const ALIAS_KEY = 'chatapp_alias'
const ADMIN_KEY = 'chatapp_admin_session'

export default function App() {
  // نام مستعار ذخیره‌شده؟
  const [alias, setAlias] = useState(() => localStorage.getItem(ALIAS_KEY) || '')
  const [aliasInput, setAliasInput] = useState('')

  // آیا الان توی پنل ادمین هستیم؟
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === '1')
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [adminPw, setAdminPw] = useState('')
  const [adminError, setAdminError] = useState('')

  // state اصلی
  const [messages, setMessages] = useState([])
  const [bans, setBans] = useState({}) // { alias: {reason, by, time} }
  const [knownUsers, setKnownUsers] = useState({}) // {alias: {lastSeen, lastMsg}}
  const [text, setText] = useState('')
  const [bannedMsg, setBannedMsg] = useState(null) // اگه بن شده باشه
  const messagesEnd = useRef(null)

  // ===== Subscribe: bans =====
  useEffect(() => {
    const list = {}
    BANS.map().on((data, id) => {
      if (!data || !data.alias) {
        delete list[id]
      } else {
        list[id] = data
      }
      setBans({ ...list })
    })
  }, [])

  // ===== Subscribe: users =====
  useEffect(() => {
    const list = {}
    USERS.map().on((data, id) => {
      if (data && data.alias) {
        list[data.alias] = {
          lastSeen: data.lastSeen || 0,
          lastMsg: data.lastMsg || '',
        }
      }
      setKnownUsers({ ...list })
    })
  }, [])

  // ===== Subscribe: messages =====
  useEffect(() => {
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
      // فقط ۲۰۰ تا آخر
      if (list.length > 200) list.splice(0, list.length - 200)
      setMessages([...list])
    })
  }, [])

  // ===== Auto-scroll =====
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ===== Check ban for current user =====
  useEffect(() => {
    if (!alias) return
    const ban = bans[alias]
    if (ban) {
      setBannedMsg(ban)
    } else {
      setBannedMsg(null)
    }
  }, [alias, bans])

  // ===== Alias login (no auth, just a nickname) =====
  function setNickname(e) {
    e.preventDefault()
    const a = aliasInput.trim().slice(0, 20)
    if (!a) return
    localStorage.setItem(ALIAS_KEY, a)
    setAlias(a)
    setAliasInput('')
    // ثبت تو لیست کاربرا
    USERS.get(slug(a)).put({
      alias: a,
      lastSeen: Date.now(),
    })
  }

  function changeNickname() {
    if (isAdmin) return // ادمین نمی‌تونه عوض کنه
    localStorage.removeItem(ALIAS_KEY)
    setAlias('')
  }

  // ===== Send message =====
  function sendMessage(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t || !alias || bannedMsg) return
    const id = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
    CHAT.get(id).put({
      text: t,
      who: alias,
      time: Date.now(),
    })
    // آپدیت last activity
    USERS.get(slug(alias)).put({
      alias,
      lastSeen: Date.now(),
      lastMsg: t.slice(0, 50),
    })
    setText('')
  }

  // ===== Admin: login =====
  async function adminLogin(e) {
    e.preventDefault()
    setAdminError('')
    const ok = await checkAdminPassword(adminPw)
    if (ok) {
      sessionStorage.setItem(ADMIN_KEY, '1')
      setIsAdmin(true)
      setShowAdminLogin(false)
      setAdminPw('')
    } else {
      setAdminError('رمز اشتباهه')
    }
  }

  // ===== Admin: ban / unban =====
  function banUser(name) {
    if (!isAdmin) return
    BANS.get(slug(name)).put({
      alias: name,
      by: 'admin',
      time: Date.now(),
      reason: 'بنا به درخواست ادمین',
    })
  }
  function unbanUser(name) {
    if (!isAdmin) return
    BANS.get(slug(name)).put(null)
  }

  // ===== UI =====

  // ۱. صفحه ورود (انتخاب اسم)
  if (!alias) {
    if (showAdminLogin) {
      return (
        <div className="login">
          <h1>🔐 ورود به پنل مدیریت</h1>
          <form onSubmit={adminLogin}>
            <input
              type="password"
              placeholder="رمز ادمین"
              value={adminPw}
              onChange={(e) => setAdminPw(e.target.value)}
              autoFocus
            />
            <button type="submit">ورود</button>
            <button
              type="button"
              className="toggle"
              onClick={() => {
                setShowAdminLogin(false)
                setAdminError('')
              }}
            >
              برگشت
            </button>
            {adminError && <div className="error">{adminError}</div>}
          </form>
        </div>
      )
    }
    return (
      <div className="login">
        <h1>💬 چت آنلاین</h1>
        <p>یه اسم مستعار انتخاب کن و بیا تو</p>
        <form onSubmit={setNickname}>
          <input
            type="text"
            placeholder="اسم مستعار (مثلاً: علی)"
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <button type="submit" disabled={!aliasInput.trim()}>
            ورود به چت
          </button>
          <button
            type="button"
            className="toggle"
            onClick={() => setShowAdminLogin(true)}
          >
            ورود به پنل مدیریت
          </button>
        </form>
      </div>
    )
  }

  // ۲. اگه بن شده
  if (bannedMsg && !isAdmin) {
    return (
      <div className="login">
        <h1>🚫 دسترسی محدود</h1>
        <p style={{ color: '#f87171', fontSize: '1.1rem' }}>
          شما از چت بن شدید
        </p>
        <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
          دلیل: {bannedMsg.reason || 'توسط ادمین'}
        </p>
        <button
          className="toggle"
          onClick={() => {
            localStorage.removeItem(ALIAS_KEY)
            setAlias('')
          }}
          style={{ marginTop: '1rem' }}
        >
          تغییر اسم و ورود مجدد
        </button>
      </div>
    )
  }

  // ۳. پنل ادمین
  if (isAdmin) {
    return <AdminPanel
      messages={messages}
      bans={bans}
      knownUsers={knownUsers}
      onBan={banUser}
      onUnban={unbanUser}
    />
  }

  // ۴. چت اصلی
  return (
    <div className="app">
      <div className="header">
        <h2>💬 چت عمومی</h2>
        <div className="user">
          <span>👤 {alias}</span>
          <button className="logout" onClick={changeNickname}>
            تغییر اسم
          </button>
        </div>
      </div>
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty">پیامی نیست، اولین نفر باش! 👋</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.who === alias ? 'me' : ''}`}>
            <div className="who">{m.who}</div>
            <div>{m.text}</div>
            <div className="time">
              {new Date(m.time).toLocaleTimeString('fa-IR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEnd} />
      </div>
      <form className="input-bar" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="پیامت رو بنویس..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={!text.trim()}>
          ارسال
        </button>
      </form>
    </div>
  )
}

// ===== Admin Panel =====
function AdminPanel({ messages, bans, knownUsers, onBan, onUnban }) {
  const [tab, setTab] = useState('users') // users | bans | messages
  const bannedAliases = new Set(Object.values(bans).map((b) => b.alias))

  return (
    <div className="admin">
      <div className="admin-header">
        <h2>🛡️ پنل مدیریت</h2>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          (نمی‌تونی خارج شی — فقط با بستن مرورگر)
        </span>
      </div>

      <div className="admin-tabs">
        <button
          className={tab === 'users' ? 'active' : ''}
          onClick={() => setTab('users')}
        >
          👥 کاربران ({Object.keys(knownUsers).length})
        </button>
        <button
          className={tab === 'bans' ? 'active' : ''}
          onClick={() => setTab('bans')}
        >
          🚫 بن‌ها ({Object.keys(bans).length})
        </button>
        <button
          className={tab === 'messages' ? 'active' : ''}
          onClick={() => setTab('messages')}
        >
          💬 پیام‌ها ({messages.length})
        </button>
      </div>

      <div className="admin-content">
        {tab === 'users' && (
          <div className="user-list">
            {Object.entries(knownUsers)
              .sort((a, b) => (b[1].lastSeen || 0) - (a[1].lastSeen || 0))
              .map(([id, u]) => (
                <div key={id} className="user-row">
                  <div className="user-info">
                    <strong>{u.alias}</strong>
                    <div className="user-meta">
                      آخرین فعالیت:{' '}
                      {u.lastSeen
                        ? new Date(u.lastSeen).toLocaleTimeString('fa-IR')
                        : '—'}
                    </div>
                    {u.lastMsg && (
                      <div className="user-lastmsg">"{u.lastMsg}"</div>
                    )}
                  </div>
                  {bannedAliases.has(u.alias) ? (
                    <button
                      className="btn-unban"
                      onClick={() => onUnban(u.alias)}
                    >
                      رفع بن
                    </button>
                  ) : (
                    <button className="btn-ban" onClick={() => onBan(u.alias)}>
                      بن کن
                    </button>
                  )}
                </div>
              ))}
            {Object.keys(knownUsers).length === 0 && (
              <div className="empty">هنوز کسی وارد نشده</div>
            )}
          </div>
        )}

        {tab === 'bans' && (
          <div className="user-list">
            {Object.values(bans).map((b) => (
              <div key={b.alias} className="user-row">
                <div className="user-info">
                  <strong>{b.alias}</strong>
                  <div className="user-meta">
                    بن شده: {new Date(b.time).toLocaleString('fa-IR')}
                  </div>
                </div>
                <button
                  className="btn-unban"
                  onClick={() => onUnban(b.alias)}
                >
                  رفع بن
                </button>
              </div>
            ))}
            {Object.keys(bans).length === 0 && (
              <div className="empty">کسی بن نیست ✅</div>
            )}
          </div>
        )}

        {tab === 'messages' && (
          <div className="msg-list">
            {messages
              .slice()
              .reverse()
              .map((m) => (
                <div key={m.id} className="msg-row">
                  <div className="msg-row-head">
                    <strong>{m.who}</strong>
                    <span className="time">
                      {new Date(m.time).toLocaleString('fa-IR')}
                    </span>
                  </div>
                  <div className="msg-row-text">{m.text}</div>
                </div>
              ))}
            {messages.length === 0 && (
              <div className="empty">پیامی نیست</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// slug ساده برای GUN key
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30)
}
