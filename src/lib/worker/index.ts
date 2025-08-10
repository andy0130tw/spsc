/// <reference lib="webworker" />

export {}

import { SPSCReader } from '$lib/spsc/reader'

const initData = await new Promise(resolve => {
  addEventListener('message', (evt) => {
    resolve(evt.data)
  }, { once: true })
}) as { sab: SharedArrayBuffer }

console.warn('worker on message', initData)

const reader = new SPSCReader(initData.sab)

let seq = 0
while (true) {
  const result = reader.read(10)
  if (!result.ok || result.bytesRead === 0) {
    throw new Error('read failed')
  }

  const cnt = result.bytesRead
  for (let i = 0; i < cnt; i++) {
    if (result.data![i] != (seq & 0xff)) {
      throw new Error(`Expected ${seq} but received (${result.data})[${i}] -> ${result.data![i]}`)
    }
    seq++
    if (seq % 100 === 0) {
      console.log(`reader received ${seq} bytes`)
    }
  }
}
