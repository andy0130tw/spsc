import { SPSC, SPSCError, kReaderPos, kWriterPos } from './common.js'

interface _ReadOptions {
  nonblock: boolean
  // TODO: do not wrap around even if there is still more data to read
  //       so that the buffer can always be produced from a single slice;
  //       not sure if the performance gain is noticeable
  // slice: boolean
}

interface ReadOptions extends Partial<_ReadOptions> {}

type ReadResult =
  | { ok: false, error: SPSCError }
  // when nbytes is zero or EOF
  | { ok: true, bytesRead: 0, data: null }
  // bytesRead must be > 0
  | { ok: true, bytesRead: number, data: Uint8Array }

export class SPSCReader extends SPSC {
  constructor(sab: SharedArrayBuffer, readonly notifier?: MessagePort) {
    super(sab)
  }

  #storeNotifyReaderPos(n: number) {
    Atomics.store(this[kReaderPos], 0, n)
    if (this.notifier) {
      this.notifier.postMessage(true)
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
}
