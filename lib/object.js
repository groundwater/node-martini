function StreamToObject() {
  this.limit = 1000000 // in bytes?
}

StreamToObject.prototype.applyLeft = function applyLeft(object) {
  return {
    stream      : melt(object),
    contentType : 'application/json'
  }
}

StreamToObject.prototype.applyRight = function applyRight(stream) {
  var limit = this.limit
  var size  = 0

  return new Promise(function (resolve, reject) {
    var buff = []

    stream.on('data', function ondata(chunk){
      var l = chunk.length

      if (size + l > limit) {
        stream.removeListener('data', ondata)
        return reject('StreamTooLarge')
      }

      else {
        buff.push(chunk)
        size += chunk.length
      }

    })

    stream.on('end', function (){
      if (buff.length == 0) return resolve('')

      try {
        resolve(JSON.parse(buff.join('')))
      } catch (e) {
        // a syntax error is an operational error
        if (e instanceof SyntaxError)
          reject('NotJSON')

        // non syntax-errors must be propagated
        else reject(e)
      }
    })
  })
}

module.exports = StreamToObject
