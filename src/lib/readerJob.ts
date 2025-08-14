import { SPSCError } from "./spsc/common"
import { SPSCReader } from "./spsc/reader"

export default async function(sab: SharedArrayBuffer, msgport?: MessagePort) {
  const reader = new SPSCReader(sab)

  let pendingRead: (() => void) | undefined

  if (msgport) {
    msgport.onmessage = (event) => {
      if (pendingRead == null) return
      if (!event.data) {
        // for plumbing, send ACK
        msgport.postMessage(true)
      }
      pendingRead()
      pendingRead = undefined
    }
  }

  console.warn('reader start', performance.now())

  let seq = 0
  while (seq < 100000) {
    const reqcnt = Math.floor(Math.random() * 10) + 1
    const result = reader.read(reqcnt, msgport ? { nonblock: true } : undefined)

    if (!result.ok) {
      if (msgport && result.error === SPSCError.Again) {
        const p = new Promise<void>(resolve => {
          pendingRead = resolve
        })
        await p
        continue
      } else {
        throw new Error('read failed')
      }
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
}
