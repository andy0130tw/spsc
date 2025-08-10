export {}

import { SPSCWriter } from '$lib/spsc/writer'

const initData = await new Promise(resolve => {
  addEventListener('message', (evt) => {
    resolve(evt.data)
  }, { once: true })
}) as { sab: SharedArrayBuffer }

const { sab } = initData
const writer = new SPSCWriter(sab)

let i = 0
while (i < 1000) {
  const arr = []
  const cnt = Math.floor(Math.random() * 40) + 1
  const end = i + cnt
  for (let j = i; j < end; j++) {
    arr.push(j)
  }
  const result = writer.write(new Uint8Array(arr))
  if (!result.ok) {
    throw new Error('write failed')
  }
  i = end
  if (Math.random() < .5) {
    await new Promise(r => setTimeout(r))
  }
}

console.log('writer finish writing')
