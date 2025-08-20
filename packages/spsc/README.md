# spsc

Single-producer-single-consumer queue that adheres to POSIX's pipe semantics.

Note that this package requires a [cross-origin-isolated
](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)
(COI) context if run in a browser.

The package is developed as a minimal solution to implement efficient-enough,
synchronous, blocking I/O between WASM/WASI with browser's JS host.

## Usage

Make a `SharedArrayBuffer` and share it between two execution contexts (
preferably workers). At either end, initialize `SPSCReader` and `SPSCWriter`
accordingly. Send message to the writer side, and receive it from the reader
side. A PoC writer should look like:

```js
import { allocateArrayBuffer } from 'spsc'
import { SPSCWriter } from 'spsc/writer'

const sab = allocateArrayBuffer(256)
const writer = new SPSCWriter(sab)
writer.write(new Uint8Array([1, 2, 3]))  // -> { ok: true, bytesWritten: 3 }
```

Here is the reader part:

```js
import { SPSCReader } from 'spsc/reader'
var sab  // suppose the sab is cloned
const reader = new SPSCWriter(sab)
reader.read(3)  // -> { ok: true, bytesRead: 3, data: Uint8Array [1, 2, 3] }
const ready = reader.pollRead(1000)  // -> false
reader.close()
```

Note that readers and writers do not throw on I/O errors. It is your own
responsibility (i.e. freedom) to check the result.

### Using in browser main thread

Note that blocking I/O behavior is done with `Atomics.{wait,notify}` by default.
If your thread does not allow pausing (e.g., browser main thread), this library
provides an alternative (but not air-tight) way:

Let's suppose that your reader lives in the main thread. To adopt this pattern,
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
  const result = reader.read(1, { nonblock: true })  // MUST always be nonblocking
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
