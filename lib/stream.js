var assert = require('assert')

function StreamIdentity() {

}

StreamIdentity.prototype.toStream = function toStream(stream) {
  assert(stream, 'stream required')

  return {
    stream: stream,
    contentType: 'text/plain'
  }
}

StreamIdentity.prototype.fromStream = function fromStream(stream) {
  assert(stream, 'stream required')

  return new Promise(function (ok){
    ok(stream)
  })
}

module.exports = StreamIdentity
