import {
  kReaderPos,
  kWriterPos,
  kReaderClosedFlag,
  kWriterClosedFlag,
} from './internal.js'

type SharedUint8Array = Uint8Array<SharedArrayBuffer>
type SharedInt32Array = Int32Array<SharedArrayBuffer>

export enum SPSCError {
  Unspecified = 'UNSPECIFIED',
  Again = 'AGAIN',
  Badf = 'BADF',
  Pipe = 'PIPE',
  Unimplemented = 'UNIMPLEMENTED',
}

// must be >= 16
const SPSC_RESERVED_SIZE = 16

// a compatibility layer
export function allocateArrayBuffer(
  capacity: number,
  SabCtor: new (...args: any) => SharedArrayBuffer = globalThis.SharedArrayBuffer,
  ...args: any[]): SharedArrayBuffer {

  if (SabCtor == null) {
    throw new TypeError('Failed to get the SharedArrayBuffer from the runtime')
  }

  if (typeof Reflect !== 'undefined' && 'construct' in Reflect) {
    return Reflect.construct(SabCtor, [SPSC_RESERVED_SIZE + capacity, ...args])
  }
  return new SabCtor(SPSC_RESERVED_SIZE + capacity, ...args)
}

export abstract class SPSC {
  static RESERVED_SIZE = SPSC_RESERVED_SIZE

  readonly capacity: number
  readonly buffer: SharedUint8Array
  protected [kReaderPos]: SharedInt32Array
  protected [kWriterPos]: SharedInt32Array
  protected [kReaderClosedFlag]: SharedUint8Array
  protected [kWriterClosedFlag]: SharedUint8Array

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
    this[kReaderClosedFlag] = new Uint8Array(sab, 8, 1)
    this[kWriterClosedFlag] = new Uint8Array(sab, 12, 1)
    this.buffer = new Uint8Array(sab, SPSC.RESERVED_SIZE, this.capacity)
  }

  loadReaderPos() { return Atomics.load(this[kReaderPos], 0) }
  loadWriterPos() { return Atomics.load(this[kWriterPos], 0) }

  // because of the wrap around, this is actually easier to calculate
  protected availableToWriter(rpos: number, wpos: number) {
    return rpos === wpos ? this.capacity :
      (rpos + this.capacity - wpos) % this.capacity
  }

  protected availableToReader(rpos: number, wpos: number) {
    return this.capacity - this.availableToWriter(rpos, wpos)
  }
}
