<script>
  import Worker from '$lib/worker?worker'
  import WriteWorker from '$lib/worker/writer?worker'

  if (!window.crossOriginIsolated) {
    throw new Error('NOT COI')
  }

  const readWorker = new Worker({ name: 'reader' })
  const writeWorker = new WriteWorker({ name: 'writer' })

  const SIZE = 8
  const sab = new SharedArrayBuffer(16 + SIZE)

  readWorker.postMessage({ sab })
  writeWorker.postMessage({ sab })

  readWorker.onerror = function(data) {
    console.error(`READER encounter error`, data.error)
    halt()
  }
  writeWorker.onerror = function(data) {
    console.error(`WRITER encounter error`, data.error)
    halt()
  }

  function halt() {
    readWorker.terminate()
    writeWorker.terminate()
  }

</script>

<h1>it works!</h1>
