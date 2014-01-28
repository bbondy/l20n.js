  'use strict';

  var EventEmitter = require('./events').EventEmitter;
  
  var Parser = require('./parser').Parser;
  var Compiler = require('./compiler').Compiler;
  var io = require('./platform/io.js');

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

  Context.prototype.freeze = function C_freeze(callback) {
    var locale = this.getLocale();
    if (locale.isReady) {
      this.setReady(callback);
    } else {
      locale.build(this.setReady.bind(this, callback));
    }
  };

  Context.prototype.setReady = function C_setReady(callback) {
    this.isReady = true;
    callback();
    this.emitter.emit('ready');
  };

  Context.prototype.setLocale = function C_setLocale(loc) {
    if (loc === 'en-US') {
      this.supportedLocales = ['en-US'];
    } else {
      this.supportedLocales = [loc, 'en-US'];
    }
  };

  Context.prototype.getLocale = function C_getLocale(idx) {
    if (idx === undefined) {
      idx = 0;
    }
    if (idx > this.supportedLocales.length) {
      return null;
    }
    var loc = this.supportedLocales[idx];
    if (this.locales[loc]) {
      return this.locales[loc];
    } else {
      return this.locales[loc] = new Locale(loc, this);
    }
  };

  Context.prototype.ready = function C_ready(cb) {
    if (this.isReady) {
      setTimeout(cb);
    }
    this.emitter.addEventListener('ready', cb);
  };

  Context.prototype.get = function C_get(id, ctxdata) {
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

  Context.prototype.getFromLocale = function C_getFromLocale(cur,
                                                             id,
                                                             ctxdata) {
    var locale = this.getLocale(cur);
    if (!locale) {
      return '[' + id + ']';
    }
    if (!locale.isReady) {
      // build without callback, synchronously
      locale.build(null);
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

  function Locale(id, ctx) {
    this.id = id;
    this.ctx = ctx;
    this.ast = null;
    this.entries = {};
    this.isReady = false;
  }

  Locale.prototype.getEntry = function L_getEntry(id) {
    return this.entries[id];
  };

  Locale.prototype.build = function L_build(callback) {
    var sync = !callback;
    var l10nLoads = this.ctx.resLinks.length;
    var self = this;

    function onL10nLoaded() {
      if (--l10nLoads <= 0) {
        self.isReady = true;
        if (callback) {
          callback();
        }
      }
    }

    if (l10nLoads === 0) {
      onL10nLoaded();
      return;
    }

    function onJSONLoaded(err, json) {
      self.addAST(json);
      onL10nLoaded();
    }

    function onPropLoaded(err, source) {
      self.addPropResource(source);
      onL10nLoaded();
    }


    for (var i = 0; i < this.ctx.resLinks.length; i++) {
      var path = this.ctx.resLinks[i].replace('{{locale}}', this.id);
      var type = path.substr(path.lastIndexOf('.')+1);

      switch (type) {
        case 'json':
          io.loadJSON(path, onJSONLoaded, sync);
          break;
        case 'properties':
          io.load(path, onPropLoaded, sync);
          break;
      }
    }
  };


  Locale.prototype.addAST = function(cb, err, ast) {
    Compiler.compile(ast, this.entries);
  };

  Locale.prototype.addPropResource = function(source) {
    if (!source) {
      return;
    }
    if (!this.ast) {
      this.ast = {};
    }
    var ast = Parser.parse(source);
    for (var i in ast) {
      this.ast[i] = ast[i];
    }
    this.addAST(ast);
  };

  exports.Locale = Locale;
  exports.Context = Context;
