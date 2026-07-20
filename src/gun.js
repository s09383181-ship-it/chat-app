import Gun from 'gun'

// لیست relay ها. اگه خالی باشه، فقط local + WebRTC کار می‌کنه
const PEERS = [
  // 'https://your-relay.com/gun',
]

export const gun = Gun({
  peers: PEERS,
  localStorage: true,
  radisk: true,
})

// ریشه دیتابیس
export const ROOT = gun.get('chatapp/v2')
export const CHAT = ROOT.get('messages')
export const BANS = ROOT.get('bans')
export const USERS = ROOT.get('users') // ثبت اسم‌های وارد شده

// هش SHA-256 از (رمز ادمین + salt) — یک‌طرفه و امن
// هیچ‌وقت رمز اصلی توی کد نیست
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
