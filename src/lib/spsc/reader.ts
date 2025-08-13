import { SPSC, SPSCError, kReaderPos, kWriterPos } from './common'

interface _ReadOptions {
  nonblock: boolean
  slice: boolean
}

interface ReadOptions extends Partial<_ReadOptions> {}

type ReadResult =
  | { ok: false, error: SPSCError }
  | { ok: true, bytesRead: 0, data: null }
  // bytesRead must be > 0
  | { ok: true, bytesRead: number, data: Uint8Array }

export class SPSCReader extends SPSC {
  #storeNotifyReaderPos(n: number) {
    Atomics.store(this[kReaderPos], 0, n)
    Atomics.notify(this[kReaderPos], 0)
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
