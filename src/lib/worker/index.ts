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
