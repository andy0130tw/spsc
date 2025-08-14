/// <reference lib="webworker" />

import readerJob from "$lib/readerJob"

export {}

const initData = await new Promise(resolve => {
  addEventListener('message', (evt) => {
    resolve(evt.data)
  }, { once: true })
}) as { sab: SharedArrayBuffer }

console.warn('reader on message', initData)

await readerJob(initData.sab)
