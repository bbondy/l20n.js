if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(function (require, exports, module) {
  'use strict';

  var Locale = require('./locale').Locale;

  function Context() {
    this.curLanguage = 'en-US';
    this.whenComplete = [];
    this.isReady = false;
    this.locales = {};
    this.resources = [];

    Object.defineProperty(this, 'readyState', {
      get: this.getReadyState.bind(this),
      enumerable: true
    });
  }

  Context.prototype.ready = function(cb) {
    if (this.isReady) {
      cb();
    } else {
      this.whenComplete.push(cb);
    }
  };

  Context.prototype.get = function(id) {
    return navigator.mozL10n.getFromLocale(id);
  };

  /* private */

  Context.prototype.getLocale = function() {
    return this.locales[this.curLanguage];
  };

  Context.prototype.getReadyState = function() {
    return this.isReady ? 'complete' : 'loading';
  };

  Context.prototype.getFromLocale = function C_getFromLocale(id) {
    var locale = navigator.mozL10n.getLocale();
    if (!locale) {
      return 'Locale is not ready: '+id;
    }
    var entry = locale.getEntry(id);

    return entry;
  };


  Context.prototype.fireReady = function() {
    for (var i = 0; i < this.whenComplete.length; i++) {
      this.whenComplete[i]();
    }
    this.whenComplete = [];
  };

  exports.Context = Context;
});
