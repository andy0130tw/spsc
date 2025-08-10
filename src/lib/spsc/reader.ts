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
  constructor(sab: SharedArrayBuffer) {
    super(sab)
  }

  read(nbytes: number, options?: ReadOptions): ReadResult {
    if (nbytes === 0) {
      return { ok: true, bytesRead: 0, data: null }
    }

    let rpos = Atomics.load(this[kReaderPos], 0)
    let wpos = Atomics.load(this[kWriterPos], 0)
    if (this.bytesAvailable(rpos, wpos) === this.capacity) {
      if (options?.nonblock) {
        return { ok: false, error: SPSCError.Again }
      } else {
        // FIXME: see writer
        Atomics.wait(this[kWriterPos], 0, rpos)
      }
    }

    let buf: Uint8Array
    wpos = Atomics.load(this[kWriterPos], 0) % this.capacity

    const rpos_ = rpos
    rpos %= this.capacity

    let nread = 0
    let rsize: number

    // rpos === wpos iff. the buffer is full
    if (rpos < wpos) {
      rsize = Math.min(wpos - rpos, nbytes - nread)
      buf = this.buffer.slice(rpos, rpos + rsize)
    } else {
      rsize = Math.min(this.capacity - rpos, nbytes - nread)
      const warpped = Math.min(wpos, nbytes - nread - rsize)
      buf = new Uint8Array(rsize + warpped)
      buf.set(this.buffer.slice(rpos, rpos + rsize))
      buf.set(this.buffer.slice(0, warpped), rsize)
      rsize += warpped
    }

    nread += rsize
    rpos = (rpos_ + rsize) % (this.capacity * 2)

    Atomics.store(this[kReaderPos], 0, rpos)
    Atomics.notify(this[kReaderPos], 0)

    return { ok: true, bytesRead: nread, data: buf }
  }
}
