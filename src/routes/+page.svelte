<script>
  import Producer from '$lib/worker/producer?worker'
  import Consumer from '$lib/worker/consumer?worker'
  import { SPSC_RESERVED_SIZE } from 'spsc'

  if (!window.crossOriginIsolated) {
    throw new Error('NOT COI')
  }

  const producer = new Producer({ name: 'producer' })
  /** @type {Worker | undefined} */
  let consumer

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

  if (CONSUMER_IN_WORKER) {
    producer.postMessage({ sab })

    consumer = new Consumer({ name: 'consumer' })
    consumer.postMessage({ sab })
    consumer.onerror = consumerOnError
  } else {
    const msgchan = new MessageChannel()

    import('$lib/readerJob')
    .then(({default: readerJob}) => {
      producer.postMessage({ sab, port: msgchan.port1 }, [msgchan.port1])
      return readerJob(sab, msgchan.port2)
    }).catch(consumerOnError)
  }

  function halt() {
    producer.terminate()
    consumer?.terminate()
  }
</script>

<h1>it works!</h1>
<ul>
  <li>Buffer <code>SIZE</code> is <strong>{SIZE}</strong>.</li>
  <li><code>CONSUMER_IN_WORKER</code> is <strong>{CONSUMER_IN_WORKER ? 'enabled' : 'disabled'}</strong>.</li>
</ul>
