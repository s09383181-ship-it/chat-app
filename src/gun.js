import Gun from 'gun'

// GUN بدون relay — فقط local + WebRTC بین browserها
// این یعنی فقط کسایی که همزمان آنلاینن می‌بینن همو
// ولی برای چت ساده کافیه
export const gun = Gun({
  peers: [],
  localStorage: true,
  radisk: true,
  axe: false,
  multicast: false,
})

export const ROOT = gun.get('chatapp-v3')
export const CHAT = ROOT.get('messages')
export const BANS = ROOT.get('bans')

// ادمین: هش + salt
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

// device id یکتا (هر مرورگر یکی داره)
export function getDeviceId() {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12)
    localStorage.setItem('device_id', id)
  }
  return id
}
