var test   = require('tap').test

var http   = require('http')
var RPC    = require('../index.js')
var proto  = {
  types: {
    person: {type: 'struct', props: {
      name: 'string',
      age : 'number',
    }}
  },
  routes: {
    get: {
      proto: {
        method: 'GET',
        route : '/'
      },
      output: 'person'
    }
  }
}

function App() {

}

App.prototype.get = function(){
  return new Promise(function(done){
    setImmediate(done, {name: 'todd', age: 20})
  })
}

var rpc    = RPC.New(proto)
var app    = new App

var router = rpc.getRouter(app)
var server = http.createServer(router)

server.listen(0, function () {
  var port   = server.address().port
  var client = rpc.getClient(port, 'localhost')

  test(function(t){
    client.get(null, {})
    .then(function(){
      server.close()
      t.end()
    })
    .catch(console.error)
  })
})
