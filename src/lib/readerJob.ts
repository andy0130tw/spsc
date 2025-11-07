import { MAX_BYTES_COUNT } from '.'
import { SPSCError, SPSCReader } from 'spsc/reader'

export default async function(sab: SharedArrayBuffer, msgport?: MessagePort, signal?: AbortSignal) {
  const reader = new SPSCReader(sab)

  let pendingRead: (() => void) | undefined
  let initialized = false

  if (msgport) {
    msgport.onmessage = (event) => {
      if (pendingRead == null) return
      if (!event.data) {
        if (initialized) {
          throw new Error('initialization message should only be sent once')
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

  let halted = false
  if (signal) {
    signal.onabort = () => void (halted = true)
  }

  let lastReported = performance.now()
  let lastReportedSeq = 0
  console.warn('reader start', performance.now())

  const buf = new Uint8Array(16)
  const readOpts = { into: buf, ...(msgport ? { nonblock: true } : undefined) }

  let seq = 0
  while (true) {
    if (halted) {
      console.warn('reader aborted', performance.now())
      return
    }

    const reqcnt = Math.floor(Math.random() * 16) + 1
    const result = reader.read(reqcnt, readOpts)

    if (!result.ok) {
      if (msgport && result.error === SPSCError.Again) {
        if (pendingRead) throw new Error('should not happen')
        await new Promise<void>(resolve => {
          pendingRead = resolve
        })
        if (pendingRead) throw new Error('should not happen too')
        continue
      } else {
        throw new Error('read failed')
      }
    }

    if (result.bytesRead === 0) {
      console.warn('reader got EOF')
      break
    }

    if (result.bytesRead > reqcnt) {
      throw new Error(`read failed: Requesting ${reqcnt} bytes, got too many: ${result.bytesRead}`)
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

    let rnd = Math.random()
    if (rnd < .1) {
      await new Promise(r => setTimeout(r, rnd * 10))
    }
  }

  console.info('reader end, seq=', seq, 'ts=', performance.now())

  if (seq !== MAX_BYTES_COUNT) {
    throw new Error(`unexpected end: ${seq} < ${MAX_BYTES_COUNT}`)
  }

  const final = reader.read(1)
  if (!final.ok || final.bytesRead !== 0) {
    throw new Error('writer does not close properly')
  }

  console.warn('closing reader\'s end')
  reader.close()
  console.info('reader job is done!')
}
