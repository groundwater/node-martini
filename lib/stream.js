var assert = require('assert')

function StreamIdentity() {

}

StreamIdentity.prototype.applyLeft = function applyLeft(stream) {
  assert(stream, 'stream required')

  return {
    stream: stream,
    contentType: 'text/plain'
  }
}

StreamIdentity.prototype.applyRight = function applyRight(stream) {
  assert(stream, 'stream required')

  return new Promise(function (ok){
    ok(stream)
  })
}

module.exports = StreamIdentity
