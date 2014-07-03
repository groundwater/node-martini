var KindError = require('./error.js')
var melt      = require('lib-stream-liquify')
var collector = new (require('./collector'))

function None() {

}

None.prototype.toStream = function (val) {
  if (val) throw KindError('RequireNone')

  return {
    stream: melt(),
    contentType: 'text/plain'
  }
}

None.prototype.fromStream = function (stream) {
  return collector.collect(stream).then(function(val) {
    if (val) throw KindError('RequireNone')
  })
}
module.exports = None
