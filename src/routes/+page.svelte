<script>
  import Producer from '$lib/worker/producer?worker'
  import Consumer from '$lib/worker/consumer?worker'
  import { SPSC_RESERVED_SIZE } from '$lib/spsc/common'

  if (!window.crossOriginIsolated) {
    throw new Error('NOT COI')
  }

  const producer = new Producer({ name: 'producer' })
  /** @type {Worker | undefined} */
  let consumer

  const SIZE = 8
  const sab = new SharedArrayBuffer(SPSC_RESERVED_SIZE + SIZE)

  producer.onerror = function(error) {
    console.error(`PRODUCER encounter error`, error)
    halt()
  }

  const demoInWorker = true
  if (demoInWorker) {
    producer.postMessage({ sab })

    consumer = new Consumer({ name: 'consumer' })
    consumer.postMessage({ sab })
    consumer.onerror = function(error) {
      console.error(`CONSUMER encounter error`, error)
      halt()
    }
  } else {
    const msgchan = new MessageChannel()

    import('$lib/readerJob')
    .then(({default: readerJob}) => {
      producer.postMessage({ sab, port: msgchan.port1 }, [msgchan.port1])
      return readerJob(sab, msgchan.port2)
    })
  }

  function halt() {
    producer.terminate()
    consumer?.terminate()
  }
</script>

<h1>it works!</h1>
