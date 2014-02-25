  'use strict';

  var EventEmitter = require('./events').EventEmitter;
  var Locale = require('./locale').Locale;

  function Context() {
    this.supportedLocales = ['en-US'];
    this.isFrozen = false;
    this.isReady = false;
    this.isBuildtime = false;
    this.locales = {};
    this.resLinks = [];
    this.emitter = new EventEmitter();
  }

  Context.prototype.requestLocales = function C_requestLocales(loc, callback) {
    if (this.isFrozen && !this.isReady) {
      throw new Error('Context not ready');
    }
    this.isFrozen = true;

    var fallbackChain = ['en-US'];
    if (loc && loc !== 'en-US') {
      fallbackChain.unshift(loc);
    }

    var locale = this.getLocale(fallbackChain[0]);
    if (locale.isReady) {
      this.setReady(fallbackChain, callback);
    } else {
      locale.build(this.setReady.bind(this, fallbackChain, callback));
    }
  };

  Context.prototype.setReady = function C_setReady(fallbackChain, callback) {
    this.isReady = true;
    this.supportedLocales = fallbackChain;
    if (callback) {
      callback();
    }
    this.emitter.emit('ready');
  };

  Context.prototype.getLocale = function C_getLocale(loc) {
    if (loc === undefined) {
      loc = this.supportedLocales[0];
    }
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

  Context.prototype.getEntitySource = function(id) {
    if (!this.isReady) {
      throw new Error('Context not ready');
    }
    var cur = 0;
    var loc;
    var locale;
    while (loc = this.supportedLocales[cur]) {
      locale = this.getLocale(loc);
      if (!locale.isReady) {
        // build without callback, synchronously
        locale.build(null);
      }
      if (locale.ast && locale.ast.hasOwnProperty(id)) {
        return locale.ast[id];
      }
      cur++;
    }
    return '';
  };

  Context.prototype.addEventListener = function(type, listener) {
    this.emitter.addEventListener(type, listener);
  };

  Context.prototype.removeEventListener = function(type, listener) {
    this.emitter.removeEventListener(type, listener);
  };

  Context.prototype.getWithFallback = function C_getWithFallback(id) {
    if (!this.isReady) {
      throw new Error('Context not ready');
    }
    var cur = 0;
    var loc;
    var locale;
    while (loc = this.supportedLocales[cur]) {
      locale = this.getLocale(loc);
      if (!locale.isReady) {
        // build without callback, synchronously
        locale.build(null);
      }
      var entry = locale.getEntry(id);
      if (entry === undefined) {
        cur++;
        continue;
      }
      return entry;
    }
    return null;
  };

  Context.prototype.get = function C_get(id, ctxdata) {
    var entry = this.getWithFallback(id);
    if (entry === null) {
      return '';
    }
    if (typeof entry === 'string') {
      return entry;
    }
    return entry.getString(ctxdata);
  };

  Context.prototype.getEntity = function C_getEntity(id, ctxdata) {
    var entry = this.getWithFallback(id);
    if (entry === null) {
      return {
        value: '',
        attributes: {}
      };
    }
    if (typeof entry === 'string') {
      return {
        value: entry,
        attributes: {}
      };
    }
    return entry.get(ctxdata);
  };

  exports.Context = Context;
