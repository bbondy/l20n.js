  'use strict';

  var EventEmitter = require('./events').EventEmitter;
  var Locale = require('./locale').Locale;
  
  function Context() {
    this.supportedLocales = ['en-US'];
    this.isFrozen = false;
    this.isReady = false;
    this.isRuntime = true;
    this.locales = {};
    this.resLinks = [];
    this.emitter = new EventEmitter();

    Object.defineProperty(this, 'readyState', {
      get: this.getReadyState.bind(this),
      enumerable: true
    });
  }

  Context.prototype.freeze = function C_freeze(callback) {
    if (this.isFrozen && !this.isReady) {
      throw new Error('Context not ready');
    }
    this.isFrozen = true;

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
    if (idx >= this.supportedLocales.length) {
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

  Context.prototype.getEntitySource = function(id) {
    var cur = 0;
    var locale;
    while (locale = this.getLocale(cur)) {
      if (!locale.isReady) {
        // build without callback, synchronously
        locale.build(null);
      }
      if (locale.ast && locale.ast[id]) {
        return locale.ast[id];
      }
      cur++;
    }
    return '[' + id + ']';
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

  Context.prototype.get = function C_get(id, ctxdata) {
    var cur = 0;
    var locale;
    while (locale = this.getLocale(cur)) {
      if (!locale.isReady) {
        // build without callback, synchronously
        locale.build(null);
      }
      var entry = locale.getEntry(id);
      if (!entry) {
        cur++;
        continue;
      }
      if (typeof entry === 'string') {
        return entry;
      }
      return entry.getString(ctxdata);
    }
    return '[' + id + ']';
  };

  Context.prototype.getEntity = function C_getEntity(id, ctxdata) {
    var cur = 0;
    var locale;
    while (locale = this.getLocale(cur)) {
      if (!locale.isReady) {
        // build without callback, synchronously
        locale.build(null);
      }
      var entry = locale.getEntry(id);
      if (!entry) {
        cur++;
        continue;
      }
      if (typeof entry === 'string') {
        return {
          value: entry,
          attributes: {}
        };
      }
      return entry.get(ctxdata);
    }
    return {
      value: '[' + id + ']',
      attributes: {}
    };
  };

  exports.Context = Context;
