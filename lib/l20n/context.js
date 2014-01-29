  'use strict';

  var EventEmitter = require('./events').EventEmitter;
  
  var Parser = require('./parser').Parser;
  var Compiler = require('./compiler').Compiler;

  function Context() {
    this.supportedLocales = ['en-US'];
    this.isReady = false;
    this.locales = {};
    this.resLinks = [];
    this.emitter = new EventEmitter();

    Object.defineProperty(this, 'readyState', {
      get: this.getReadyState.bind(this),
      enumerable: true
    });

    Object.defineProperty(this, 'currentLocale', {
      get: function() {
        return this.supportedLocales[0];
      },
      set: function(loc) {
        this.setLocale(loc);
      },
      enumerable: true
    });
  }

  Context.prototype.setLocale = function(loc) {
    if (loc === 'en-US') {
      this.supportedLocales = ['en-US'];
    } else {
      this.supportedLocales = [loc, 'en-US'];
    }
  };

  Context.prototype.getLocale = function(idx) {
    return this.locales[this.supportedLocales[idx || 0]];
  };

  Context.prototype.ready = function(cb) {
    if (this.isReady) {
      setTimeout(cb);
    }
    this.emitter.addEventListener('ready', cb);
  };

  Context.prototype.get = function(id, ctxdata) {
    return this.getFromLocale(0, id, ctxdata);
  };

  Context.prototype.getEntitySource = function(id) {
    var locale = this.getLocale();
    if (!locale) {
      return 'Locale is not ready: '+id;
    }
    return locale.ast[id];
  };

  Context.prototype.addEventListener = function(type, listener) {
    this.emitter.addEventListener(type, listener);
  };

  Context.prototype.removeEventListener = function(type, listener) {
    this.emitter.removeEventListener(type, listener);
  };

  /* private */

  Context.prototype.getReadyState = function() {
    return this.isReady ? 'complete' : 'loading';
  };

  Context.prototype.getFromLocale = function C_getFromLocale(cur, id, ctxdata) {
    var locale = this.getLocale(cur);
    if (!locale) {
      return '[' + id + ']';
    }
    var entry = locale.getEntry(id);
    if (!entry) {
      return this.getFromLocale(cur + 1, id, ctxdata);
    }
    if (typeof entry === 'string') {
      return entry;
    }
    return entry.getString(ctxdata);
  };


  Context.prototype.fireReady = function() {
    this.emitter.emit('ready');
  };

  function Locale() {
    this.ast = null;
    this.entries = null;
    this.isReady = false;
  }

  Locale.prototype.getEntry = function L_getEntry(id) {
    if (!this.entries) {
      return null;
    }
    return this.entries[id];
  };

  Locale.prototype.addAST = function(cb, err, ast) {
    if (!this.entries) {
      this.entries = {};
    }

    Compiler.compile(ast, this.entries);

    if (cb) {
      cb();
    }
  };

  Locale.prototype.addJSONResource = function(cb, err, json) {
    this.addAST(cb, err, json);
  };

  Locale.prototype.addPropResource = function(cb, err, source) {
    if (!source) {
      cb();
      return;
    }
    if (!this.ast) {
      this.ast = {};
    }
    var ast = Parser.parse(source);
    for (var i in ast) {
      this.ast[i] = ast[i];
    }
    this.addAST(cb, err, ast);
  };

  exports.Locale = Locale;
  exports.Context = Context;
