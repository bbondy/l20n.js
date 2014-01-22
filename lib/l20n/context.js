if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(function (require, exports, module) {
  'use strict';

  var EventEmitter = require('./events').EventEmitter;
  
  var Parser = require('./parser').Parser;
  var Compiler = require('./compiler').Compiler;

  function Context() {
    this.curLanguage = 'en-US';
    this.whenComplete = null;
    this.isReady = false;
    this.locales = {};
    this.resLinks = [];
    this.emitter = new EventEmitter();

    Object.defineProperty(this, 'readyState', {
      get: this.getReadyState.bind(this),
      enumerable: true
    });
  }

  Context.prototype.ready = function(cb) {
    if (this.isReady) {
      cb();
    } else {
      if (!this.whenComplete) {
        this.whenComplete = [cb];
      } else {
        this.whenComplete.push(cb);
      }
    }
  };

  Context.prototype.get = function(id, ctxdata) {
    return navigator.mozL10n.getFromLocale(id, ctxdata);
  };

  Context.prototype.addEventListener = function(type, listener) {
    this.emitter.addEventListener(type, listener);
  };

  Context.prototype.removeEventListener = function(type, listener) {
    this.emitter.removeEventListener(type, listener);
  };

  /* private */

  Context.prototype.getLocale = function() {
    return this.locales[this.curLanguage];
  };

  Context.prototype.getReadyState = function() {
    return this.isReady ? 'complete' : 'loading';
  };

  Context.prototype.getFromLocale = function C_getFromLocale(id, ctxdata) {
    var locale = navigator.mozL10n.getLocale();
    if (!locale) {
      return 'Locale is not ready: '+id;
    }
    var entry = locale.getEntry(id);
    if (!entry) {
      return 'missing';
    }
    if (typeof entry === 'string') {
      return entry;
    }
    return entry.getString(ctxdata);
  };


  Context.prototype.fireReady = function() {
    if (this.whenComplete) {
      for (var i = 0; i < this.whenComplete.length; i++) {
        this.whenComplete[i]();
      }
    }
    this.whenComplete = null;
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

    cb();
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
});
