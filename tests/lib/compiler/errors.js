'use strict';

var should = require('should');

var parse = require('../../../lib/l20n/parser').parseProperties;
var compile = process.env.L20N_COV
  ? require('../../../build/cov/lib/l20n/compiler').compile
  : require('../../../lib/l20n/compiler').compile;
var getPluralRule = require('../../../lib/l20n/plurals').getPluralRule;

describe('Compiler errors:', function(){
  var source, env;
  beforeEach(function() {
    env = compile(parse(source));
    env.__plural = getPluralRule('en-US');
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
      env.prompt.getString({n: 1}).should.equal("One File");
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
      var value = env.prompt.getString({n: 1});
      value.should.equal('One {{ file }}');
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
      env.prompt.getString({n: 1}).should.equal("One File");
    });
    it('throws an IndexError if n is not defined', function(){
      var value = env.prompt.getString();
      value.should.equal('Files');
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
      env.prompt.getString({n: 1}).should.equal("One File");
    });
    it('throws an IndexError if n is not defined', function(){
      var value = env.prompt.getString();
      should.equal(value, undefined);
    });
  });

});

