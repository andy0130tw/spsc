# spsc

Single-producer-single-consumer queue that adheres to POSIX's pipe semantics.

Note that this package needs to be run in a [cross-origin-isolated
](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)
(COI) context.

## Usage

Make a `SharedArrayBuffer` and share it between two workers (also possible to
use main thread with caveats). At either end, initialize `SPSCReader` and
`SPSCWriter` accordingly. Send message at the writer side, and receive it from
the reader side.

```js
import { SPSC_RESERVED_SIZE } from 'spsc'
import { SPSCWriter } from 'spsc/writer'

const sab = new SharedArrayBuffer(16 + 256)
const writer = new SPSCWriter(sab)
writer.write(new Uint8Array([1, 2, 3]))  // -> { ok: true, bytesWritten: 3 }
```

```js
import { SPSCReader } from 'spsc/reader'
const reader = new SPSCWriter(sab)
reader.read(3)  // -> { ok: true, bytesRead: 3, data: ... }
```

Note that by default, blocking I/O behavior is done with `Atomics.{wait,notify}`.
If your thread does not allow pausing (e.g., browser main thread), this library
provides an alternative way:

Suppose that your reader lives in the main thread. To adopt this pattern,
create a `MessageChannel` and transfer one of either port into the *other* end
(in this example, the writer):

```js
const msgchan = new MessageChannel()

const writer = new SPSCWriter(
  sab,
  msgchan.port1,  // the one end
  true  // (optional) token, default to true
)
```

The reader should listen to the other end to retry a nonblocking read. This
technique effectively turns the blocking I/O pattern into a cooperative
scheduling one.

```js
let pendingRead

// suppose `port` is the transferred `msgchan.port2`
port.onmessage = event => {
  if (pendingRead == null) return
  // regaining the control
  pendingRead()
  pendingRead = undefined
}

while (true) {
  const result = reader.read(1, { nonblock: true })  // MUST be nonblocking
  if (!result.ok) {
    if (msgport && result.error === SPSCError.Again) {
      // yielding the control
      await new Promise(resolve => pendingRead = resolve)
      continue
    } else {
      throw new Error('read failed')
    }
  }
  // do something with the result
}
```
