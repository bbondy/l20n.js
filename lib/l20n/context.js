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
      return;
    }
    this.emitter.addEventListener('ready', cb);
  };

  Context.prototype.getEntitySource = function(id) {
    if (!this.isReady) {
      throw new Error('Context not ready');
    }
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
