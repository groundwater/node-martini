var test   = require('tap').test
var assert = require('assert')
var http   = require('http')
var RPC    = require('../index.js')

var missingTypes  = {
  routes: {}
}

var missingRoutes = {
  types: {}
}

test('missing types in schema', function(t){
  t.throws(function(){
    RPC.New(missingTypes)
  }, new assert.AssertionError({message: 'property {types} missing in protocol'}), 'throws assert error')
  t.end()
})

test('missing routes in schema', function(t){
  t.throws(function(){
    RPC.New(missingRoutes)
  }, new assert.AssertionError({message: 'property {routes} missing in protocol'}), 'throws assert error')
  t.end()
})

test('missing schema', function(t){
  t.throws(function(){
    RPC.New()
  }, new assert.AssertionError({message: 'schema required'}), 'throws assert error')
  t.end()
})
