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

var collector = new Collector()

function KindError(kind, message) {
  var err = new Error(message)

  err.kind = kind

  return err
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
  var pg = new PolyGen()

  pg.addSymbol(':stream', function () {
    return new StreamIdentity
  })
  pg.addSymbol(':json', function () {
    return new StreamToObject
  })
  pg.addSymbol(':none', function () {
    return new None
  })
  pg.addSymbol(undefined, function () {
    return new None
  })
  pg.setDefault(function (scheme) {
    var marsh = s[scheme]

    assert(marsh, 'protocol type <' + scheme + '> not defined')

    return new StreamToSchema(marsh)
  });

  rpc.protocol = protocol
  rpc._parser  = pg

  return rpc
}

RPC.prototype.getClient = function (port, host) {
  var client = {}

  var routes = this.protocol.routes
  var api = API.New(port, host)

  var s = Schema(this.protocol.types)
  var pg = this._parser

  Object.keys(routes).forEach(function (key) {

    // common
    api.add(key, routes[key].proto)

    var input  = pg.generate(routes[key].input)
    var output = pg.generate(routes[key].output)

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

    client[key].name = key
  })

  this.api = api

  return client
}

RPC.prototype.getRouter = function (app) {
  var self = this
  var routes = this.protocol.routes
  var api = API.New()

  var pg = this._parser
  var appHandlers = this.appHandlers = {}

  Object.keys(routes).forEach(function (key) {

    // common
    api.add(key, routes[key].proto)

    var input  = pg.generate(routes[key].input)
    var output = pg.generate(routes[key].output)

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
