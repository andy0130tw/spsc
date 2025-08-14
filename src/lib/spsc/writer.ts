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
  constructor(sab: SharedArrayBuffer, readonly notifier?: MessagePort) {
    super(sab)
  }

  #storeNotifyWriterPos(n: number) {
    Atomics.store(this[kWriterPos], 0, n)
    if (this.notifier) {
      this.notifier.postMessage(true)
    } else {
      Atomics.notify(this[kWriterPos], 0)
    }
  }

  // TODO: allow writing in-place using a callback
  write(data: Uint8Array, options?: WriteOptions): WriteResult {
    const nbytes = options?.nbytes ?? data.length

    if (nbytes === 0) {
      return { ok: true, bytesWritten: 0 }
    }

    let wpos = this.loadWriterPos()
    let rpos = this.loadReaderPos()
    if (options?.nonblock && this.bytesAvailable(rpos, wpos) < nbytes) {
      // FIXME: always be atomic here, but should be able to opt-out on threshold (e.g. less ideal on large writes)
      return { ok: false, error: SPSCError.Again }
    }

    let nwritten = 0
    while (nwritten < nbytes) {
      rpos = this.loadReaderPos()

      if (this.bytesAvailable(rpos, wpos) === 0) {
        const wext = (wpos + this.capacity) % (this.capacity << 1)
        // FIXME: provide a fallback way so that the main thread can wait here
        do {
          Atomics.wait(this[kReaderPos], 0, wext)
        } while ((rpos = this.loadReaderPos()) === wext)
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

      this.#storeNotifyWriterPos(wpos)
    }

    return { ok: true, bytesWritten: nwritten }
  }
}
