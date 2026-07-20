import Gun from 'gun'

// GUN relay peers - public nodes that help sync data between peers
const PEERS = [
  'https://gun-manhattan.herokuapp.com/gun',
  'https://peer.wallie.io/gun',
  'https://gun-us.herokuapp.com/gun',
]

export const gun = Gun({
  peers: PEERS,
  localStorage: true,
  radisk: true,
})

// Reference to the global chat room
export const CHAT = gun.get('chatapp/global-room')
