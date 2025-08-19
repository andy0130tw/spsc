import {
  kReaderPos,
  kWriterPos,
} from './internal.js'
import { SPSC, SPSCError } from './common.js'

export { SPSCError, SPSC_RESERVED_SIZE } from './common.js'

interface _ReadOptions {
  nonblock: boolean
  // TODO: do not wrap around even if there is still more data to read
  //       so that the buffer can always be produced from a single slice;
  //       not sure if the performance gain is noticeable
  // slice: boolean
}

export interface ReadOptions extends Partial<_ReadOptions> {}

export type ReadResult =
  | { ok: false, error: SPSCError }
  // when nbytes is zero or EOF (TODO)
  | { ok: true, bytesRead: 0, data: null }
  // bytesRead must be > 0
  | { ok: true, bytesRead: number, data: Uint8Array }

export class SPSCReader extends SPSC {
  constructor(sab: SharedArrayBuffer, readonly notifier?: MessagePort, readonly notifierToken?: unknown) {
    super(sab)
  }

  #storeNotifyReaderPos(n: number) {
    Atomics.store(this[kReaderPos], 0, n)
    if (this.notifier) {
      this.notifier.postMessage(this.notifierToken ?? true)
    } else {
      Atomics.notify(this[kReaderPos], 0)
    }
  }

  read(nbytes: number, options?: ReadOptions): ReadResult {
    if (nbytes === 0) {
      return { ok: true, bytesRead: 0, data: null }
    }

    let rpos = this.loadReaderPos()
    let wpos = this.loadWriterPos()
    if (wpos === rpos) {
      if (options?.nonblock) {
        return { ok: false, error: SPSCError.Again }
      } else {
        // FIXME: main thread waiting; see writer
        do {
          Atomics.wait(this[kWriterPos], 0, rpos)
        } while ((wpos = this.loadWriterPos()) === rpos)
      }
    }

    wpos %= this.capacity

    const rpos_ = rpos
    rpos %= this.capacity

    let rsize: number
    let wrapped = 0
    let buf: Uint8Array

    // (rpos === wpos) (mod cap) iff. the buffer is full
    if (rpos < wpos) {
      rsize = Math.min(nbytes, wpos - rpos)
    } else {
      rsize = Math.min(nbytes, this.capacity - rpos)
      wrapped = Math.min(wpos, nbytes - rsize)
    }

    if (wrapped === 0) {
      buf = this.buffer.slice(rpos, rpos + rsize)
    } else {
      buf = new Uint8Array(rsize + wrapped)
      buf.set(this.buffer.subarray(rpos, rpos + rsize))
      buf.set(this.buffer.subarray(0, wrapped), rsize)
      rsize += wrapped
    }

    this.#storeNotifyReaderPos((rpos_ + rsize) % (this.capacity << 1))

    return { ok: true, bytesRead: rsize, data: buf }
  }

  bytesAvailable() {
    const rpos = this.loadReaderPos()
    const wpos = this.loadWriterPos()
    return this.availableToReader(rpos, wpos)
  }

  // TODO: allow for cancellation
  pollRead(timeout: number = Infinity) {
    const forever = timeout > 0 && !Number.isFinite(timeout)

    const rpos = this.loadReaderPos()
    let wpos = this.loadWriterPos()
    // fast path
    if (wpos !== rpos) return true

    if (forever) {
      // prevent the overhead of calling performance.now
      do {
        Atomics.wait(this[kWriterPos], 0, rpos)
      } while ((wpos = this.loadWriterPos()) === rpos)
    } else {
      const deadline = performance.now() + timeout
      do {
        if (Atomics.wait(this[kWriterPos], 0, rpos, deadline - performance.now()) === 'timed-out') {
          return false
        }
      } while ((wpos = this.loadWriterPos()) === rpos)
    }
    return true
  }
}
