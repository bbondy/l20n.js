'use strict';

var parse = require('../../../lib/l20n/parser').parseProperties;
var compile = process.env.L20N_COV
  ? require('../../../build/cov/lib/l20n/compiler').compile
  : require('../../../lib/l20n/compiler').compile;
var getPluralRule = require('../../../lib/l20n/plurals').getPluralRule;

describe('Primitives:', function(){
  var source, env;
  beforeEach(function() {
    env = compile(parse(source));
    env.__plural = getPluralRule('en-US');
  });

  describe('Simple string value', function(){
    before(function() {
      source = [
        'foo=Foo'
      ].join('\n');
    });
    it('returns the value', function(){
      env.foo.should.equal('Foo');
    });
  });

  describe('Complex string value', function(){
    before(function() {
      source = [
        'foo=Foo',
        'bar={{ foo }} Bar',
        'baz={{ missing }}',
        'qux={{ malformed }'
      ].join('\n');
    });
    it('returns the value', function(){
      var value = env.bar.getString();
      value.should.equal('Foo Bar');
    });
    it('returns the raw string if the referenced entity is not found', function(){
      var value = env.baz.getString();
      value.should.equal('{{ missing }}');
    });
  });
  
  describe('Complex string referencing an entity with null value', function(){
    before(function() {
      source = [
        'foo.attr=Foo',
        'bar={{ foo }} Bar',
      ].join('\n');
    });
    it('returns the null value', function(){
      var entity = env.foo.get();
      entity.should.have.property('value', null);
    });
    it('returns the attribute', function(){
      var entity = env.foo.get();
      entity.attributes['attr'].should.equal('Foo');
    });
    it('returns the raw string when the referenced entity has null value', function(){
      var value = env.bar.getString();
      value.should.equal('{{ foo }} Bar');
    });
  });

  describe('Cyclic reference', function(){
    before(function() {
      source = [
        'foo={{ bar }}',
        'bar={{ foo }}'
      ].join('\n');
    });
    it('returns the raw string', function(){
      var value = env.foo.getString();
      value.should.equal('{{ foo }}');
    });
  });

  describe('Cyclic self-reference', function(){
    before(function() {
      source = [
        'foo={{ foo }}'
      ].join('\n');
    });
    it('returns the raw string', function(){
      var value = env.foo.getString();
      value.should.equal('{{ foo }}');
    });
  });

  describe('Cyclic self-reference in a hash', function(){
    before(function() {
      source = [
        'foo={[ plural(n) ]}',
        'foo[one]={{ foo }}',
        'foo[two]=Bar',
        'bar={{ foo }}'
      ].join('\n');
    });
    it('returns the raw string', function(){
      var value = env.foo.getString({n: 1});
      value.should.equal('{{ foo }}');
    });
    it('returns the valid value if requested directly', function(){
      var value = env.bar.getString({n: 2});
      value.should.equal("Bar");
    });
  });

});
