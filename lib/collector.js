function Collector() {
  this.limit = 1000000
}

Collector.prototype.collect = function (stream) {
  var limit = this.limit
  var size  = 0

  return new Promise(function (resolve, reject) {
    var buff = []

    stream.on('data', function ondata(chunk){
      var l = chunk.length

      if (size + l > limit) {
        stream.removeListener('data', ondata)
        return reject(KindError('StreamTooLarge'))
      }

      else {
        buff.push(chunk)
        size += chunk.length
      }

    })

    stream.on('end', function (){
      if (size === 0) return resolve()
      else
        resolve(buff.join(''))
    })
  })
}

module.exports = Collector
