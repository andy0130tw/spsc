import { SPSCReader } from './reader'
import { SPSCWriter } from './writer'

describe('spsc', () => {
  it('inits a reader or writer from a buffer', () => {
    const sab = new SharedArrayBuffer(24)
    const reader = new SPSCReader(sab)
    expect(reader.buffer).toBeDefined()

    const writer = new SPSCWriter(sab)
    expect(writer.buffer).toBeDefined()
  })

  it('fills a buffer completely without throwing', () => {
    const sab = new SharedArrayBuffer(20)
    const writer = new SPSCWriter(sab)
    expect(writer.write(new Uint8Array([1, 2, 3, 4]))).toHaveProperty('ok', true)
    expect(writer.write(new Uint8Array([5]), { nonblock: true })).toHaveProperty('ok', false)
  })

  it('rejects overflowing writing in the non-blocking mode', () => {
    const sab = new SharedArrayBuffer(20)
    const writer = new SPSCWriter(sab)
    writer.write(new Uint8Array([1, 2, 3]))
    expect(writer.write(new Uint8Array([4, 5]), { nonblock: true })).toHaveProperty('ok', false)
  })

  it('reads at most the buffer size', () => {
    const sab = new SharedArrayBuffer(20)
    const writer = new SPSCWriter(sab)
    const reader = new SPSCReader(sab)
    writer.write(new Uint8Array([1, 2, 3, 4]))
    reader.read(3)
    writer.write(new Uint8Array([1, 2, 3]))
    expect(reader.read(999)).toMatchInlineSnapshot(`
      {
        "bytesRead": 4,
        "data": Uint8Array [
          4,
          1,
          2,
          3,
        ],
        "ok": true,
      }
    `)
  })
})
