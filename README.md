# Martini

> Client and Server _RPC_

Martini can generate both the client, and server from a single protocol.

<img src="https://i.imgur.com/0v3SBsl.png" height=200>

## Usage

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

## See Also

- [lib-schema](https://www.npmjs.org/package/lib-schema)
  the schema protocol used to validate requests
- [lib-marshal](https://www.npmjs.org/package/lib-marshal)
  the plumbing for *lib-schema*
- [asgard](https://www.npmjs.org/package/asgard)
  the node-os init daemon
