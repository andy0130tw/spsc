export {}

import { SPSCWriter } from '$lib/spsc/writer'

const initData = await new Promise(resolve => {
  addEventListener('message', (evt) => {
    resolve(evt.data)
  }, { once: true })
}) as { sab: SharedArrayBuffer, port?: MessagePort }

const { sab, port } = initData

if (port) {
  // fix the initialization order to prevent deadlocks
  // 1. producer sends SYN (false) and blocks
  // 2. consumer recvs SYN and responds with ACK (anything)
  // 3. producer then starts writing data
  port.postMessage(false)
  await new Promise<void>(r => {
    port.onmessage = () => {
      port.onmessage = null
      r()
    }
  })
}

const writer = new SPSCWriter(sab, port)

const maxWriteChunkSize = 20

let i = 0
while (i < 100000) {
  const m = Math.min(100000 - i, maxWriteChunkSize)
  const cnt = Math.floor(Math.random() * m) + 1
  const end = i + cnt
  const u8a = new Uint8Array(cnt)
  for (let j = 0; j < cnt; j++) {
    u8a[j] = i + j
  }
  const result = writer.write(u8a)
  if (!result.ok || result.bytesWritten !== cnt) {
    throw new Error('write failed')
  }
  i = end
  if (Math.random() < .1) {
    await new Promise(r => setTimeout(r))
  }
}

console.log('producer finish writing')
