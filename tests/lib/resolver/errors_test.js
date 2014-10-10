/* global it, before, beforeEach, assert:true, describe, requireApp */
'use strict';
var createEntries, assert, Resolver;

if (typeof navigator !== 'undefined') {
  requireApp('sharedtest/test/unit/l10n/lib/resolver/header.js');
} else {
  Resolver = require('./header.js').Resolver;
  createEntries = require('./header.js').createEntries;
  assert = require('./header.js').assert;
}

describe('Compiler errors:', function(){
  var source, env;
  beforeEach(function() {
    env = createEntries(source);
  });

  describe('A complex string referencing an existing entity', function(){

    before(function() {
      source = [
        'file=File',
        'prompt={[ plural(n) ]}',
        'prompt[one]=One {{ file }}',
        'prompt[other]=Files'
      ].join('\n');
    });

    it('works with the default index', function(){
      assert.strictEqual(
        Resolver.formatValue(env.prompt, {n: 1}), 'One File');
    });

  });

  describe('A complex string referencing a missing entity', function(){

    before(function() {
      source = [
        'prompt={[ plural(n) ]}',
        'prompt[one]=One {{ file }}',
        'prompt[other]=Files'
      ].join('\n');
    });

    it('returns the raw string', function(){
      var value = Resolver.formatValue(env.prompt, {n: 1});
      assert.strictEqual(value, 'One {{ file }}');
    });

  });

  describe('A ctxdata variable in the index, with "other"', function(){

    before(function() {
      source = [
        'file=File',
        'prompt={[ plural(n) ]}',
        'prompt[one]=One {{ file }}',
        'prompt[other]=Files'
      ].join('\n');
    });

    it('is found', function(){
      assert.strictEqual(
        Resolver.formatValue(env.prompt, {n: 1}), 'One File');
    });

    it('throws an IndexError if n is not defined', function(){
      var value = Resolver.formatValue(env.prompt);
      assert.strictEqual(value, 'Files');
    });

  });

  describe('A ctxdata variable in the index, without "other"', function(){

    before(function() {
      source = [
        'file=File',
        'prompt={[ plural(n) ]}',
        'prompt[one]=One {{ file }}',
      ].join('\n');
    });

    it('is found', function(){
      assert.strictEqual(
        Resolver.formatValue(env.prompt, {n: 1}), 'One File');
    });

    it('throws an IndexError if n is not defined', function(){
      var value = Resolver.formatValue(env.prompt);
      assert.strictEqual(value, undefined);
    });

  });

});

