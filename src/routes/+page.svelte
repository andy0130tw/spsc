<script>
  import { SPSCReader } from '$lib/spsc/reader';
  import { SPSCWriter } from '$lib/spsc/writer'
  import Worker from '$lib/worker?worker'

  // const worker = new Worker({ name: 'reader' })

  if (!window.crossOriginIsolated) {
    throw new Error('NOT COI')
  }

  const SIZE = 8
  const sab = new SharedArrayBuffer(16 + SIZE)
  const writer = new SPSCWriter(sab)
  const reader = new SPSCReader(sab)

  // worker.postMessage({ sab })

  /**
   * @param {number[]} arr
   * @param {number} pos
   * @param {number[]} data
   *  */
  function writeImplRef(arr, pos, data) {
    for (let i = 0; i < data.length; i++) {
      arr[(pos + i) % arr.length] = data[i]
    }
  }

  /**
   * @param {number[]} as
   * @param {number[]} bs
   */
  function assertEqual(as, bs) {
    if (as.length !== bs.length) throw new Error('array lengths differ')
    for (let i = 0; i < as.length; i++) {
      if ((as[i] - bs[i]) % 256 !== 0) {
        console.warn('Expected: ', as)
        console.warn('Actual:   ', bs)
        throw new Error(`as and bs differs at pos ${i}: ${as[i]} != ${bs[i]}`)
      }
    }
  }

  /**
   * @param {number} toread
   */
  function incReadPtr(toread) {
    const rpos = Atomics.load(new Int32Array(sab, 0, 1), 0)
    Atomics.store(new Int32Array(sab), 0, (rpos + toread) % (SIZE * 2))
  }

  function fuzz() {
    let i = 1
    let nfill = 0
    const refArray = new Array(SIZE).fill(0)

    while (i < 10000) {
      const cnt = Math.floor(Math.random() * (SIZE - nfill)) + 1
      const arr = []
      for (let j = i; j < i + cnt; j++) arr.push(j)

      const wpos = Atomics.load(new Int32Array(sab, 4, 1), 0)

      writer.write(new Uint8Array(arr))
      nfill += cnt

      writeImplRef(refArray, wpos, arr)
      assertEqual(refArray, Array.from(writer.buffer.slice()))

      const toread = Math.floor(Math.random() * nfill) + 1
      nfill -= toread

      const result = reader.read(toread)
      if (!result.ok) {
        throw new Error('read fails')
      }

      const avail = writer.spaceAvailable(Atomics.load(new Int32Array(sab, 0, 1), 0), Atomics.load(new Int32Array(sab, 4, 1), 0))
      if (avail != SIZE - nfill) {
        console.log(`rpos ${Atomics.load(new Int32Array(sab, 0, 1), 0)} wpos ${Atomics.load(new Int32Array(sab, 4, 1), 0)}`)
        throw new Error(`writer.avail ${avail} is incorrect; should be ${SIZE - nfill}`)
      }

      i += cnt
      // console.log('---', nfill)
    }

    console.log('ended with nfill', nfill, {...writer})
  }

  function writerOverflow() {
    writer.write(new Uint8Array([1, 2, 3, 4, 5, 6, 7]))
    incReadPtr(3)
    writer.write(new Uint8Array([8, 9, 10, 11, 12]))
    console.log(writer)
  }

  // try running in browser

  fuzz()

  let errored = false
  try {
    writerOverflow()
  } catch { errored = true }
  if (!errored) {
    throw new Error('should error')
  }
</script>

<h1>it works!</h1>
