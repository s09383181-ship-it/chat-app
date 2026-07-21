import { useEffect, useState, useRef } from 'react'
import {
  gun,
  CHAT,
  BANS,
  USERS,
  ADMIN_LOCK,
  checkAdminPassword,
  getDeviceId,
  slug,
} from './gun'

const ALIAS_KEY = 'chatapp_alias_v4'
const BIO_KEY = 'chatapp_bio_v4'
const AVATAR_KEY = 'chatapp_avatar_v4' // emoji avatar
const ADMIN_KEY = 'chatapp_admin_v4'

// لیست emoji برای انتخاب آواتار
const AVATARS = ['😀', '😎', '🦊', '🐱', '🐶', '🦁', '🐯', '🐼', '🐸', '🦄', '🌟', '🔥', '💎', '🎮', '⚽', '🚀', '🍕', '🎵']

const COLORS = [
  ['#fb923c', '#ea580c'],
  ['#4ade80', '#1f7a3f'],
  ['#60a5fa', '#1e40af'],
  ['#f472b6', '#be185d'],
  ['#a78bfa', '#6d28d9'],
  ['#facc15', '#ca8a04'],
  ['#34d399', '#047857'],
  ['#fb7185', '#9f1239'],
]

function colorFor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

export default function App() {
  const [deviceId] = useState(() => getDeviceId())
  const [alias, setAlias] = useState(() => localStorage.getItem(ALIAS_KEY) || '')
  const [bio, setBio] = useState(() => localStorage.getItem(BIO_KEY) || '')
  const [avatar, setAvatar] = useState(() => localStorage.getItem(AVATAR_KEY) || '😀')

  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === '1')
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [adminPw, setAdminPw] = useState('')
  const [adminError, setAdminError] = useState('')
  const [adminLocked, setAdminLocked] = useState(false) // قفل سراسری

  const [messages, setMessages] = useState([])
  const [bans, setBans] = useState({})
  const [text, setText] = useState('')
  const [isBanned, setIsBanned] = useState(false)
  const [banInfo, setBanInfo] = useState(null)
  const [menuMsg, setMenuMsg] = useState(null)
  const [aliasInput, setAliasInput] = useState('')
  const [aliasError, setAliasError] = useState('')

  const messagesEnd = useRef(null)
  const inputRef = useRef(null)

  // ===== subscribe: admin lock =====
  useEffect(() => {
    ADMIN_LOCK.get('locked').on((data) => {
      if (data && data.value === true) {
        setAdminLocked(true)
        // اگه خودم لاگین نیستم، بیرون کن
        if (sessionStorage.getItem(ADMIN_KEY) !== '1') {
          setIsAdmin(false)
          setShowAdminLogin(false)
          setShowAdminPanel(false)
        }
      } else {
        setAdminLocked(false)
      }
    })
  }, [])

  // ===== subscribe: bans =====
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

  // ===== subscribe: messages =====
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
        bio: data.bio || '',
        avatar: data.avatar || '👤',
        deviceId: data.deviceId || '',
        time: data.time || Date.now(),
      })
      list.sort((a, b) => a.time - b.time)
      if (list.length > 300) list.splice(0, list.length - 300)
      setMessages([...list])
    })
  }, [])

  // ===== check ban =====
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

  // ===== auto-scroll =====
  useEffect(() => {
    setTimeout(() => {
      messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }, [messages, showAdminPanel])

  // ===== ثبت نام =====
  function registerAlias(e) {
    e.preventDefault()
    setAliasError('')
    const a = aliasInput.trim().slice(0, 20)
    if (!a) return

    // چک کن این اسم قبلاً ثبت نشده باشه
    USERS.get(slug(a)).once((data) => {
      if (data && data.deviceId && data.deviceId !== deviceId) {
        setAliasError('این اسم قبلاً توسط یک نفر دیگه ثبت شده')
        return
      }
      // ثبت
      USERS.get(slug(a)).put({
        alias: a,
        deviceId,
        time: Date.now(),
      })
      localStorage.setItem(ALIAS_KEY, a)
      setAlias(a)
      setAliasInput('')
    })
  }

  // ===== ارسال پیام =====
  function sendMessage(e) {
    e?.preventDefault()
    const t = text.trim()
    if (!t || !alias || isBanned) return
    const id = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
    CHAT.get(id).put({
      text: t,
      who: alias,
      bio: bio || '',
      avatar: avatar || '😀',
      deviceId,
      time: Date.now(),
    })
    setText('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // ===== ورود ادمین =====
  async function adminLogin(e) {
    e.preventDefault()
    setAdminError('')
    if (adminLocked) {
      setAdminError('پنل مدیریت قبلاً توسط یک نفر فعال شده')
      return
    }
    if (!adminPw) {
      setAdminError('رمز رو بزن')
      return
    }
    const ok = await checkAdminPassword(adminPw)
    if (ok) {
      // قفل سراسری رو فعال کن
      ADMIN_LOCK.get('locked').put({
        value: true,
        by: deviceId,
        time: Date.now(),
      })
      sessionStorage.setItem(ADMIN_KEY, '1')
      setIsAdmin(true)
      setShowAdminLogin(false)
      setShowAdminPanel(true)
      setAdminPw('')
    } else {
      setAdminError('رمز اشتباهه')
    }
  }

  // ===== بن =====
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

  function unbanUser(banId) {
    if (!isAdmin) return
    BANS.get(banId).put(null)
  }

  // ===== رنگ آواتار =====
  const myColor = colorFor(alias || 'guest')

  // ===== RENDER =====

  // 1. صفحه ورود ادمین
  if (showAdminLogin) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">🛡️</div>
          <h1>پنل مدیریت</h1>
          <p>{adminLocked ? 'پنل قفل شده' : 'رمز رو وارد کن'}</p>
          <form onSubmit={adminLogin}>
            <input
              type="password"
              placeholder="رمز مدیر"
              value={adminPw}
              onChange={(e) => setAdminPw(e.target.value)}
              autoFocus
              disabled={adminLocked}
            />
            <button type="submit" disabled={adminLocked || !adminPw}>
              {adminLocked ? 'قفل شده' : 'ورود'}
            </button>
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

  // 2. ثبت‌نام (فقط اگه alias نداریم)
  if (!alias) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">💬</div>
          <h1>چت آنلاین</h1>
          <p>یه اسم برای خودت انتخاب کن<br /><span style={{fontSize: '0.75rem', opacity: 0.7}}>(هر اسم فقط یک بار ثبت میشه)</span></p>
          <form onSubmit={registerAlias}>
            <input
              type="text"
              placeholder="اسم مستعار"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <button type="submit" disabled={!aliasInput.trim()}>
              شروع چت ✨
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowAdminLogin(true)}
            >
              ورود به پنل مدیریت
            </button>
            {aliasError && <div className="err">{aliasError}</div>}
          </form>
        </div>
      </div>
    )
  }

  // 3. بن شده
  if (isBanned && !isAdmin) {
    return (
      <div className="login-screen">
        <div className="login-card banned">
          <div className="login-logo">🚫</div>
          <h1>دسترسی مسدود</h1>
          <p>شما از چت بن شدید و نمی‌تونید پیام بفرستید</p>
        </div>
      </div>
    )
  }

  // 4. پنل ادمین
  if (showAdminPanel && isAdmin) {
    return (
      <AdminPanel
        messages={messages}
        bans={bans}
        alias={alias}
        onClose={() => setShowAdminPanel(false)}
        onBan={banUser}
        onUnban={unbanUser}
      />
    )
  }

  // 5. چت اصلی
  return (
    <div className="app">
      <div className="header">
        <button className="avatar-btn" onClick={() => setShowProfile(true)}>
          <div
            className="avatar-lg"
            style={{ background: `linear-gradient(135deg, ${myColor[0]}, ${myColor[1]})` }}
          >
            {avatar}
          </div>
        </button>
        <div className="header-info">
          <div className="header-title">چت عمومی</div>
          <div className="header-sub">{messages.length} پیام</div>
        </div>
        {isAdmin && (
          <button
            className="admin-btn"
            onClick={() => setShowAdminPanel(true)}
            title="پنل مدیریت"
          >
            🛡️
          </button>
        )}
      </div>

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
          const c = colorFor(m.who)
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
                {!isMe && (
                  <div className="bubble-head">
                    <div
                      className="bubble-avatar"
                      style={{ background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` }}
                    >
                      {m.avatar || m.who.charAt(0)}
                    </div>
                    <div>
                      <div className="bubble-who">{m.who}</div>
                      {m.bio && <div className="bubble-bio">{m.bio}</div>}
                    </div>
                  </div>
                )}
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

      {menuMsg && isAdmin && (
        <div className="modal-backdrop" onClick={() => setMenuMsg(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div
                className="modal-avatar"
                style={{ background: `linear-gradient(135deg, ${colorFor(menuMsg.who)[0]}, ${colorFor(menuMsg.who)[1]})` }}
              >
                {menuMsg.avatar || menuMsg.who.charAt(0)}
              </div>
              <div>
                <div className="modal-name">{menuMsg.who}</div>
                <div className="modal-preview">"{menuMsg.text.slice(0, 40)}"</div>
              </div>
            </div>
            <button className="modal-btn danger" onClick={() => banUser(menuMsg)}>
              🚫 بن کردن این کاربر
            </button>
            <button className="modal-btn" onClick={() => setMenuMsg(null)}>
              بستن
            </button>
          </div>
        </div>
      )}

      {showProfile && (
        <ProfileModal
          alias={alias}
          bio={bio}
          avatar={avatar}
          color={myColor}
          onClose={() => setShowProfile(false)}
          onSave={(a, b, av) => {
            localStorage.setItem(ALIAS_KEY, a)
            localStorage.setItem(BIO_KEY, b)
            localStorage.setItem(AVATAR_KEY, av)
            setAlias(a)
            setBio(b)
            setAvatar(av)
            USERS.get(slug(a)).put({ alias: a, deviceId, time: Date.now() })
            setShowProfile(false)
          }}
        />
      )}

      <form className="input-bar" onSubmit={sendMessage}>
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

// ===== Profile Modal =====
function ProfileModal({ alias, bio, avatar, color, onClose, onSave }) {
  const [a, setA] = useState(alias)
  const [b, setB] = useState(bio)
  const [av, setAv] = useState(avatar)
  const [err, setErr] = useState('')

  function save(e) {
    e.preventDefault()
    setErr('')
    const na = a.trim().slice(0, 20)
    if (!na) return

    if (na !== alias) {
      // چک یکتا بودن
      USERS.get(slug(na)).once((data) => {
        if (data && data.deviceId && data.deviceId !== getDeviceId()) {
          setErr('این اسم قبلاً ثبت شده')
          return
        }
        onSave(na, b.trim().slice(0, 100), av)
      })
    } else {
      onSave(na, b.trim().slice(0, 100), av)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-head">
          <div
            className="profile-avatar-big"
            style={{ background: `linear-gradient(135deg, ${color[0]}, ${color[1]})` }}
          >
            {av}
          </div>
        </div>
        <form onSubmit={save}>
          <div className="avatar-picker">
            <label>آواتار</label>
            <div className="avatar-grid">
              {AVATARS.map((e) => (
                <button
                  type="button"
                  key={e}
                  className={`avatar-opt ${av === e ? 'active' : ''}`}
                  onClick={() => setAv(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>اسم</label>
            <input
              type="text"
              value={a}
              onChange={(e) => setA(e.target.value)}
              maxLength={20}
              placeholder="اسم مستعار"
            />
          </div>
          <div className="field">
            <label>بیو (حداکثر ۱۰۰ کاراکتر)</label>
            <textarea
              value={b}
              onChange={(e) => setB(e.target.value)}
              maxLength={100}
              placeholder="یه چیزی درباره خودت بنویس..."
              rows={2}
            />
            <div className="counter">{b.length}/100</div>
          </div>
          {err && <div className="err" style={{ padding: '0 1rem' }}>{err}</div>}
          <button type="submit" className="modal-btn primary">
            ذخیره ✓
          </button>
          <button type="button" className="modal-btn" onClick={onClose}>
            انصراف
          </button>
        </form>
      </div>
    </div>
  )
}

// ===== Admin Panel =====
function AdminPanel({ messages, bans, alias, onClose, onBan, onUnban }) {
  const banList = Object.entries(bans).filter(([_, b]) => b && b.alias)

  return (
    <div className="app">
      <div className="header admin-header">
        <button className="back-btn" onClick={onClose}>‹</button>
        <div className="header-info">
          <div className="header-title">پنل مدیریت</div>
          <div className="header-sub">مدیر: {alias}</div>
        </div>
      </div>

      <div className="admin-scroll">
        <div className="admin-section">
          <h3>🚫 کاربران بن شده ({banList.length})</h3>
          {banList.length === 0 && (
            <div className="empty-mini">کسی بن نیست ✅</div>
          )}
          {banList.map(([id, b]) => {
            const c = colorFor(b.alias)
            return (
              <div key={id} className="ban-row">
                <div className="ban-info">
                  <div
                    className="ban-avatar"
                    style={{ background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` }}
                  >
                    {b.alias.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <strong>{b.alias}</strong>
                    <div className="ban-meta">
                      {new Date(b.time).toLocaleString('fa-IR')}
                    </div>
                  </div>
                </div>
                <button className="btn-unban" onClick={() => onUnban(id)}>
                  رفع بن
                </button>
              </div>
            )
          })}
        </div>

        <div className="admin-section">
          <h3>💬 پیام‌ها ({messages.length})</h3>
          <p className="admin-hint">برای بن کردن روی پیام کلیک کن</p>
          <div className="admin-msg-list">
            {messages.slice().reverse().slice(0, 50).map((m) => {
              const c = colorFor(m.who)
              return (
                <div
                  key={m.id}
                  className="admin-msg-row"
                  onClick={() => onBan(m)}
                >
                  <div className="admin-msg-head">
                    <div
                      className="ban-avatar small"
                      style={{ background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` }}
                    >
                      {m.avatar || m.who.charAt(0)}
                    </div>
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
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
