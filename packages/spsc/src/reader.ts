import {
  kReaderPos,
  kWriterPos,
  kReaderClosedFlag,
  kWriterClosedFlag,
} from './internal.js'
import { SPSC, SPSCError } from './common.js'

export { SPSCError }

type Uint8ArrayLike = { buffer: ArrayBuffer, byteOffset?: number, byteLength?: number }

;{ const _: Uint8ArrayLike = new Uint8Array() }

interface _ReadOptions {
  nonblock: boolean
  /** if set, read into this array buffer to omit allocation */
  into: Uint8ArrayLike
  // TODO: do not wrap around even if there is still more data to read
  //       so that the buffer can always be produced from a single slice;
  //       not sure if the performance gain is noticeable
  // slice: boolean
}

export interface ReadOptions extends Partial<_ReadOptions> {}

export type ReadResult =
  | { ok: false, error: SPSCError }
  // bytesRead must be > 0 unless nbytes is zero or EOF
  | { ok: true, bytesRead: number, data: Uint8Array }

export class SPSCReader extends SPSC {
  constructor(sab: SharedArrayBuffer, readonly notifier?: MessagePort, readonly notifierToken?: unknown) {
    super(sab)
  }

  #notifyReaderPos() {
    if (this.notifier) {
      this.notifier.postMessage(this.notifierToken ?? true)
    } else {
      Atomics.notify(this[kReaderPos], 0)
    }
  }

  close() {
    if (Atomics.compareExchange(this[kReaderClosedFlag], 0, 0, 1) !== 0) {
      throw new Error('close: reader is already closed')
    }
    this.#notifyReaderPos()
  }

  read(nbytes: number, options?: ReadOptions): ReadResult {
    if (!Number.isSafeInteger(nbytes) || nbytes < 0) {
      throw new TypeError('nbytes should be a non-negative integer')
    }

    if (options?.into) {
      const intoLen = options.into.byteLength ?? (options.into.buffer.byteLength - (options.into.byteOffset ?? 0))
      if (intoLen < nbytes) {
        throw new TypeError(`the buffer size to read into (${intoLen}) is smaller than bytes requested to read (${nbytes})`)
      }
    }

    if (Atomics.load(this[kReaderClosedFlag], 0) !== 0) {
      return { ok: false, error: SPSCError.Badf }
    }

    if (nbytes === 0) {
      return { ok: true, bytesRead: 0, data: new Uint8Array() }
    }

    let rpos = this.loadReaderPos()
    let wpos = this.loadWriterPos()
    while (wpos === rpos) {
      if (Atomics.load(this[kWriterClosedFlag], 0) !== 0) {
        // EOF
        return { ok: true, bytesRead: 0, data: new Uint8Array() }
      }

      if (options?.nonblock) {
        return { ok: false, error: SPSCError.Again }
      }

      // FIXME: main thread waiting; see writer
      Atomics.wait(this[kWriterPos], 0, rpos)
      wpos = this.loadWriterPos()
    }

    wpos %= this.capacity

    const rpos_ = rpos
    rpos %= this.capacity

    let rsize: number
    let wrapped = 0

    // (rpos === wpos) (mod cap) iff. the buffer is full
    if (rpos < wpos) {
      rsize = Math.min(nbytes, wpos - rpos)
    } else {
      rsize = Math.min(nbytes, this.capacity - rpos)
      wrapped = Math.min(wpos, nbytes - rsize)
    }

    let buf: Uint8Array
    if (options?.into) {
      buf = options.into instanceof Uint8Array ?
        options.into :
        new Uint8Array(options.into.buffer, options.into.byteOffset, options.into.byteLength)
      buf.set(this.buffer.subarray(rpos, rpos + rsize))
      if (wrapped !== 0) {
        buf.set(this.buffer.subarray(0, wrapped), rsize)
      }
    } else {
      if (wrapped === 0) {
        buf = this.buffer.slice(rpos, rpos + rsize)
      } else {
        buf = new Uint8Array(rsize + wrapped)
        buf.set(this.buffer.subarray(rpos, rpos + rsize))
        buf.set(this.buffer.subarray(0, wrapped), rsize)
      }
    }
    rsize += wrapped

    Atomics.store(this[kReaderPos], 0, (rpos_ + rsize) % (this.capacity << 1))
    this.#notifyReaderPos()

    return { ok: true, bytesRead: rsize, data: buf }
  }

  bytesAvailable() {
    const rpos = this.loadReaderPos()
    const wpos = this.loadWriterPos()
    return this.availableToReader(rpos, wpos)
  }

  // TODO: allow for cancellation
  pollRead(timeout: number = Infinity) {
    if (Atomics.load(this[kReaderClosedFlag], 0) !== 0) {
      throw new Error('pollRead: reader is already closed')
    }

    const forever = timeout > 0 && !Number.isFinite(timeout)
    const rpos = this.loadReaderPos()
    let wpos = this.loadWriterPos()

    while (wpos === rpos) {
      if (Atomics.load(this[kWriterClosedFlag], 0) !== 0) {
        return true
      }

      if (forever) {
        Atomics.wait(this[kWriterPos], 0, rpos)
      } else {
        const deadline = performance.now() + timeout
        if (Atomics.wait(this[kWriterPos], 0, rpos, deadline - performance.now()) === 'timed-out') {
          return false
        }
      }
      wpos = this.loadWriterPos()
    }

    return true
  }
}
