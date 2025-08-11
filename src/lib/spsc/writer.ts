import { SPSC, SPSCError, kReaderPos, kWriterPos } from './common'

interface _WriteOptions {
  nonblock: boolean
  nbytes: number
}

interface WriteOptions extends Partial<_WriteOptions> {}

type WriteResult =
  | { ok: false, error: SPSCError }
  // bytesWritten must be > 0 unless nbytes is zero
  | { ok: true, bytesWritten: 0 | number }

export class SPSCWriter extends SPSC {
  constructor(sab: SharedArrayBuffer) {
    super(sab)
  }

  #getWritingExtent(pos: number) {
    return pos === this.capacity ? 0 :
      pos > this.capacity ? pos - this.capacity : pos + this.capacity
  }

  // TODO: allow writing in-place using a callback
  write(data: Uint8Array, options?: WriteOptions): WriteResult {
    const nbytes = options?.nbytes ?? data.length

    if (nbytes === 0) {
      return { ok: true, bytesWritten: 0 }
    }

    let wpos = Atomics.load(this[kWriterPos], 0)
    let nwritten = 0

    let rpos = Atomics.load(this[kReaderPos], 0)
    if (options?.nonblock && this.bytesAvailable(rpos, wpos) < nbytes) {
      // FIXME: always be atomic here, but should be able to opt-out on threshold (e.g. less ideal on large writes)
      return { ok: false, error: SPSCError.Again }
    }

    while (nwritten < nbytes) {
      if (this.bytesAvailable(Atomics.load(this[kReaderPos], 0), wpos) === 0) {
        const wext = this.#getWritingExtent(wpos)
        // FIXME: provide a fallback way so that the main thread can wait here
        // FIXME: not knowing why the do-while loop is required or it races;
        //        in my imagination this should not be notified with same value in a SPSC setup
        do {
          Atomics.wait(this[kReaderPos], 0, wext)
        } while (Atomics.load(this[kReaderPos], 0) === wext)
      }

      const rpos_ = Atomics.load(this[kReaderPos], 0)
      rpos = rpos_ % this.capacity

      const wpos_ = wpos
      wpos %= this.capacity
      // TODO: write at least a whole buffer in each iteration
      const wsize = Math.min(
        nbytes - nwritten,
        // if the reader pointer is at the right, write till buffer ending;
        // otherwise write to where reader pointer is
        (rpos <= wpos ? this.capacity : rpos) - wpos)

      this.buffer.set(data.subarray(nwritten, nwritten + wsize), wpos)
      nwritten += wsize
      wpos = (wpos_ + wsize) % (this.capacity * 2)

      Atomics.store(this[kWriterPos], 0, wpos)
      Atomics.notify(this[kWriterPos], 0)
    }

    return nwritten ?
      { ok: true, bytesWritten: nwritten } :
      { ok: false, error: SPSCError.Again }
  }
}
