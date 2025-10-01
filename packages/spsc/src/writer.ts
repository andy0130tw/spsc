import {
  kReaderPos,
  kWriterPos,
  kReaderClosedFlag,
  kWriterClosedFlag,
} from './internal.js'
import { SPSC, SPSCError } from './common.js'

export { SPSCError } from './common.js'

interface _WriteOptions {
  nonblock: boolean
  nbytes: number
}

export interface WriteOptions extends Partial<_WriteOptions> {}

export type WriteResult =
  | { ok: false, error: SPSCError }
  // bytesWritten must be > 0 unless nbytes is zero
  | { ok: true, bytesWritten: 0 | number }

const wposToExtent = (wpos: number, capacity: number) =>
  (wpos + capacity) % (capacity << 1)

export class SPSCWriter extends SPSC {
  constructor(sab: SharedArrayBuffer, readonly notifier?: MessagePort, readonly notifierToken?: unknown) {
    super(sab)
  }

  #notifyWriterPos() {
    if (this.notifier) {
      this.notifier.postMessage(this.notifierToken ?? true)
    } else {
      Atomics.notify(this[kWriterPos], 0)
    }
  }

  close() {
    if (Atomics.compareExchange(this[kWriterClosedFlag], 0, 0, 1) !== 0) {
      throw new Error('close: writer is already closed')
    }
    // XXX: plumbing; is this correct?
    this.#notifyWriterPos()
  }

  // TODO: allow writing in-place using a callback
  write(data: Uint8Array, options?: WriteOptions): WriteResult {
    const nbytes = options?.nbytes ?? data.length

    if (Atomics.load(this[kWriterClosedFlag], 0) !== 0) {
      return { ok: false, error: SPSCError.Badf }
    }

    if (Atomics.load(this[kReaderClosedFlag], 0) !== 0) {
      return { ok: false, error: SPSCError.Pipe }
    }

    if (nbytes === 0) {
      return { ok: true, bytesWritten: 0 }
    }

    let wpos = this.loadWriterPos()
    let rpos = this.loadReaderPos()
    if (options?.nonblock &&
        nbytes <= this.capacity &&
        this.availableToWriter(rpos, wpos) < nbytes) {
      // FIXME: always be atomic if <= PIPE_BUF, but should be able to opt-out
      // on some threshold (i.e. atomicity is only guaranteed on small writes)
      return { ok: false, error: SPSCError.Again }
    }

    let nwritten = 0
    while (nwritten < nbytes) {
      rpos = this.loadReaderPos()

      if (this.availableToWriter(rpos, wpos) === 0) {
        if (options?.nonblock) {
          if (nwritten > 0) break
          return { ok: false, error: SPSCError.Again }
        }
        const wext = wposToExtent(wpos, this.capacity)
        // FIXME: provide a fallback way so that the main thread can wait here
        Atomics.wait(this[kReaderPos], 0, wext)
        continue
      }

      const rpos_ = rpos
      rpos %= this.capacity

      const wpos_ = wpos
      wpos %= this.capacity

      let wsize: number
      let wrapped = 0

      if (wpos < rpos) {
        // if the reader pointer has not wrapped, write to where reader pointer is;
        // otherwise write till buffer ending
        wsize = Math.min(nbytes - nwritten, rpos - wpos)
      } else {
        wsize = Math.min(nbytes - nwritten, this.capacity - wpos)
        wrapped = Math.min(rpos, nbytes - nwritten - wsize)
      }

      this.buffer.set(data.subarray(nwritten, nwritten + wsize), wpos)
      if (wrapped !== 0) {
        this.buffer.set(data.subarray(nwritten + wsize, nwritten + wsize + wrapped), 0)
        wsize += wrapped
      }

      nwritten += wsize
      rpos = rpos_
      wpos = (wpos_ + wsize) % (this.capacity << 1)

      Atomics.store(this[kWriterPos], 0, wpos)
      this.#notifyWriterPos()
    }

    return { ok: true, bytesWritten: nwritten }
  }

  bytesAvailable() {
    const wpos = this.loadWriterPos()
    const rpos = this.loadReaderPos()
    return this.availableToWriter(rpos, wpos)
  }

  // TODO: allow for cancellation
  pollWrite(timeout: number = Infinity) {
    if (Atomics.load(this[kWriterClosedFlag], 0) !== 0) {
      throw new Error('pollWrite: writer is already closed')
    }

    const forever = timeout > 0 && !Number.isFinite(timeout)

    const wext = wposToExtent(this.loadWriterPos(), this.capacity)
    let rpos = this.loadReaderPos()

    while (rpos === wext) {
      if (Atomics.load(this[kReaderClosedFlag], 0) !== 0) {
        return true
      }

      if (forever) {
        Atomics.wait(this[kReaderPos], 0, wext)
      } else {
        const deadline = performance.now() + timeout
        if (Atomics.wait(this[kReaderPos], 0, wext, deadline - performance.now()) === 'timed-out') {
          return false
        }
      }
      rpos = this.loadReaderPos()
    }

    return true
  }
}
