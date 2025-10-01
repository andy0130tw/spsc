# spsc

The testbed to the package [spsc](packages/spsc). This package is like [ringbuf.js](https://github.com/padenot/ringbuf.js/) but allows blocking communicatons. See the package for README.

Build the package and then build this website, and you should see the following output in console.

```
16:34:36.088 reader on message  Object { sab: SharedArrayBuffer }
16:34:36.089 reader start 70.7
16:34:37.089 reader report: seq 5635 avg speed 5634.324 bps
16:34:38.093 reader report: seq 11095 avg speed 5438.247 bps
16:34:39.093 reader report: seq 16847 avg speed 5751.885 bps
16:34:40.100 reader report: seq 22887 avg speed 5998.729 bps
[...]
16:34:52.143 reader report: seq 94299 avg speed 5536.792 bps
16:34:53.048 producer finish writing and will close the pipe soon
16:34:54.054 closing writer's end
16:34:54.054 writer job is done!
16:34:54.055 reader got EOF
16:34:54.055 reader end, seq= 100000 ts= 18037.08
16:34:54.055 closing reader's end
16:34:54.055 reader job is done!
```
