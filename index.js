'use strict'

if (!global.Promise) global.Promise = require('bluebird')

var http           = require('http')
var assert         = require('assert')

var melt           = require('lib-stream-liquify')
var solid          = require('lib-stream-solidify')
var Schema         = require('lib-schema')
var API            = require('lib-http-api')()
var PolyGen        = require('lib-polygen').PolyGenerator;

var Collector      = require('./lib/collector.js')
var None           = require('./lib/none.js')
var StreamToSchema = require('./lib/schema.js')
var StreamIdentity = require('./lib/stream.js')
var StreamToObject = require('./lib/object.js')
var KindError      = require('./lib/error.js')

var collector = new Collector()

function JSONStream(schema) {
  this.schema = schema
}

var PassThrough = require('stream').PassThrough
var EE = require('events').EventEmitter

JSONStream.prototype.toStream = function(obj) {
  var stream = new PassThrough
  var schema = this.schema

  obj.on('data', function(person){
    // emitting null is the same as ending the stream
    if (person === null) stream.end()
    else try {
      var out = schema.marshal(person)
      stream.write(JSON.stringify(out) + '\n')
    } catch (e) {
      obj.emit('error', e)
      stream.end()
    }
  })

  // call this, or emit null to end
  obj.on('end', function () {
    stream.end()
  })

  return {
    stream: stream,
    contentType: 'text/plain'
  }
}

JSONStream.prototype.fromStream = function (str) {
  var ee = new EE
  var schema = this.schema

  // allow the EE to be bound before calling onData
  setImmediate(function(){
    str.on('data', function(data){
      try {
        ee.emit('data', schema.marshal(JSON.parse(data)))
      } catch(e) {
        ee.emit('error', e)
      }
    })
    str.on('end', function(){
      ee.emit('end')
    })
  })

  return ee
}

function RPC(protocol) {
  this.protocol = protocol
}

RPC.prototype.get = function get(handle) {
  var routes = this.appHandlers
  var handle

  return new Promise(function (resolve, reject) {
    if (routes[handle])
      resolve(routes[handle])
    else reject(KindError('NoRouter'))
  })
}

RPC.prototype.apiGet = function apiGet(method, url) {
  var api = this.api

  return new Promise(function (resolve, reject) {
    var info = api.handle(method, url)

    if (info) resolve(info)
    else      reject(KindError('NoRoute'))
  })
}

RPC.New = function (protocol) {
  var rpc = new RPC

  var s = Schema(protocol.types)
  var poly = new PolyGen()

  poly.addSymbol(':stream', function () {
    return new StreamIdentity
  })
  poly.addSymbol(':json', function () {
    return new StreamToObject
  })
  poly.addSymbol(':none', function () {
    return new None
  })
  poly.addSymbol(undefined, function () {
    return new None
  })
  poly.setDefault(function (scheme) {
    var marsh = s[scheme]

    if (marsh) return new StreamToSchema(marsh)

    // overload this method for now
    // allow peopel to specify `stream/BLA` as a type
    // where `BLA` must be a marshalable type
    var split = scheme.split('/')
    if (split.length !== 2) assert(marsh, 'protocol type <' + scheme + '> not defined')

    var left  = split[0]
    var right = split[1]

    assert.equal(left, 'emitter', 'emitter type expected')

    var marsh = s[right]
    assert(marsh, 'protocol type <' + scheme + '> not defined')

    return new JSONStream(marsh)
  });

  rpc.protocol = protocol
  rpc._parser  = poly

  return rpc
}

RPC.prototype.getClient = function (port, host) {
  var client = {}

  var routes = this.protocol.routes
  var api = API.New(port, host)

  var s = Schema(this.protocol.types)
  var poly = this._parser

  Object.keys(routes).forEach(function (key) {

    // common
    api.add(key, routes[key].proto)

    var input  = poly.generate(routes[key].input)
    var output = poly.generate(routes[key].output)

    client[key] = function (data, params, opts) {
      var url = api.request(key, params, opts)

      return new Promise(function (resolve, reject) {
        url.headers = {
          'Transfer-Encoding': 'chunked'
        }

        var req = http.request(url, function (res) {
          if (res.statusCode === 200) {
            resolve(output.fromStream(res))
          }
          else {
            collector.collect(res)
            .then(function (data) {
              // an error has ocurred
              // we don't know what to expect
              try {
                // try parsing response
                reject(JSON.parse(data))
              } catch (e) {
                // maybe it's just a string
                reject(data)
              }
            })
          }
        })

        req.on('error', reject)

        input.toStream(data).stream.pipe(req)
      })
    }

    // client[key].name = key
  })

  this.api = api

  return client
}

RPC.prototype.getRouter = function (app) {
  var self   = this
  var routes = this.protocol.routes
  var api    = API.New()

  var poly = this._parser
  var appHandlers = this.appHandlers = {}

  Object.keys(routes).forEach(function (key) {

    // common
    api.add(key, routes[key].proto)

    var input  = poly.generate(routes[key].input)
    var output = poly.generate(routes[key].output)

    // server

    // stub nonexistent routes
    if (!app[key]) {
      appHandlers[key] = {
          input: input,
          output: output,
          handle: function () {
            throw KindError('NotImplemented')
          }
      }

      return
    }

    // add route
    var func = function(body, params, opts){
      return app[key](body, params, opts)
    }
    appHandlers[key] = {
      input  : input,
      output : output,
      handle : func
    }

  })

  return router.bind(this)
}

function router(req, res) {
  var router = this
  var handler
    , info
    , data

  // extract the destination route from url
  router.apiGet(req.method, req.url)
  .then(function (_info) {
    info = _info

    // find the specified router
    return router.get(info.handle)
  })
  .then(function (_handler) {
    handler = _handler

    // format the incoming request
    return handler.input.fromStream(req)
  })
  .then(function (_data) {
    data = _data

    // apply the request to the route
    return handler.handle(data, info.params, info.query)
  })
  .then(function (_reply) {

    // format the _reply into a response object
    return handler.output.toStream(_reply)
  })
  .then(function(_res){
    res.statusCode = 200
    res.setHeader('Content-Type', _res.contentType)

    _res.stream.pipe(res)
  })
  .catch(function(err){
    // something went wrong

    var status, message

    switch (err.kind) {
    case 'NotFound':
    case 'NoRoute':
      status  = 404
      message = 'Not Found'
      break

    case 'NotImplemented':
    case 'NoRouter':
      status  = 501
      message = 'Not Implemented'
      break

    case 'StreamTooLarge':
      status  = 413
      message = 'Request Too Large'
      break

    case 'UnsupportedType':
      status  = 415
      message = 'Unsupported Media Type'
      break

    case 'NotJSON':
    case 'RequireNone':
      status  = 400
      message = 'Bad Request'
      break

    case 'MarshalException':
      status  = 400
      message = err.message
      break

    default:
      status  = 500
      message = 'Unknown Error'

      if (err && err.stack)
           console.error('[FAIL]', err.stack)
      else console.error('[FAIL]', err)
    }

    res.statusCode = status
    res.end(JSON.stringify({
      type    : 'error',
      code    : status,
      message : message,
    }) + '\n')
  })
  .catch(function(e){

    // something went very wrong
    console.log('/// ABORT \\\\\\')
    console.log(e)

    process.abort()
  })
}

RPC.KindError = KindError

module.exports = RPC
