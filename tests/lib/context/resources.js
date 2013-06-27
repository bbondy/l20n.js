var Context = process.env.L20N_COV
  ? require('../../../build/cov/lib/l20n/context').Context
  : require('../../../lib/l20n/context').Context;

function whenReady(ctx, callback) {
  ctx.addEventListener('ready', function onReady() {
    ctx.removeEventListener('ready', onReady);
    callback();
  });
}

describe('A context without any resources', function() {
  var ctx = new Context();
  it('should throw on freeze', function() {
    ctx.freeze.should.throw(/Context has no resources/);
  })
});

describe('addResource without registerLocales', function() {
  var ctx = new Context();
  ctx.addResource('<foo "Foo">');
  ctx.addResource('<bar "Bar">');

  before(function(done) {
    whenReady(ctx, done);
    ctx.freeze();
  });

  it('should add to __none__', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo');
    val.should.have.property('locale', null);
  })
  it('should add to __none__', function() {
    var val = ctx.getEntity('bar');
    val.value.should.equal('Bar');
    val.should.have.property('locale', null);
  })
  it('should change locale without an error', function(done) {
    whenReady(ctx, done);
    ctx.registerLocales('pl');
  })
  it('should add to pl', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo');
    val.should.have.property('locale', 'pl')
  })
  it('should change back to __none__ without an error', function(done) {
    whenReady(ctx, done);
    ctx.registerLocales();
  })
  it('should add to __none__', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo');
    val.should.have.property('locale', null);
  })
  it('should change back to __none__ without an error', function(done) {
    whenReady(ctx, done);
    ctx.registerLocales(null);
  })
  it('should add to __none__', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo');
    val.should.have.property('locale', null);
  })
});

describe('addResource with registerLocales', function() {
  var ctx = new Context();
  ctx.addResource('<foo "Foo">');

  before(function(done) {
    whenReady(ctx, done);
    ctx.registerLocales('pl');
    ctx.freeze();
  });

  it('should add to pl', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo');
    val.should.have.property('locale', 'pl')
  })
  it('should change locale without an error', function(done) {
    whenReady(ctx, done);
    ctx.registerLocales('en-US');
  })
  it('should add to en-US', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo');
    val.should.have.property('locale', 'en-US')
  })
});

describe('linkResource(String) without registerLocales', function() {
  var ctx = new Context();
  ctx.linkResource(__dirname + '/fixtures/none.lol');

  before(function(done) {
    whenReady(ctx, done);
    ctx.freeze();
  });

  it('should add to __none__', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo');
    val.should.have.property('locale', null);
  })
  it('should change locale without an error', function(done) {
    whenReady(ctx, done);
    ctx.registerLocales('pl');
  })
  it('should add to pl', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo');
    val.should.have.property('locale', 'pl')
  })
});

describe('linkResource(String) with registerLocales', function() {
  var ctx = new Context();
  ctx.linkResource(__dirname + '/fixtures/none.lol');

  before(function(done) {
    whenReady(ctx, done);
    ctx.registerLocales('pl');
    ctx.freeze();
  });

  it('should add to pl', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo');
    val.should.have.property('locale', 'pl')
  })
  it('should change locale without an error', function(done) {
    whenReady(ctx, done);
    ctx.registerLocales('en-US');
  })
  it('should add to en-US', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo');
    val.should.have.property('locale', 'en-US')
  })
});

describe('linkResource(Function) without registerLocales', function() {
  var ctx = new Context();
  ctx.linkResource(function(locale) {
    return __dirname + '/fixtures/' + locale + '.lol';
  });

  it('should throw on freeze', function(done) {
    ctx.addEventListener('error', function(err) {
      if (err instanceof Context.Error &&
          err.message == 'No registered locales') {
        done();
      }
    })
    ctx.freeze();
  })

});

describe('linkResource(Function) with registerLocales', function() {
  var ctx = new Context();
  ctx.linkResource(function(locale) {
    return __dirname + '/fixtures/' + locale + '.lol';
  });

  before(function(done) {
    whenReady(ctx, done);
    ctx.registerLocales('pl');
    ctx.freeze();
  });

  it('should add to pl', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo pl');
    val.should.have.property('locale', 'pl')
  })
  it('should change locale without an error', function(done) {
    whenReady(ctx, done);
    ctx.registerLocales('en-US');
  })
  it('should add to en-US', function() {
    var val = ctx.getEntity('foo');
    val.value.should.equal('Foo en-US');
    val.should.have.property('locale', 'en-US')
  })
  it('should throw if changing locale to __none__', function() {
    ctx.addEventListener('error', function(err) {
      if (err instanceof Context.Error &&
          err.message == 'No registered locales') {
        done();
      }
    })
    ctx.registerLocales();
  })
});

describe('registerLocales errors', function() {
  var ctx;
  beforeEach(function() {
    ctx = new Context();
  });

  it('should not throw if the lang code is a string', function() {
    (function() {
      ctx.registerLocales('en-US');
    }).should.not.throw();
    (function() {
      ctx.registerLocales('en-US', 'pl');
    }).should.not.throw();
  })
  it('should not throw if the only argument is null', function() {
    (function() {
      ctx.registerLocales(null);
    }).should.not.throw();
  })
  it('should not throw if there are no arguments', function() {
    (function() {
      ctx.registerLocales();
    }).should.not.throw();
  })
  it('should throw otherwise', function() {
    (function() {
      ctx.registerLocales(7);
    }).should.throw(/Language codes must be strings/);
    (function() {
      ctx.registerLocales('pl', 7);
    }).should.throw(/Language codes must be strings/);
    (function() {
      ctx.registerLocales(undefined);
    }).should.throw(/Language codes must be strings/);
    (function() {
      ctx.registerLocales(true);
    }).should.throw(/Language codes must be strings/);
    (function() {
      ctx.registerLocales(false);
    }).should.throw(/Language codes must be strings/);
    (function() {
      ctx.registerLocales('pl', undefined);
    }).should.throw(/Language codes must be strings/);
    (function() {
      ctx.registerLocales(null, 'pl');
    }).should.throw(/Language codes must be strings/);
    (function() {
      ctx.registerLocales('pl', null);
    }).should.throw(/Language codes must be strings/);
  })
});
