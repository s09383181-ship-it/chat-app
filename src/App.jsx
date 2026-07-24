import { useEffect, useState, useRef, useCallback, memo } from 'react'
import {
  gun,
  CHAT,
  BANS,
  USERS,
  ADMIN_LOCK,
  ADMIN_DEVICE,
  CHANNEL,
  CHAT_LOCK,
  checkAdminPassword,
  getDeviceId,
  getFingerprint,
  slug,
  canSend,
} from './gun'

const ALIAS_KEY = 'chatapp_alias_v6'
const BIO_KEY = 'chatapp_bio_v6'
const AVATAR_KEY = 'chatapp_avatar_v6'
const ADMIN_KEY = 'chatapp_admin_v6'

const AVATARS = [
  '😀','😎','🦊','🐱','🐶','🦁','🐯','🐼','🐸','🦄',
  '🌟','🔥','💎','🎮','⚽','🚀','🍕','🎵','🌈','⚡',
  '🌺','🦋','🐧','🐰','👑','💀','🤖','👻','🎃','🎯'
]

const TEMPLATES = [
  { id: 'news',    label: 'خبر فوری',   icon: '🚨', color: '#ef4444' },
  { id: 'announce',label: 'اطلاعیه',    icon: '📢', color: '#06b6d4' },
  { id: 'article', label: 'مقاله',      icon: '📝', color: '#10b981' },
  { id: 'question',label: 'سوال',        icon: '❓', color: '#a855f7' },
  { id: 'none',    label: 'بدون قالب',   icon: '✨', color: '#8b7d99' },
]

const COLORS = [
  ['#fb923c', '#ea580c'],
  ['#4ade80', '#1f7a3f'],
  ['#60a5fa', '#1e40af'],
  ['#f472b6', '#be185d'],
  ['#a78bfa', '#6d28d9'],
  ['#facc15', '#ca8a04'],
  ['#34d399', '#047857'],
  ['#fb7185', '#9f1239'],
  ['#818cf8', '#4338ca'],
  ['#fcd34d', '#b45309'],
]

