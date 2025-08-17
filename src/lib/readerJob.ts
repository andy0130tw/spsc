import { SPSCError } from 'spsc'
import { SPSCReader } from 'spsc/reader'

export default async function(sab: SharedArrayBuffer, msgport?: MessagePort) {
  const reader = new SPSCReader(sab)

  let pendingRead: (() => void) | undefined
  let initialized = false

  if (msgport) {
    msgport.onmessage = (event) => {
      if (pendingRead == null) return
      if (!event.data) {
        if (initialized) {
          throw new Error('Initialization message should only be sent once')
        }
        // send ACK
        msgport.postMessage(null)
        initialized = true
        return
      }
      pendingRead()
      pendingRead = undefined
    }
  }

  let lastReported = performance.now()
  let lastReportedSeq = 0
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

    const elps = performance.now() - lastReported
    if (elps > 1000) {
      const seqdiff = seq - lastReportedSeq
      console.warn('reader report: seq', seq, `avg speed ${(seqdiff / elps * 1000).toFixed(3)} bps`)
      lastReported = performance.now()
      lastReportedSeq = seq
    }

    if (Math.random() < .1) {
      await new Promise(r => setTimeout(r))
    }
  }

  console.warn('reader end', performance.now())
}
