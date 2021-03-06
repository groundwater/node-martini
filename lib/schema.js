var KindError = require('./error.js')
var Collector = require('./collector.js')
var melt = require('lib-stream-liquify')

function StreamToSchema(schema) {
  this.schema = schema

  this._collector = new Collector
}

StreamToSchema.prototype.toStream = function (object) {
  var k

  try {
    k = this.schema.marshal(object)
  } catch(e) {
    e.kind = 'MarshalError'
    throw e
  }

  return {
    stream: melt(k),
    contentType: 'application/json'
  }
}

StreamToSchema.prototype.fromStream = function (stream) {
  var schema = this.schema

  return this._collector.collect(stream)
    .then(function (obj) {
      if (obj === '' || obj === undefined)
        throw KindError('MarshalException', 'Expected Body')

      try {
        return schema.marshal(JSON.parse(obj))
      } catch(e) {

        e.kind = 'MarshalException'

        throw e
      }
    })
}

module.exports = StreamToSchema
