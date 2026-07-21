import Gun from 'gun'

// بدون relay - فقط local + WebRTC
export const gun = Gun({
  peers: [],
  localStorage: true,
  radisk: true,
  axe: false,
  multicast: false,
})

export const ROOT = gun.get('chatapp-v4')
export const CHAT = ROOT.get('messages')
export const BANS = ROOT.get('bans')
export const USERS = ROOT.get('users') // ثبت device → alias
export const ADMIN_LOCK = ROOT.get('admin-locked') // قفل پنل ادمین

// ادمین: هش SHA-256
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
  let id = localStorage.getItem('chatapp_device_v4')
  if (!id) {
    id = 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12)
    localStorage.setItem('chatapp_device_v4', id)
  }
  return id
}

// slug امن برای key
export function slug(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30) || 'user'
}
