var test   = require('tape').test
var assert = require('assert')
var http   = require('http')
var solid  = require('lib-stream-solidify')
var RPC    = require('../index.js')
var proto  = {
  types: {
    person: {type: 'struct', props: {
      name: 'string',
      age : 'number',
    }, require: ['name']}
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
  this.app    = new App
  this.rpc    = RPC.New(proto)

  var serverRpc = RPC.New(proto)

  this.router = serverRpc.getRouter(this.app)
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

test("send object that doesn't match schema", function (t){
  var test = new Test()
  test.start(function (rpc){
    http.request({port: test.port, method: 'PUT'}, done).end('{}')

    function done(res){
      t.equal(res.statusCode, 400)
      solid(res).json(function(_, data) {
        var err = {"type":"error","code":400,"message":"Required Property <name> Missing at <var>"}
        t.deepEqual(data, err)

        test.stop()
        t.end()
      })
    }
  })
})

test("send data that fails to parse", function (t){
  if (Promise.longStackTraces) Promise.longStackTraces();

  var test = new Test()
  test.start(function (rpc){
    http.request({port: test.port, method: 'PUT'}, done).end('}')

    function done(res){
      t.equal(res.statusCode, 400, 'should have status 400')
      solid(res).json(function(_, data) {
        var err = {"type":"error","code":400,"message":"Unexpected token }"}
        t.deepEqual(data, err, 'should bubble json.parse errors')

        test.stop()
        t.end()
      })
    }
  })
})

test("send empty data", function (t){
  if (Promise.longStackTraces) Promise.longStackTraces();

  var test = new Test()
  test.start(function (rpc){
    http.request({port: test.port, method: 'PUT'}, done).end('')

    function done(res){
      t.equal(res.statusCode, 400, 'should have status 400')
      solid(res).json(function(_, data) {
        var err = {"type":"error","code":400,"message":"Expected Body"}
        t.deepEqual(data, err, 'should give a nice message when there is no body')

        test.stop()
        t.end()
      })
    }
  })
})
