export {}

import { MAX_BYTES_COUNT } from '../index.js'
import { SPSCWriter } from 'spsc/writer'

const initData = await new Promise(resolve => {
  addEventListener('message', (evt) => {
    resolve(evt.data)
  }, { once: true })
}) as { sab: SharedArrayBuffer, port?: MessagePort }

const { sab, port } = initData

if (port) {
  // fix the initialization order to prevent deadlocks
  // 1. producer sends SYN (`false`) and blocks
  // 2. consumer recvs SYN and responds with ACK (dontcare)
  // 3. producer then starts writing data
  port.postMessage(false)
  await new Promise<void>(resolve => {
    port.onmessage = () => {
      port.onmessage = null
      resolve()
    }
  })
}

const writer = new SPSCWriter(sab, port)

const maxWriteChunkSize = 20

let i = 0

while (i < MAX_BYTES_COUNT) {
  const max = Math.min(MAX_BYTES_COUNT - i, maxWriteChunkSize)
  const cnt = Math.floor(Math.random() * max) + 1
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

  let rnd = Math.random()
  if (Math.random() < .1) {
    await new Promise(r => setTimeout(r, rnd * 10))
  }
}

console.info('producer finish writing and will close the pipe soon')
await new Promise(r => setTimeout(r, 1000))
console.log('closing writer\'s end')
writer.close()

console.info('writer job is done!')
