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

export class SPSC {
  // must be >= 8
  static RESERVED_SIZE = 16

  capacity: number
  buffer: SharedUint8Array
  [kReaderPos]: SharedInt32Array
  [kWriterPos]: SharedInt32Array

  constructor(sab: SharedArrayBuffer) {
    const size = sab.byteLength

    if (size < SPSC.RESERVED_SIZE + 2) {
      throw new TypeError('buffer size too small')
    }

    this.capacity = size - SPSC.RESERVED_SIZE
    this[kReaderPos] = new Int32Array(sab, 0, 1)
    this[kWriterPos] = new Int32Array(sab, 4, 1)
    this.buffer = new Uint8Array(sab, SPSC.RESERVED_SIZE, this.capacity)
  }

  bytesAvailable(rpos: number, wpos: number) {
    if (rpos === wpos) return this.capacity
    if ((rpos - wpos) % this.capacity === 0) return 0
    return (rpos + this.capacity - wpos) % this.capacity
  }

  filled(rpos: number, wpos: number) {
    return this.capacity - this.bytesAvailable(rpos, wpos)
  }
}
