type SharedUint8Array = Uint8Array<SharedArrayBuffer>
type SharedInt32Array = Int32Array<SharedArrayBuffer>

export const kReaderPos = Symbol('readerPos')
export const kWriterPos = Symbol('writerPos')

export enum SPSCError {
  Unspecified = 'UNSPECIFIED',
  Again = 'AGAIN',
  Eof = 'EOF',
  Unimplemented = 'UNIMPLEMENTED',
}

export const SPSC_RESERVED_SIZE = 16

export class SPSC {
  // must be >= 8
  static RESERVED_SIZE = SPSC_RESERVED_SIZE

  capacity: number
  buffer: SharedUint8Array
  [kReaderPos]: SharedInt32Array
  [kWriterPos]: SharedInt32Array

  constructor(sab: SharedArrayBuffer) {
    const size = sab.byteLength

    // XXX: it is embarrassing that we cannot really check this way
    //      in case that the execution context is not cross-origin isolated
    // if (!(sab instanceof SharedArrayBuffer)) {}

    if (size < SPSC.RESERVED_SIZE + 1) {
      throw new TypeError('buffer size is too small')
    }

    this.capacity = size - SPSC.RESERVED_SIZE
    this[kReaderPos] = new Int32Array(sab, 0, 1)
    this[kWriterPos] = new Int32Array(sab, 4, 1)
    this.buffer = new Uint8Array(sab, SPSC.RESERVED_SIZE, this.capacity)
  }

  loadReaderPos() { return Atomics.load(this[kReaderPos], 0) }
  loadWriterPos() { return Atomics.load(this[kWriterPos], 0) }

  // because of the wrap around, this is actually easier to calculate
  bytesAvailable(rpos: number, wpos: number) {
    return rpos === wpos ? this.capacity :
      (rpos + this.capacity - wpos) % this.capacity
  }

  filled(rpos: number, wpos: number) {
    return this.capacity - this.bytesAvailable(rpos, wpos)
  }
}
