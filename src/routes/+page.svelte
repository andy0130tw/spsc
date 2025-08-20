<script>
  import Producer from '$lib/worker/producer?worker'
  import Consumer from '$lib/worker/consumer?worker'
  import { SPSC_RESERVED_SIZE } from 'spsc'
  import { onDestroy } from 'svelte'

  if (!window.crossOriginIsolated) {
    throw new Error('NOT COI')
  }

  const producer = new Producer({ name: 'producer' })

  const SIZE = 8
  const sab = new SharedArrayBuffer(SPSC_RESERVED_SIZE + SIZE)

  // ------------------ CHANGE HERE ------------------
  const CONSUMER_IN_WORKER = true
  // ------------------ CHANGE HERE ------------------

  producer.onerror = function(error) {
    console.error(`PRODUCER encounter error`, error)
    halt()
  }

  /** @param {ErrorEvent} error */
  function consumerOnError(error) {
    console.error(`CONSUMER encounter error`, error)
    halt()
  }

  /** @type {(() => void) | undefined} */
  let consumerAbort

  if (CONSUMER_IN_WORKER) {
    const consumer = new Consumer({ name: 'consumer' })
    consumer.postMessage({ sab })
    consumer.onerror = consumerOnError
    consumerAbort = () => /** @type {any} */(consumer).terminate()

    producer.postMessage({ sab })
  } else {
    const abc = new AbortController()
    import('$lib/readerJob')
    .then(({default: readerJob}) => {
      const msgchan = new MessageChannel()
      producer.postMessage({ sab, port: msgchan.port1 }, [msgchan.port1])
      return readerJob(sab, msgchan.port2, abc.signal)
    }).catch(consumerOnError)
    consumerAbort = () => abc.abort()
  }

  function halt() {
    producer.terminate()
    consumerAbort?.()
  }

  onDestroy(halt)
</script>

<h1>it works!</h1>
<ul>
  <li>Buffer <code>SIZE</code> is <strong>{SIZE}</strong>.</li>
  <li><code>CONSUMER_IN_WORKER</code> is <strong>{CONSUMER_IN_WORKER ? 'enabled' : 'disabled'}</strong>.</li>
</ul>
