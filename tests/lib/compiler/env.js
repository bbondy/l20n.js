'use strict';

var parse = require('../../../lib/l20n/parser').parseProperties;
var compile = process.env.L20N_COV
  ? require('../../../build/cov/lib/l20n/compiler').compile
  : require('../../../lib/l20n/compiler').compile;

describe('Env object', function(){
  var source, env;
  beforeEach(function() {
    source = [
      'foo=Foo',
      'getFoo={{ foo }}',
      'getBar={{ bar }}'
    ].join('\n');
    env = compile(parse(source));
  });

  it('works', function() {
    env.foo.should.equal('Foo');
    env.getFoo.getString().should.equal('Foo');
    env.getBar.getString().should.equal('{{ bar }}');
  });
  it('cannot be modified by another compilation', function() {
    var source2 = [
      'foo=Foo',
      'bar=Bar'
    ].join('\n');
    var env2 = compile(parse(source2));

    env.foo.should.equal('Foo');
    env.getFoo.getString().should.equal('Foo');
    env.getBar.getString().should.equal('{{ bar }}');
  });
});
