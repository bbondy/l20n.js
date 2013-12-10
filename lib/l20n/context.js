if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(function (require, exports, module) {
  'use strict';

  var EventEmitter = require('./events').EventEmitter;
  var io = require('./platform/io');
  var Parser = require('./parser').Parser;

  function Context() {
    this.curLanguage = 'en-US';
    this.whenComplete = [];
    this.isReady = false;
    this.locales = {};
    this.resources = [];
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
      this.whenComplete.push(cb);
    }
  };

  Context.prototype.get = function(id) {
    return navigator.mozL10n.getFromLocale(id);
  };

  Context.prototype.addEventListener = function(type, listener) {
    this.emitter.addEventListener(type, listener);
  }

  Context.prototype.removeEventListener = function(type, listener) {
    this.emitter.removeEventListener(type, listener);
  }

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

  function relativePath(baseUrl, url) {
    if (url[0] == '/') {
      return url;
    }

    var dirs = baseUrl.split('/')
      .slice(0, -1)
      .concat(url.split('/'))
      .filter(function(path) {
        return path !== '.';
      });

    return dirs.join('/');
  }

  var iniPatterns = {
    section: /^\s*\[(.*)\]\s*$/,
    import: /^\s*@import\s+url\((.*)\)\s*$/i,
    entry: /[\r\n]+/
  };

  function parseINI(source, iniPath) {
    var entries = source.split(iniPatterns['entry']);
    var locales = ['en-US'];
    var genericSection = true;
    var uris = [];

    for (var i = 0; i < entries.length; i++) {
      var line = entries[i];
      // we only care about en-US resources
      if (genericSection && iniPatterns['import'].test(line)) {
        var match = iniPatterns['import'].exec(line);
        var uri = relativePath(iniPath, match[1]);
        uris.push(uri);
        continue;
      }

      // but we need the list of all locales in the ini, too
      if (iniPatterns['section'].test(line)) {
        genericSection = false;
        var match = iniPatterns['section'].exec(line);
        locales.push(match[1]);
      }
    }
    return {
      locales: locales,
      resources: uris
    };
  }

  function Locale() {
    this.entries = {};
    this.isReady = false;
  }

  Locale.prototype.getEntry = function L_getEntry(id) {
    return this.entries[id];
  };

  Locale.prototype.loadResource = function(url, cb, type) {
    if (!type) {
      type = url.substr(url.lastIndexOf('.')+1);
    }
    switch (type) {
      case 'ini':
        this.loadINI(url, cb);
        break;
      case 'json':
        io.load(url.replace('{{locale}}', 'en-US'), this.addJSONResource.bind(this, cb));
        break;
      case 'properties':
        io.load(url, this.addPropResource.bind(this, cb));
        break;
    }
  };

  Locale.prototype.loadINI= function(url, cb) {
    var self = this;
    io.load(url, function(err, source) {
      if (!source) {
        cb();
        return;
      }
      var ini = parseINI(source, url);
      for (var i = 0; i < ini.resources.length; i++) {
        self.loadResource(ini.resources[i], cb, 'properties');
      }
    });
  };

  Locale.prototype.addJSONResource = function(cb, err, json) {
    this.entries = JSON.parse(json);
    cb();
  };

  Locale.prototype.addPropResource = function(cb, err, source) {
    if (!source) {
      cb();
      return;
    }
    var prop = Parser.parse(source);
    for (var i in prop) {
      this.entries[i] = prop[i];
    }
    cb();
  };

  exports.Locale = Locale;
  exports.Context = Context;
});
