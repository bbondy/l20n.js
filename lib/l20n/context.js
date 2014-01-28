  'use strict';

  var EventEmitter = require('./events').EventEmitter;
  var Locale = require('./locale').Locale;
  
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

  exports.Context = Context;
