var test   = require('tap').test
var assert = require('assert')
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
    },
    set: {
      proto: {
        method: 'PUT',
        route : '/'
      },
      input: 'person',
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

App.prototype.set = function(user){
  return user
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

  self.server.listen(self.port, function(){
    self.port = self.server.address().port
    callback(
      self.rpc.getClient(self.port, 'localhost')
    )
  })
}

Test.prototype.stop = function(){
  this.server.close()
}

test("simple output", function (t){
  var test = new Test()
  test.start(function (rpc){
    rpc.get(null, {}).
    then(function(val){
      t.deepEquals(val, {name: 'todd', age: 20}, 'returns a person')

      test.stop()
      t.end()
    })
  })
})

test("simple input", function (t){
  var test = new Test()
  test.start(function (rpc){
    rpc.set({name: 'jim'}, {}).
    then(function(val){
      t.deepEquals(val, {name: 'jim'}, 'returns the same person')

      test.stop()
      t.end()
    })
  })
})

test("validation error", function (t){
  var test = new Test()
  test.start(function (rpc){
    rpc.set(null, {}).
    catch(function(e){
      t.equals(e.message,
        'Expected <object> but Received <null> of type <object> at <object>',
        'should throw validation error')
      test.stop()
      t.end()
    })
  })
})
