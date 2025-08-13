<script>
  import Producer from '$lib/worker/producer?worker'
  import Consumer from '$lib/worker/consumer?worker'
  import { SPSC_RESERVED_SIZE } from '$lib/spsc/common'

  if (!window.crossOriginIsolated) {
    throw new Error('NOT COI')
  }

  const producer = new Producer({ name: 'producer' })
  const consumer = new Consumer({ name: 'consumer' })

  const SIZE = 8
  const sab = new SharedArrayBuffer(SPSC_RESERVED_SIZE + SIZE)

  producer.postMessage({ sab })
  consumer.postMessage({ sab })

  producer.onerror = function(error) {
    console.error(`PRODUCER encounter error`, error)
    halt()
  }
  consumer.onerror = function(error) {
    console.error(`CONSUMER encounter error`, error)
    halt()
  }

  function halt() {
    producer.terminate()
    consumer.terminate()
  }

</script>

<h1>it works!</h1>
