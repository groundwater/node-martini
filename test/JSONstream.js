var test   = require('tap').test
var EE     = require('events').EventEmitter
var assert = require('assert')
var http   = require('http')
var RPC    = require('../index.js')
var proto  = {
  types: {
    person: {type: 'struct', props: {name: 'string'}}
  },
  routes: {
    getPeople: {
      proto: {
        method: 'GET',
        route : '/people'
      },
      output: 'emitter/person'
    },
    putPeople: {
      proto: {
        method: 'PUT',
        route : '/people'
      },
      input: 'emitter/person'
    }
  }
}

function App() {

}
var EE = require('events').EventEmitter
App.prototype.getPeople = function(){
  var ee = new EE

  setImmediate(function(){
    ee.emit('data', {name: 'bob'})
    ee.emit('end')
  })

  return ee
}

function Test() {
  this.port   = 0
  this.rpc    = RPC.New(proto)
  this.app    = new App

  this.router = this.rpc.getRouter(this.app)
  this.server = http.createServer(this.router)
}

Test.prototype.start = function (callback) {
  var self = this

  self.server.listen(this.port, function(){
    self.port = self.server.address().port
    callback(
      self.rpc.getClient(self.port, 'localhost')
    )
  })
}

Test.prototype.stop = function(){
  this.server.close()
}

test("stream JSON objects", function (t){
  t.plan(1)

  var test = new Test()
  test.start(function (rpc){
    rpc.getPeople(null, {})
    .then(function(ee){
      ee.on('data', function(p){
        t.deepEqual(p, {name: 'bob'})
      })
      ee.on('end', function(){
        test.stop()
        t.end()
      })
    })
    .catch(function(e){
      t.ifError(e)
    })
  })
})

test("invalidate a stream of bad JSON objects", function (t){
  t.plan(2)

  var test = new Test()
  test.start(function (rpc){
    var ee = new EE

    rpc.putPeople(ee, {})
    .then(function(ee){
      // discard
    })
    .catch(function(e){
      // discard
    })

    ee.on('error', function (e){
      t.equal(e.expected, 'object')
      t.equal(e.recieved, 123)

      test.stop()
      t.end()
    })

    ee.emit('data', 123)
  })
})
