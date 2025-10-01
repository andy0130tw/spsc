/// <reference types="vitest/globals" />

import { SPSC, SPSCError } from './common'
import { SPSCReader } from './reader'
import { SPSCWriter } from './writer'

const malloc = (n: number) => SPSC.allocateArrayBuffer(n)

describe('spsc', () => {
  it('inits a reader or writer from a buffer', () => {
    const sab = malloc(8)
    const reader = new SPSCReader(sab)
    expect(reader.buffer).toBeDefined()

    const writer = new SPSCWriter(sab)
    expect(writer.buffer).toBeDefined()
  })

  it('fills a buffer completely without throwing', () => {
    const sab = malloc(4)
    const writer = new SPSCWriter(sab)
    expect(writer.write(new Uint8Array([1, 2, 3, 4]))).toHaveProperty('ok', true)
    expect(writer.write(new Uint8Array([5]), { nonblock: true })).toHaveProperty('ok', false)
  })

  it('rejects overflowing writing in the non-blocking mode', () => {
    const sab = malloc(4)
    const writer = new SPSCWriter(sab)
    writer.write(new Uint8Array([1, 2, 3]))
    expect(writer.write(new Uint8Array([4, 5]), { nonblock: true })).toHaveProperty('ok', false)
  })

  it('reads at most the buffer size', () => {
    const sab = malloc(4)
    const writer = new SPSCWriter(sab)
    const reader = new SPSCReader(sab)
    writer.write(new Uint8Array([1, 2, 3]))
    expect(reader.read(2)).toHaveProperty('ok', true)
    writer.write(new Uint8Array([4, 5]))
    expect(reader.read(999)).toMatchInlineSnapshot(`
      {
        "bytesRead": 3,
        "data": Uint8Array [
          3,
          4,
          5,
        ],
        "ok": true,
      }
    `)
  })

  it('errors when reading a closed reader', () => {
    const sab = malloc(4)
    const reader = new SPSCReader(sab)
    reader.close()
    expect(reader.read(1)).toHaveProperty('error', SPSCError.Badf)
  })

  it('errors when writing to a closed writer', () => {
    const sab = malloc(4)
    const writer = new SPSCWriter(sab)
    writer.close()
    expect(writer.write(new Uint8Array([42]))).toHaveProperty('error', SPSCError.Badf)
  })

  it('reads EOF after the pipe is drained', () => {
    const sab = malloc(4)
    const writer = new SPSCWriter(sab)
    const reader = new SPSCReader(sab)
    writer.write(new Uint8Array([1, 2, 3, 4]))
    writer.close()
    const f1 = reader.read(5)
    expect(f1).toMatchInlineSnapshot(`
      {
        "bytesRead": 4,
        "data": Uint8Array [
          1,
          2,
          3,
          4,
        ],
        "ok": true,
      }
    `)
    const f2 = reader.read(5)
    expect(f2).toMatchInlineSnapshot(`
      {
        "bytesRead": 0,
        "data": Uint8Array [],
        "ok": true,
      }
    `)
  })

  it('receives EPIPE when writing to a pipe with reading end closed', () => {
    const sab = malloc(4)
    const writer = new SPSCWriter(sab)
    const reader = new SPSCReader(sab)
    writer.write(new Uint8Array([0]))
    // expect(reader.read(1)).toHaveProperty('bytesRead', 1)
    reader.close()
    expect(writer.write(new Uint8Array([1]))).toMatchInlineSnapshot(`
      {
        "error": "PIPE",
        "ok": false,
      }
    `)
  })

  it('makes an SAB reusable by resetting it', () => {
    const sab = malloc(4)
    const writer = new SPSCWriter(sab)
    const reader = new SPSCReader(sab)
    writer.write(new Uint8Array([0]))
    writer.close()
    SPSC.resetArrayBuffer(sab)
    writer.write(new Uint8Array([42]))
    expect(reader.read(1)).toHaveProperty('data', new Uint8Array([42]))
  })
})
