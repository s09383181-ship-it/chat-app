import Gun from 'gun'

// WebRTC + multicast بین browserها + یه relay اگه آدرسش داده شده
// ⚠️ بدون relay، کاربرا فقط وقتی میبینن هم که همزمان آنلاین باشن
// اگه relay داری، اینجا اضافه کن:
const RELAY_URL = localStorage.getItem('chatapp_relay_url') || ''

export const gun = Gun({
  peers: RELAY_URL ? [RELAY_URL] : [],
  localStorage: true,
  radisk: true,
  axe: false,
  multicast: true,  // WebRTC discovery بین browserهای نزدیک
  webrtc: true,      // مستقیم بین browserها
})

export const ROOT = gun.get('chatapp-v6')
export const CHAT = ROOT.get('messages')
export const BANS = ROOT.get('bans')
export const USERS = ROOT.get('users')
export const ADMIN_LOCK = ROOT.get('admin-locked')
export const ADMIN_DEVICE = ROOT.get('admin-device') // device + alias admin
export const CHANNEL = ROOT.get('channel') // channel info + posts
export const CHAT_LOCK = ROOT.get('chat-locked') // chat lock state

const ADMIN_HASH = '281d93cdc2ae840b2637fd416ffe0f5aec9d757bb1760e2cd1b6c4843bb4fa25'
const ADMIN_SALT = 's9k2j4h8f7d3g6h1j4k7l0m3n6p9q2r5'

export async function checkAdminPassword(pw) {
  const h = await sha256(pw + ADMIN_SALT)
  return h === ADMIN_HASH
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getDeviceId() {
  let id = localStorage.getItem('chatapp_device_v6')
  if (!id) {
    id = 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12)
    localStorage.setItem('chatapp_device_v6', id)
  }
  return id
}

export function getFingerprint() {
  // ترکیب deviceId + screen + language + platform
  // برای شناسایی device حتی اگر localStorage پاک شه
  const fp = [
    getDeviceId(),
    navigator.userAgent.slice(0, 50),
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
  ].join('|')
  let hash = 0
  for (let i = 0; i < fp.length; i++) {
    hash = ((hash << 5) - hash + fp.charCodeAt(i)) | 0
  }
  return 'fp_' + Math.abs(hash).toString(36)
}

export function slug(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30) || 'user'
}

// Rate limit (singleton)
const lastSend = { time: 0 }
export function canSend() {
  const now = Date.now()
  if (now - lastSend.time < 1000) return false
  lastSend.time = now
  return true
}
