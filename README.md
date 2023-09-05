# c1-node

Ok, I'll use this document to write findings and pending stuff.

## Datachannels

### General

DataChannels in the current implementation are raw, so `feross` lied about `simple-peer` providing duplex streams, if you look in the implementation (correct me if I'm wrong) the `_write` method is just sending without any sort of confirmation through the wire, because the expectation is to buffer everything like always, **we don't want that, we want 1 chunk at a time**, that means, we send 1 chunk, the receiving end sends a message to the origin asking for the next chunk (what I mean is, in local streams is fine because the instances expect methods to `drain` the stream, but through the wire we are using serialized interfaces in both ends, so we need to deal with the flow control messaging.)

### File sharing

Ok, so the naive implementation for file sharing from hub -> workers but there's a lot of details that need to be handled:
- Right now the file sharing is totally ignoring `backpressure` so in the emitting side is buffering the full file into the peer connection, with small files there's no problem, but with big files doesn't scale at all, we need to create a `Duplex` stream to handle the `ds` connection (implementing a class that extends `Duplex` and create the stream methods, `_read`, `_write`, `_finalize`), we can use [simple-peer](https://github.com/feross/simple-peer/blob/master/index.js) as reference.

You can read more about streams (here in the docs)[https://nodejs.org/api/stream.html]

### Some thoughts about this

The native `send` method in WebRTC already has a `drain` logic, this means internally should have some sort of control-flow signaling logic, so we can trigger the `buffer-drained` event to push the next chunk, but this needs to be confirmed because there's a big hole in the docs vs current implementations.

## TODO:

Create a method that returns a stream that uses a RTCDataChannel as transport, here you can specify some things like:
- path: for files
- type: to know whats the point of this stream, is a file?, is just a buffer (wasm)?, maybe is a express endpoint?.
- highWaterMark: maybe it can be dynamic based on current conditions.

The idea is that the stream should work with other native streams so it's `pipeable` so **signals from the OS can travel from the sink to the source.**

Need to discuss this with the team.