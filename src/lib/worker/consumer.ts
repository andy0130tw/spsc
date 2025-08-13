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
while (seq < 100000) {
  if (seq === 0) {
    console.warn('reader start', performance.now())
  }
  const reqcnt = Math.floor(Math.random() * 10) + 1
  const result = reader.read(reqcnt)

  if (!result.ok) {
    throw new Error('read failed')
  }

  if (result.bytesRead === 0 || result.bytesRead > reqcnt) {
    throw new Error(`read failed: Requesting ${reqcnt}, got ${result.bytesRead}`)
  }

  const cnt = result.bytesRead
  for (let i = 0; i < cnt; i++) {
    if (result.data![i] != (seq & 0xff)) {
      throw new Error(`got WRONG SEQ ${seq}: Requesting ${reqcnt}; Expected ${seq & 0xff} but received (${result.data})[${i}] -> ${result.data![i]}`)
    }
    seq++
  }

  if (Math.random() < .1) {
    await new Promise(r => setTimeout(r))
  }
}

console.warn('reader end', performance.now())

