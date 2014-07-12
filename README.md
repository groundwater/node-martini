# Martini

> Client and Server _RPC_

Martini can generate both the client, and server from a single protocol.

<img src="https://i.imgur.com/0v3SBsl.png" height=200>

## Usage

![promises](http://img.shields.io/badge/promises-ES6/A+-blue.svg)
![streams](http://img.shields.io/badge/streams-node.js-blue.svg)
![event emitters](http://img.shields.io/badge/event%20emitters-node.js-blue.svg)

### Define a protocol

Create a `user` type,
and define a single route that returns a JSON-encoded user.

```js
var protocol = {
  types: {
    user: {type: 'struct', props: {
      name  : 'string',
      phone : 'string,'
      age   : 'number',
    }, require: ['name']}
  },
  routes: {
    getUser: {
      proto: {
        method : 'GET',
        route  : '/user/:uid'
      },
      output: 'user'
    }
  }
}
```

### Create the server

Create a server class,
and implement all methods in the protocol.
Each route must return a *Promise* object.

```js
function Server() {}

Server.prototype.getUser = function (_, params) {
  return new Promise(function (done) {
    done({user: 'bob', phone: '123-432-2131', age :30})
  })
}
```

Create a *router* out of the server object.

```js
var http   = require('http')
var RPC    = require('martini')

var rpc    = RPC.New(protocol)
var router = rpc.getRouter(new Server())

var server = http.createServer(router)

server.listen(process.env.PORT)
```

### Create the client

```js
var RPC    = require('martini')
var rpc    = RPC.New(protocol)
var client = rpc.getClient(process.env.PORT, process.env.HOST)

client.getUser(null, {uid: 1234})
  .then(console.log)
  .catch(console.error)
```

## Advanced

### Streaming JSON

Newline delimited JSON is a powerful, yet simple protocol.
Define a typed stream using `emitter/TYPE` where `TYPE` is a marshalable format, e.g.

```js
var protocol = {
  types: {
    user: {type: 'struct', props: { name: 'string' }
  },
  routes: {
    getUsers: {
      proto: {
        method : 'GET',
        route  : '/users'
      },
      output: 'emitter/user'
    }
  }
}
```

Create a server route that returns an event emitter

```js
Server.prototype.getUsers = function () {
  var ee = new EventEmitter()
  setImmediate(function(){ // this must be on another tick
    ee.emit('data', {name: 'bob'})
    ee.emit('data', {name: 'kim'})
    ee.emit('end')
  })
  return ee
}
```

Create a client that consumes the event emitter

```js
client.getUsers(null, {})
.then(function (users) {
  users.on('data', function(user){
    console.log('Got User:', user.name)
  })
  users.on('end', function(){
    console.log('DONE')
  })
})
```

This will print the following

```
Got User: bob
Got User: kim
DONE
```


## See Also

- [lib-schema](https://www.npmjs.org/package/lib-schema)
  the schema protocol used to validate requests
- [lib-marshal](https://www.npmjs.org/package/lib-marshal)
  the plumbing for *lib-schema*
- [asgard](https://www.npmjs.org/package/asgard)
  the node-os init daemon
