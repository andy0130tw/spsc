export {}

import { SPSCWriter } from '$lib/spsc/writer'

const initData = await new Promise(resolve => {
  addEventListener('message', (evt) => {
    resolve(evt.data)
  }, { once: true })
}) as { sab: SharedArrayBuffer, port?: MessagePort }

const { sab, port } = initData

if (port) {
  // plumbing, since the first sending is queued
  port.postMessage(false)
  await new Promise<void>(r => {
    port.onmessage = () => {
      port.onmessage = null
      r()
    }
  })
}

const writer = new SPSCWriter(sab, port)

let i = 0
while (i < 100000) {
  const cnt = Math.floor(Math.random() * 40) + 1
  const u8a = new Uint8Array(cnt)
  const end = Math.min(i + cnt, 100000)
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