function colorFor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ============================================
// MessageBubble - Memoized for performance
// ============================================
const MessageBubble = memo(function MessageBubble({ m, alias, isAdmin, isMe, onAction, onReply, onUserClick, replyToMsg }) {
  const c = colorFor(m.who)
  const isDeleted = m.deleted === true
  const replyMsg = m.replyTo ? (m.replyTo.id ? m.replyTo : replyToMsg) : null

  return (
    <div className={`bubble-wrap ${isMe ? 'me' : 'other'}`} onClick={() => onAction(m)}>
      {!isMe && !isDeleted && (
        <div
          className="bubble-avatar"
          style={{ background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` }}
          onClick={(e) => { e.stopPropagation(); onUserClick(m.who) }}
        >
          {m.avatar || m.who.charAt(0)}
        </div>
      )}
      <div className={`bubble ${isMe ? 'me' : 'other'}`}>
        {!isMe && !isDeleted && (
          <div className="bubble-head">
            <div>
              <div className={`bubble-who ${m.isAdmin ? 'admin' : ''}`}>
                {m.who}
                {m.isAdmin && <span> 🛡️</span>}
              </div>
              {m.bio && <div className="bubble-bio">{m.bio}</div>}
            </div>
          </div>
        )}

        {replyMsg && !isDeleted && (
          <div className="reply-quote" onClick={(e) => e.stopPropagation()}>
            <div className="reply-who">{replyMsg.who || '?'}</div>
            <div className="reply-text">{(replyMsg.text || '').slice(0, 80)}</div>
          </div>
        )}

        {isDeleted ? (
          <div className="bubble-text deleted">🚫 این پیام حذف شد</div>
        ) : (
          <>
            <div className="bubble-text">{m.text}</div>
            {m.image && (
              <img
                src={m.image}
                alt=""
                className="bubble-img"
                loading="lazy"
                onClick={(e) => { e.stopPropagation(); window.open(m.image, '_blank') }}
              />
            )}
          </>
        )}

        <div className="bubble-time">{formatTime(m.time)}</div>
      </div>
    </div>
  )
})

// ============================================
// Reply Action Menu
// ============================================
function MessageActionMenu({ msg, isMe, isAdmin, onReply, onDelete, onBan, onClose, onJumpTo }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div
            className="modal-avatar"
            style={{ background: `linear-gradient(135deg, ${colorFor(msg.who)[0]}, ${colorFor(msg.who)[1]})` }}
          >
            {msg.avatar || msg.who.charAt(0)}
          </div>
          <div>
            <div className="modal-name">{msg.who}</div>
            <div className="modal-preview">"{msg.text ? msg.text.slice(0, 40) : '...'}"</div>
          </div>
        </div>
        {!msg.deleted && (
          <button className="modal-btn primary" onClick={() => { onReply(msg); onClose() }}>
            💬 پاسخ به این پیام
          </button>
        )}
        {msg.replyTo?.id && (
          <button className="modal-btn" onClick={() => { onJumpTo(msg.replyTo.id); onClose() }}>
            🔝 رفتن به پیام اصلی
          </button>
        )}
        {isAdmin && !msg.deleted && (
          <button className="modal-btn danger" onClick={() => { onDelete(msg); onClose() }}>
            🗑️ حذف این پیام
          </button>
        )}
        {isAdmin && (
          <button className="modal-btn danger" onClick={() => { onBan(msg); onClose() }}>
            🚫 بن کردن این کاربر
          </button>
        )}
        <button className="modal-btn" onClick={onClose}>بستن</button>
      </div>
    </div>
  )
}

// ============================================
// Profile Modal
// ============================================
function ProfileModal({ alias, bio, avatar, color, onClose, onSave, onLogout, isAdmin }) {
  const [a, setA] = useState(alias)
  const [b, setB] = useState(bio)
  const [av, setAv] = useState(avatar)
  const [err, setErr] = useState('')
  const myDeviceId = getDeviceId()

  function save(e) {
    e.preventDefault()
    setErr('')
    const na = a.trim().slice(0, 20)
    if (!na) return

    if (na !== alias) {
      USERS.get(slug(na)).once((data) => {
        if (data && data.deviceId && data.deviceId !== myDeviceId) {
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
          {isAdmin && <div style={{fontSize: 13, color: 'var(--c2)', fontWeight: 700}}>🛡️ مدیر سیستم</div>}
        </div>
        <form onSubmit={save}>
          <div className="avatar-picker">
            <label>آواتار خودت رو انتخاب کن</label>
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
          {err && <div className="err">{err}</div>}
          <button type="submit" className="modal-btn primary">
            ذخیره تغییرات ✓
          </button>
          <button type="button" className="modal-btn logout-btn" onClick={onLogout}>
            🚪 خروج از حساب
          </button>
          <button type="button" className="modal-btn" onClick={onClose}>
            بستن
          </button>
        </form>
      </div>
    </div>
  )
}

// ============================================
// Channel Editor (Admin)
// ============================================
function ChannelEditor({ onPublish, onCancel, isMobile }) {
  const [template, setTemplate] = useState('none')
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const fileRef = useRef(null)

  const tpl = TEMPLATES.find(t => t.id === template)

  function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 2 * 1024 * 1024) {
      alert('حجم عکس نباید بیشتر از ۲ مگابایت باشد')
      return
    }
    const r = new FileReader()
    r.onload = () => setImage(r.result)
    r.readAsDataURL(f)
  }

  function publish() {
    if (!text.trim() && !image) {
      alert('متن یا عکس بذار')
      return
    }
    if (text.length > 4000) {
      alert('متن نباید بیشتر از ۴۰۰۰ کاراکتر باشد')
      return
    }
    onPublish({
      text: text.trim(),
      image,
      template,
      templateColor: tpl.color,
      templateLabel: tpl.label,
    })
    setText('')
    setImage(null)
    setTemplate('none')
  }

  return (
    <div className="composer" style={{ '--tpl-color': tpl.color }}>
      <div className="composer-templates">
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            className={`tpl-chip ${template === t.id ? 'active' : ''}`}
            onClick={() => setTemplate(t.id)}
            style={{ '--tpl-color': t.color }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="چی میخوای بگی..."
        rows={3}
      />
      {image && (
        <div className="composer-img-preview">
          <img src={image} alt="" />
          <button onClick={() => setImage(null)}>×</button>
        </div>
      )}
      <div className="composer-actions">
        <button className="img-upload-btn" onClick={() => fileRef.current?.click()}>🖼️</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onFile}
        />
        <button className="composer-publish" onClick={publish}>
          {template !== 'none' ? tpl.icon + ' ' : ''}انتشار پست
        </button>
        {isMobile && <button className="modal-btn" onClick={onCancel}>انصراف</button>}
      </div>
    </div>
  )
}

// ============================================
// Admin Panel
// ============================================
function RelayModal({ currentUrl, onSave, onClose }) {
  const [url, setUrl] = useState(currentUrl)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-avatar" style={{background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)'}}>🌐</div>
          <div>
            <div className="modal-name">تنظیم Relay سرور</div>
            <div className="modal-preview">برای اینکه همه کاربرا همو ببینن</div>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(url.trim()) }}>
          <div className="field">
            <label>آدرس Relay (مثلاً https://xxx.repl.co/gun)</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-relay.repl.co/gun"
              autoFocus
            />
          </div>
          <div className="admin-hint" style={{margin: '0.75rem 1rem'}}>
            💡 خالی بذار تا فقط WebRTC محلی کار کنه.<br/>
            🚀 برای ساخت Relay رایگان: <strong>replit.com</strong> → New Repl → Node.js → کد GUN بذار
          </div>
          <button type="submit" className="modal-btn primary">💾 ذخیره</button>
          <button type="button" className="modal-btn danger" onClick={() => onSave('')}>
            🗑️ حذف Relay (فقط محلی)
          </button>
          <button type="button" className="modal-btn" onClick={onClose}>بستن</button>
        </form>
      </div>
    </div>
  )
}

function AdminPanel({ messages, bans, alias, channelInfo, onClose, onBan, onUnban, onUnbanAll, onDelete, onPublishPost, onUpdateChannel, onLockChat, onUnlockChat, chatLocked }) {
  const [tab, setTab] = useState('chat')
  const [showChanEdit, setShowChanEdit] = useState(false)
  const [showRelayModal, setShowRelayModal] = useState(false)
  const [relayUrl, setRelayUrl] = useState(() => localStorage.getItem('chatapp_relay_url') || '')
  const banList = Object.entries(bans).filter(([_, b]) => b && (b.alias || b.deviceId))

  return (
    <div className="app admin-app">
      <div className="header admin-header">
        <button className="back-btn" onClick={onClose}>‹</button>
        <div className="header-info">
          <div className="header-title">🛡️ پنل مدیریت</div>
          <div className="header-sub">{alias} • {messages.length} پیام • {banList.length} بن</div>
        </div>
        <button
          className="hbtn admin"
          onClick={() => setShowRelayModal(true)}
          title="تنظیم Relay"
        >
          🌐
        </button>
        <button
          className="hbtn admin"
          onClick={chatLocked ? onUnlockChat : onLockChat}
          title={chatLocked ? 'باز کردن چت' : 'قفل چت'}
        >
          {chatLocked ? '🔓' : '🔒'}
        </button>
      </div>

      <div className="admin-tabs">
        <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
          💬 پیام‌ها
        </button>
        <button className={tab === 'bans' ? 'active' : ''} onClick={() => setTab('bans')}>
          🚫 بن‌ها
          {banList.length > 0 && <span className="badge">{banList.length}</span>}
        </button>
        <button className={tab === 'channel' ? 'active' : ''} onClick={() => setTab('channel')}>
          📢 کانال
        </button>
      </div>

      <div className="admin-scroll">
        {tab === 'chat' && (
          <div className="admin-section">
            <p className="admin-hint">برای بن/حذف روی هر پیام کلیک کن</p>
            <div className="admin-msg-list">
              {messages.slice().reverse().slice(0, 100).map((m) => {
                const c = colorFor(m.who)
                return (
                  <div key={m.id} className="admin-msg-row">
                    <div className="admin-msg-head">
                      <div
                        className="ban-avatar small"
                        style={{ background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` }}
                      >
                        {m.avatar || m.who.charAt(0)}
                      </div>
                      <strong>{m.who}</strong>
                      {m.isAdmin && <span style={{color: 'var(--c2)'}}>🛡️</span>}
                      {m.bio && <span className="msg-bio-tag">{m.bio}</span>}
                      <span className="ban-meta">{formatTime(m.time)}</span>
                    </div>
                    <div className="admin-msg-text">{m.text}</div>
                    <div style={{display: 'flex', gap: 6, marginTop: 6}}>
                      {!m.deleted && (
                        <button className="btn-unban" style={{background: 'linear-gradient(135deg, var(--warn), #d97706)'}} onClick={(e) => { e.stopPropagation(); onDelete(m) }}>
                          🗑️ حذف پیام
                        </button>
                      )}
                      <button className="btn-unban" style={{background: 'linear-gradient(135deg, var(--danger), #dc2626)'}} onClick={(e) => { e.stopPropagation(); onBan(m) }}>
                        🚫 بن
                      </button>
                    </div>
                  </div>
                )
              })}
              {messages.length === 0 && <div className="empty-mini">پیامی نیست</div>}
            </div>
          </div>
        )}

        {tab === 'bans' && (
          <div className="admin-section">
            {banList.length > 0 && (
              <button
                className="modal-btn primary"
                style={{ marginBottom: '0.75rem' }}
                onClick={onUnbanAll}
              >
                🔓 رفع بن همه ({banList.length} نفر)
              </button>
            )}
            {banList.length === 0 ? (
              <div className="empty-mini success">✅ کسی بن نیست</div>
            ) : (
              banList.map(([id, b]) => {
                const c = colorFor(b.alias || '?')
                return (
                  <div key={id} className="ban-row">
                    <div className="ban-info">
                      <div
                        className="ban-avatar"
                        style={{ background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` }}
                      >
                        {(b.alias || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong>{b.alias || '(بدون اسم)'}</strong>
                        <div className="ban-meta">
                          {formatDate(b.time)}
                          {b.byAdmin && ' • توسط ادمین'}
                        </div>
                      </div>
                    </div>
                    <button className="btn-unban" onClick={() => onUnban(id)}>رفع بن</button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {tab === 'channel' && (
          <div className="admin-section">
            <button
              className="modal-btn primary"
              onClick={() => setShowChanEdit(true)}
              style={{marginBottom: 12}}
            >
              ✏️ ویرایش اطلاعات کانال
            </button>
            <ChannelEditor
              onPublish={(post) => onPublishPost(post)}
              onCancel={() => {}}
            />
          </div>
        )}
      </div>

      {showChanEdit && (
        <ChannelEditModal
          channelInfo={channelInfo}
          onSave={(info) => { onUpdateChannel(info); setShowChanEdit(false) }}
          onClose={() => setShowChanEdit(false)}
        />
      )}

      {showRelayModal && (
        <RelayModal
          currentUrl={relayUrl}
          onSave={(url) => {
            localStorage.setItem('chatapp_relay_url', url)
            setRelayUrl(url)
            setShowRelayModal(false)
            alert('✓ ذخیره شد. صفحه رو رفرش کن تا relay لود شه.')
          }}
          onClose={() => setShowRelayModal(false)}
        />
      )}
    </div>
  )
}

// ============================================
// Channel Edit Modal
// ============================================
function ChannelEditModal({ channelInfo, onSave, onClose }) {
  const [name, setName] = useState(channelInfo.name || 'کانال رسمی')
  const [desc, setDesc] = useState(channelInfo.desc || '')
  const [avatar, setAvatar] = useState(channelInfo.avatar || '📢')
  const [image, setImage] = useState(channelInfo.image || null)
  const fileRef = useRef(null)

  function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 500 * 1024) {
      alert('حجم عکس نباید بیشتر از ۵۰۰ کیلوبایت باشد')
      return
    }
    const r = new FileReader()
    r.onload = () => setImage(r.result)
    r.readAsDataURL(f)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-avatar" style={{background: 'linear-gradient(135deg, var(--c1), var(--c2))'}}>📢</div>
          <div>
            <div className="modal-name">ویرایش کانال</div>
            <div className="modal-preview">اسم، توضیح و عکس</div>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ name, desc, avatar, image }) }}>
          <div className="avatar-picker">
            <label>ایموجی کانال</label>
            <div className="avatar-grid">
              {['📢','📣','📰','🎯','⚡','🔥','💎','🌟','🚀','📚','🎓','💡','🌍','❤️','🎉','🛡️'].map(e => (
                <button
                  key={e}
                  type="button"
                  className={`avatar-opt ${avatar === e ? 'active' : ''}`}
                  onClick={() => setAvatar(e)}
                >{e}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>اسم کانال</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="اسم کانال"
            />
          </div>
          <div className="field">
            <label>توضیحات</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={200}
              placeholder="توضیح کوتاه..."
              rows={2}
            />
            <div className="counter">{desc.length}/200</div>
          </div>
          <div className="field">
            <label>عکس پروفایل (اختیاری)</label>
            {image && (
              <div className="composer-img-preview" style={{maxWidth: 100, marginBottom: 8}}>
                <img src={image} alt="" style={{maxWidth: 100, maxHeight: 100}} />
                <button type="button" onClick={() => setImage(null)}>×</button>
              </div>
            )}
            <button type="button" className="modal-btn" onClick={() => fileRef.current?.click()}>
              {image ? '🔄 تغییر عکس' : '📷 انتخاب عکس'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          </div>
          <button type="submit" className="modal-btn primary">ذخیره ✓</button>
          <button type="button" className="modal-btn" onClick={onClose}>انصراف</button>
        </form>
      </div>
    </div>
  )
}

// ============================================
// Main App
// ============================================
export default function App() {
  const [deviceId] = useState(() => getDeviceId())
  const [fingerprint] = useState(() => getFingerprint())
  const [alias, setAlias] = useState(() => localStorage.getItem(ALIAS_KEY) || '')
  const [bio, setBio] = useState(() => localStorage.getItem(BIO_KEY) || '')
  const [avatar, setAvatar] = useState(() => localStorage.getItem(AVATAR_KEY) || '😀')

  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [adminPw, setAdminPw] = useState('')
  const [adminError, setAdminError] = useState('')
  const [adminLockedByOther, setAdminLockedByOther] = useState(false)
  const [adminLockedByMe, setAdminLockedByMe] = useState(false)

  const [mode, setMode] = useState('chat') // 'chat' | 'channel'
  const [chatLocked, setChatLocked] = useState(false)
  const [channelInfo, setChannelInfo] = useState({ name: 'کانال رسمی', desc: '', avatar: '📢', image: null })
  const [channelPosts, setChannelPosts] = useState([])

  const [messages, setMessages] = useState([])
  const [bans, setBans] = useState({})
  const [text, setText] = useState('')
  const [isBanned, setIsBanned] = useState(false)
  const [banInfo, setBanInfo] = useState(null)
  const [menuMsg, setMenuMsg] = useState(null)
  const [aliasInput, setAliasInput] = useState('')
  const [aliasError, setAliasError] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hasNew, setHasNew] = useState(0)

  const messagesEnd = useRef(null)
  const inputRef = useRef(null)
  const messagesRef = useRef(null)

  // ====== Subscribe: admin device (auto-login) ======
  useEffect(() => {
    ADMIN_DEVICE.map().on((data, id) => {
      if (data && data.deviceId === deviceId && data.alias) {
        // این device admin هست
        if (!isAdmin) {
          setIsAdmin(true)
          sessionStorage.setItem(ADMIN_KEY, '1')
        }
      }
    })
  }, [deviceId, isAdmin])

  // ====== Subscribe: admin lock ======
  useEffect(() => {
    ADMIN_LOCK.get('locked').on((data) => {
      if (data && data.value === true) {
        if (data.by === deviceId) {
          setAdminLockedByMe(true)
          setAdminLockedByOther(false)
        } else {
          setAdminLockedByMe(false)
          setAdminLockedByOther(true)
        }
      } else {
        setAdminLockedByMe(false)
        setAdminLockedByOther(false)
      }
    })
  }, [deviceId])

  // ====== Subscribe: chat lock ======
  useEffect(() => {
    CHAT_LOCK.get('locked').on((data) => {
      setChatLocked(data && data.value === true)
    })
  }, [])

  // ====== Subscribe: bans ======
  useEffect(() => {
    const list = {}
    BANS.map().on((data, id) => {
      if (data && (data.deviceId || data.alias || data.fingerprint)) {
        list[id] = data
      } else {
        delete list[id]
      }
      setBans({ ...list })
    })
  }, [])

  // ====== Subscribe: messages ======
  useEffect(() => {
    const list = []
    const seen = new Set()
    CHAT.map().on((data, id) => {
      if (!data || seen.has(id)) return
      seen.add(id)
      const m = {
        id,
        text: data.text || '',
        who: data.who || 'کاربر',
        bio: data.bio || '',
        avatar: data.avatar || '👤',
        deviceId: data.deviceId || '',
        fingerprint: data.fingerprint || '',
        isAdmin: data.isAdmin || false,
        time: data.time || Date.now(),
        deleted: data.deleted || false,
        replyTo: data.replyTo || null,
      }
      list.push(m)
      list.sort((a, b) => a.time - b.time)
      if (list.length > 500) list.splice(0, list.length - 500)
      setMessages([...list])
    })
  }, [])

  // ====== Subscribe: channel info ======
  useEffect(() => {
    CHANNEL.get('info').on((data) => {
      if (data) {
        setChannelInfo({
          name: data.name || 'کانال رسمی',
          desc: data.desc || '',
          avatar: data.avatar || '📢',
          image: data.image || null,
        })
      }
    })
  }, [])

  // ====== Subscribe: channel posts ======
  useEffect(() => {
    const list = []
    const seen = new Set()
    CHANNEL.get('posts').map().on((data, id) => {
      if (!data || seen.has(id)) return
      seen.add(id)
      list.push({ id, ...data })
      list.sort((a, b) => a.time - b.time)
      if (list.length > 200) list.splice(0, list.length - 200)
      setChannelPosts([...list])
    })
  }, [])

  // ====== Check ban (alias + device + fingerprint) ======
  useEffect(() => {
    if (isAdmin) {
      setIsBanned(false)
      setBanInfo(null)
      return
    }
    const banList = Object.values(bans)
    const myBan = banList.find(
      (b) =>
        b.deviceId === deviceId ||
        b.fingerprint === fingerprint ||
        (alias && b.alias === alias)
    )
    if (myBan) {
      setIsBanned(true)
      setBanInfo(myBan)
    } else {
      setIsBanned(false)
      setBanInfo(null)
    }
  }, [bans, deviceId, fingerprint, alias, isAdmin])

  // ====== Scroll detection ======
  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    function onScroll() {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      setIsAtBottom(atBottom)
      setShowScrollBtn(!atBottom)
      if (atBottom) setHasNew(0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [mode])

  // ====== Auto-scroll only when at bottom ======
  useEffect(() => {
    if (mode === 'chat' && isAtBottom) {
      setTimeout(() => {
        messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    } else if (mode === 'chat' && !isAtBottom) {
      setHasNew(h => h + 1)
    }
  }, [messages, mode, isAtBottom])

  // ====== ثبت‌نام ======
  function registerAlias(e) {
    e.preventDefault()
    setAliasError('')
    const a = aliasInput.trim().slice(0, 20)
    if (!a) return

    // چک بن (alias)
    const isBannedAlias = Object.values(bans).some(b => b.alias === a)
    if (isBannedAlias) {
      setAliasError('این اسم توسط مدیر بن شده')
      return
    }
    // چک بن (fingerprint)
    const isBannedFp = Object.values(bans).some(b => b.fingerprint === fingerprint)
    if (isBannedFp) {
      setAliasError('دستگاه شما بن شده')
      return
    }

    USERS.get(slug(a)).once((data) => {
      if (data && data.deviceId && data.deviceId !== deviceId) {
        setAliasError('این اسم قبلاً توسط یک نفر دیگه ثبت شده')
        return
      }
      USERS.get(slug(a)).put({ alias: a, deviceId, time: Date.now() })
      localStorage.setItem(ALIAS_KEY, a)
      setAlias(a)
      setAliasInput('')
    })
  }

  // ====== خروج ======
  function logout() {
    localStorage.removeItem(ALIAS_KEY)
    localStorage.removeItem(BIO_KEY)
    localStorage.removeItem(AVATAR_KEY)
    setAlias('')
    setBio('')
    setAvatar('😀')
    setText('')
    setReplyTo(null)
  }

  // ====== ارسال پیام ======
  function sendMessage(e) {
    e?.preventDefault()
    const t = text.trim()
    if (!t || !alias || isBanned) return
    if (chatLocked && !isAdmin) {
      alert('چت توسط مدیر قفل شده')
      return
    }
    if (!canSend()) {
      alert('لطفاً یک ثانیه صبر کنید')
      return
    }
    if (t.length > 2000) {
      alert('پیام نباید بیشتر از ۲۰۰۰ کاراکتر باشد')
      return
    }
    const id = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
    CHAT.get(id).put({
      text: t.slice(0, 2000),
      who: alias,
      bio: bio || '',
      avatar: avatar || '😀',
      deviceId,
      fingerprint,
      isAdmin,
      time: Date.now(),
      replyTo: replyTo ? {
        id: replyTo.id,
        who: replyTo.who,
        text: replyTo.text || '',
      } : null,
    })
    setText('')
    setReplyTo(null)
    setIsAtBottom(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // ====== Delete message (admin) ======
  function deleteMsg(msg) {
    if (!isAdmin || !msg) return
    CHAT.get(msg.id).put({
      ...msg,
      text: '',
      image: null,
      deleted: true,
      time: msg.time,
    })
  }

  // ====== ورود ادمین ======
  async function adminLogin(e) {
    e.preventDefault()
    setAdminError('')
    if (adminLockedByOther) {
      setAdminError('پنل قبلاً توسط یک نفر دیگه فعال شده')
      return
    }
    if (!alias) {
      setAdminError('ابتدا یه اسم انتخاب کن')
      return
    }
    if (!adminPw) {
      setAdminError('رمز رو بزن')
      return
    }
    const ok = await checkAdminPassword(adminPw)
    if (ok) {
      // ثبت device در ADMIN_DEVICE برای auto-login دفعه بعد
      ADMIN_DEVICE.get(deviceId).put({
        deviceId,
        alias,
        time: Date.now(),
        active: true,
      })
      // ثبت در USERS (alias admin رزرو شود)
      USERS.get('admin_' + slug(alias)).put({
        alias,
        deviceId,
        isAdmin: true,
        time: Date.now(),
      })

      ADMIN_LOCK.get('locked').put({ value: true, by: deviceId, time: Date.now() })
      sessionStorage.setItem(ADMIN_KEY, '1')
      localStorage.setItem(ADMIN_KEY, '1') // برای دفعات بعد
      setIsAdmin(true)
      setAdminLockedByMe(true)
      setShowAdminLogin(false)
      setAdminPw('')
    } else {
      setAdminError('رمز اشتباهه')
    }
  }

  // ====== بن کاربر ======
  function banUser(msg) {
    if (!isAdmin || !msg) return
    const id = 'b_' + (msg.deviceId || msg.who || Date.now())
    BANS.get(id).put({
      alias: msg.who,
      deviceId: msg.deviceId,
      fingerprint: msg.fingerprint,
      byAdmin: true,
      time: Date.now(),
      reason: 'توسط مدیر بن شد',
    })
    setMenuMsg(null)
  }

  // ====== رفع بن ======
  function unbanUser(banId) {
    if (!isAdmin) return
    BANS.get(banId).put(null)
  }

  // ====== رفع بن همه ======
  function unbanAll() {
    if (!isAdmin) return
    if (!confirm('مطمئنی می‌خوای همه بن‌ها رو پاک کنی؟')) return
    let count = 0
    Object.entries(bans).forEach(([id, b]) => {
      if (b && (b.alias || b.deviceId)) {
        BANS.get(id).put(null)
        count++
      }
    })
    // پاک کردن state محلی
    setBans({})
    alert(`✓ ${count} نفر آنبن شدن`)
  }

  // ====== قفل/باز چت ======
  function lockChat() {
    CHAT_LOCK.get('locked').put({ value: true, by: deviceId, time: Date.now() })
  }
  function unlockChat() {
    CHAT_LOCK.get('locked').put({ value: false, by: deviceId, time: Date.now() })
  }

  // ====== انتشار پست کانال ======
  function publishChannelPost(post) {
    if (!isAdmin) return
    const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    CHANNEL.get('posts').get(id).put({
      ...post,
      id,
      who: alias,
      avatar,
      time: Date.now(),
    })
  }

  // ====== به‌روزرسانی اطلاعات کانال ======
  function updateChannel(info) {
    CHANNEL.get('info').put({
      ...info,
      time: Date.now(),
    })
  }

  const myColor = colorFor(alias || 'guest')

  // ====== RENDER ======

  // 1. صفحه ورود ادمین
  if (showAdminLogin && alias) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">🛡️</div>
          <h1>پنل مدیریت</h1>
          <p>{adminLockedByOther ? 'پنل قبلاً توسط یک نفر دیگه فعال شده' : 'رمز رو وارد کن'}</p>
          <form onSubmit={adminLogin}>
            <input
              type="password"
              placeholder="رمز مدیر"
              value={adminPw}
              onChange={(e) => setAdminPw(e.target.value)}
              autoFocus
              disabled={adminLockedByOther}
            />
            <button type="submit" disabled={adminLockedByOther || !adminPw}>
              {adminLockedByOther ? 'قفل توسط دیگری' : 'ورود'}
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

  // 2. ثبت‌نام
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
  if (isBanned) {
    return (
      <div className="login-screen">
        <div className="login-card banned">
          <div className="login-logo">🚫</div>
          <h1>دسترسی مسدود</h1>
          <p>شما از چت بن شدید و نمی‌تونید پیام بفرستید</p>
          {banInfo && banInfo.reason && (
            <p style={{fontSize: 12, color: 'var(--dim)'}}>دلیل: {banInfo.reason}</p>
          )}
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
        channelInfo={channelInfo}
        onClose={() => setShowAdminPanel(false)}
        onBan={banUser}
        onUnban={unbanUser}
        onUnbanAll={unbanAll}
        onDelete={deleteMsg}
        onPublishPost={publishChannelPost}
        onUpdateChannel={updateChannel}
        onLockChat={lockChat}
        onUnlockChat={unlockChat}
        chatLocked={chatLocked}
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
          <div className="header-title">
            {mode === 'channel' ? (
              <>
                {channelInfo.name}
                <span className="verified">✓</span>
              </>
            ) : (
              <>چت عمومی {chatLocked && <span style={{color: 'var(--danger)'}}>🔒</span>}</>
            )}
          </div>
          <div className="header-sub">
            {mode === 'chat'
              ? `${messages.length} پیام • ${alias}${isAdmin ? ' 🛡️' : ''}`
              : `${channelPosts.length} پست • ${alias}${isAdmin ? ' 🛡️' : ''}`}
          </div>
        </div>
        {isAdmin && (
          <button
            className="hbtn admin"
            onClick={() => setShowAdminPanel(true)}
            title="پنل مدیریت"
          >
            🛡️
          </button>
        )}
      </div>

      <div className="mode-switch">
        <button
          className={`mode-btn ${mode === 'chat' ? 'active' : ''} ${chatLocked ? 'locked' : ''}`}
          onClick={() => setMode('chat')}
        >
          💬 چت
          {chatLocked && <span className="lock-badge">قفل</span>}
        </button>
        <button
          className={`mode-btn ${mode === 'channel' ? 'active' : ''}`}
          onClick={() => setMode('channel')}
        >
          📢 کانال
        </button>
      </div>

      {chatLocked && mode === 'chat' && (
        <div className="lock-notice">
          🔒 چت توسط مدیر قفل شده
        </div>
      )}

      {mode === 'chat' ? (
        <>
          <div className="messages" ref={messagesRef} onClick={() => setMenuMsg(null)}>
            {messages.length === 0 && (
              <div className="empty-chat">
                <div className="empty-icon">💬</div>
                <div>پیامی نیست</div>
                <div className="empty-hint">اولین نفر باش!</div>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                m={m}
                alias={alias}
                isAdmin={isAdmin}
                isMe={m.who === alias}
                onAction={(msg) => {
                  if (msg.deleted) return
                  if (isAdmin) {
                    setMenuMsg(msg)
                  } else {
                    setMenuMsg(msg)
                  }
                }}
                onReply={(msg) => setReplyTo(msg)}
                onBan={banUser}
                onDelete={deleteMsg}
                onUserClick={(who) => {
                  // scroll to first message from user
                  const first = messages.find(x => x.who === who)
                  if (first) {
                    document.getElementById('msg-' + first.id)?.scrollIntoView({ behavior: 'smooth' })
                  }
                }}
                replyToMsg={messages.find(x => x.id === m.replyTo?.id)}
              />
            ))}
            <div ref={messagesEnd} />
            {showScrollBtn && hasNew > 0 && (
              <button
                className="scroll-to-bottom"
                onClick={() => {
                  setIsAtBottom(true)
                  setHasNew(0)
                  messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                ↓ {hasNew > 9 ? '۹+' : toFa(hasNew)} پیام جدید
              </button>
            )}
          </div>

          <form className="input-bar" onSubmit={sendMessage}>
            {replyTo && (
              <div className="reply-preview">
                <span>↩️ پاسخ به <b>{replyTo.who}</b>: <i>{(replyTo.text || '').slice(0, 30)}</i></span>
                <button
                  type="button"
                  className="reply-close"
                  onClick={() => setReplyTo(null)}
                >×</button>
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              placeholder={chatLocked && !isAdmin ? 'چت قفل است...' : 'پیام...'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={chatLocked && !isAdmin}
              maxLength={2000}
            />
            <button
              type="submit"
              className="send-btn"
              disabled={!text.trim() || (chatLocked && !isAdmin)}
            >
              ➤
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="channel-header">
            {isAdmin && (
              <button className="ch-edit" onClick={() => setShowAdminPanel(true)} title="ویرایش کانال">⚙️</button>
            )}
            <div className="ch-avatar">
              {channelInfo.image ? <img src={channelInfo.image} alt="" /> : channelInfo.avatar}
            </div>
            <div className="ch-name">
              {channelInfo.name}
              <span className="verified">✓</span>
            </div>
            <div className="ch-meta">
              {channelInfo.desc || `${channelPosts.length} پست • کانال رسمی`}
            </div>
          </div>
          <div className="messages" ref={messagesRef}>
            {channelPosts.length === 0 ? (
              <div className="empty-chat">
                <div className="empty-icon">📢</div>
                <div>هنوز پستی نیست</div>
                {isAdmin && <div className="empty-hint">از پنل ادمین اولین پست رو بذار</div>}
              </div>
            ) : (
              channelPosts.slice().reverse().map((p) => (
                <div
                  key={p.id}
                  className="channel-post"
                  style={{ '--post-color': p.templateColor || 'var(--c1)' }}
                >
                  {p.template && p.template !== 'none' && (
                    <span className="post-template-tag">{p.templateLabel}</span>
                  )}
                  <div className="post-head">
                    <div
                      className="avatar-lg"
                      style={{ background: `linear-gradient(135deg, ${colorFor(p.who)[0]}, ${colorFor(p.who)[1]})` }}
                    >
                      {p.avatar || p.who.charAt(0)}
                    </div>
                    <div className="post-meta">
                      <div className="post-title">
                        {p.who} <span className="verified">✓</span>
                      </div>
                      <div className="post-date">{formatDate(p.time)}</div>
                    </div>
                  </div>
                  {p.text && <div className="post-text">{p.text}</div>}
                  {p.image && <img src={p.image} alt="" className="post-img" loading="lazy" />}
                </div>
              ))
            )}
          </div>
          {isAdmin && (
            <ChannelEditor
              onPublish={publishChannelPost}
              onCancel={() => {}}
            />
          )}
        </>
      )}

      {menuMsg && (
        <MessageActionMenu
          msg={menuMsg}
          isMe={menuMsg.who === alias}
          isAdmin={isAdmin}
          onReply={(m) => { setReplyTo(m); setMode('chat') }}
          onDelete={deleteMsg}
          onBan={banUser}
          onClose={() => setMenuMsg(null)}
          onJumpTo={(id) => {
            const el = document.getElementById('msg-' + id)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}
        />
      )}

      {showProfile && (
        <ProfileModal
          alias={alias}
          bio={bio}
          avatar={avatar}
          color={myColor}
          isAdmin={isAdmin}
          onClose={() => setShowProfile(false)}
          onLogout={logout}
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
    </div>
  )
}

function toFa(n) {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])
}
