if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(function (require, exports, module) {
  'use strict';

  var EventEmitter = require('./events').EventEmitter;
  var Parser = require('./parser').Parser;
  var Compiler = require('./compiler').Compiler;
  var io = require('./platform/io');
  var getPluralRule = require('./plurals').getPluralRule;

  function Resource(id, parser) {
    this.id = id;
    this.parser = parser;

    this.resources = [];
    this.source = null;
    this.ast = null;
  }

  Resource.prototype.build = function R_build(callback, sync) {
    if (this.source) {
      this.parse(callback);
    } else if (this.ast) {
      callback();
    } else {
      io.load(this.id, this.parse.bind(this, callback), sync);
    }
  };

  Resource.prototype.parse = function R_parse(callback, err, text) {
    if (err) {
      this.ast = {
        type: 'WebL10n',
        body: {}
      };
      return callback(err);
    } else if (text === undefined) {
      this.ast = this.parser.parse(this.source);
    } else {
      if (/\.json/.test(this.id)) {
        // JSON is guaranteed to be an AST
        this.ast = JSON.parse(text);
      } else {
        this.source = text;
        this.ast = this.parser.parse(this.source);
      }
    }
    callback();
  };

  function Locale(id, ctx) {
    this.id = id;
    this.ctx = ctx;

    this.resources = [];
    this.entries = null;
    this.ast = {
      type: 'WebL10n',
      body: {}
    };
    this.isReady = false;
  }

  Locale.prototype.build = function L_build(callback) {
    if (!callback) {
      var sync = true;
    }

    var resourcesToBuild = this.resources.length;
    if (resourcesToBuild === 0) {
      throw new ContextError('Locale has no resources');
    }

    var self = this;
    var resourcesWithErrors = 0;
    this.resources.forEach(function(res) {
      res.build(resourceBuilt, sync);
    });

    function resourceBuilt(err) {
      if (err) {
        resourcesWithErrors++;
        var eventType = err instanceof ContextError ? 'error' : 'warning';
        self.ctx._emitter.emit(eventType, err);
      }
      resourcesToBuild--;
      if (resourcesToBuild === 0) {
        if (resourcesWithErrors == self.resources.length) {
          // XXX Bug 908780 - Decide what to do when all resources in
          // a locale are missing or broken
          // https://bugzilla.mozilla.org/show_bug.cgi?id=908780
          self.ctx._emitter.emit('error',
            new ContextError('Locale has no valid resources'));
        }
        self.flatten.call(self, callback);
      }
    }
  };

  Locale.prototype.flatten = function L_flatten(callback) {
    this.ast.body = this.resources.reduce(function(prev, curr) {
      if (!curr.ast) {
        return prev;
      }
      for (var key in curr.ast.body) {
        if (curr.ast.body.hasOwnProperty(key)) {
          prev[key] = curr.ast.body[key];
        }
      }
      return prev;
    }, this.ast.body);

    this.entries = this.ctx._compiler.compile(this.ast);
    this.isReady = true;
    if (callback) {
      callback();
    }
  };

  Locale.prototype.clean = function L_clean() {
    this.ast = null;
    this.resources = null;
    this.ctx = null;
  };

  Locale.prototype.getEntry = function L_getEntry(id) {
    if (this.entries.hasOwnProperty(id)) {
      return this.entries[id];
    }
    return undefined;
  };

  Locale.prototype.hasResource = function L_gasResource(uri) {
    return this.resources.some(function(res) {
      return res.id === uri;
    });
  };

  function Context(id) {

    this.id = id;

    Object.defineProperty(this, 'supportedLocales', {
      get: function() { return this._fallbackChain.slice(); },
      enumerable: true
    });

    // registered and available languages
    this._default = 'i-default';
    this._registered = [this._default];
    this._requested = [];
    this._fallbackChain = [];
    // Locale objects corresponding to the registered languages
    this._locales = {};

    // URLs or text of resources (with information about the type) added via
    // linkResource
    this._reslinks = [];

    this._isReady = false;
    this._isFrozen = false;

    Object.defineProperty(this, 'isReady', {
      get: function() { return this._isReady; },
      enumerable: true
    });

    this._emitter = new EventEmitter();
    this._parser = new Parser();
    this._compiler = new Compiler();

    this._parser.addEventListener('error', this._error.bind(this));
    this._compiler.addEventListener('error', this._warn.bind(this));

  } 

  Context.prototype.get = function C_get(id, data) {
    if (!this._isReady) {
      throw new ContextError('Context not ready');
    }
    return this._getFromLocale(0, id, data).value;
  };

  Context.prototype.getEntity = function C_getEntity(id, data) {
    if (!this._isReady) {
      throw new ContextError('Context not ready');
    }
    return this._getFromLocale(0, id, data);
  };

  Context.prototype.getSource = function getSource(id) {
    if (!this._isReady) {
      throw new ContextError('Context not ready');
    }

    var current = 0;
    var locale = this._getLocale(this._fallbackChain[current]);
    // if the requested id doesn't exist in the first locale, fall back
    while (!locale.getEntry(id)) {
      this._warn(new TranslationError('Not found', id, this._fallbackChain, 
                                      locale));
      var nextLocale = this._fallbackChain[++current];
      if (!nextLocale) {
        return null;
      }

      locale = this._getLocale(nextLocale);
      if (!locale.isReady) {
        locale.build();
      }
    }
    return locale.ast.body[id];
  };

  Context.prototype.getSources = function getSources() {
    if (!this._isReady) {
      throw new ContextError('Context not ready');
    }
    var defLoc = this._getLocale(this._default);
    if (!defLoc.isReady) {
      defLoc.build();
    }
    var body = {};
    for (var id in defLoc.entries) {
      if (!defLoc.entries.hasOwnProperty(id)) {
        continue;
      }
      // if it's an Entity, add it
      if (defLoc.entries[id].get) {
        var source = this.getSource(id);
        if (source) {
          body[id] = source;
        }
      }
    }
    return body;
  };

  Context.prototype.ready = function ready(callback) {
    if (this._isReady) {
      setTimeout(callback);
    }
    this.addEventListener('ready', callback);
  };

  Context.prototype.once = function once(callback) {
    if (this._isReady) {
      setTimeout(callback);
    }
    var callAndRemove = function callAndRemove() {
      this.removeEventListener('ready', callAndRemove);
      callback();
    };
    this.addEventListener('ready', callAndRemove);
  };

  Context.prototype._getFromLocale = function C_getFromLocale(cur,
                                                              id,
                                                              data,
                                                              prevSource) {
    var loc = this._fallbackChain[cur];
    if (!loc) {
      this._error(new RuntimeError('Unable to get translation', id, 
                                   this._fallbackChain));
      // imitate the return value of Compiler.Entity.get
      return {
        value: prevSource ? prevSource.source : id,
        attributes: {},
        globals: {},
        locale: prevSource ? prevSource.loc : null
      };
    }

    var locale = this._getLocale(loc);
    if (!locale.isReady) {
      // build without a callback, synchronously
      locale.build(null);
    }

    var entry = locale.getEntry(id);

    // if the entry is missing, just go to the next locale immediately
    if (entry === undefined) {
      this._warn(new TranslationError('Not found', id, this._fallbackChain,
                                      locale));
      return this._getFromLocale.call(this, cur + 1, id, data, prevSource);
    }

    if (typeof entry === 'string') {
      return {
        value: entry,
        attributes: {},
        globals: {},
        locale: locale.id
      };
    }

    // otherwise, try to get the value of the entry
    try {
      var value = entry.get(data);
    } catch (e) {
      if (e instanceof Compiler.RuntimeError) {
        this._error(new TranslationError(e.message, id, this._fallbackChain,
                                         locale));
        if (e instanceof Compiler.ValueError) {
          // salvage the source string which the compiler wasn't able to
          // evaluate completely;  this is still better than returning the
          // identifer;  prefer a source string from locales earlier in the
          // fallback chain, if available
          var source = prevSource || { source: e.source, loc: locale.id };
          return this._getFromLocale.call(this, cur + 1, id, data, source);
        }
        return this._getFromLocale.call(this, cur + 1, id, data, prevSource);
      } else {
        throw this._error(e);
      }
    }
    value.locale = locale.id;
    return value;
  };

  Context.prototype._add = function C_add(text, locale) {
    var res = new Resource(null, this._parser);
    res.source = text;
    locale.resources.push(res);
  };

  Context.prototype.addResource = function addResource(text) {
    if (this._isFrozen) {
      throw new ContextError('Context is frozen');
    }
    this._reslinks.push(['text', text]);
  };

  Context.prototype.addDictionary = function addDictionary(scriptNode, loc) {
    if (this._isFrozen) {
      throw new ContextError('Context is frozen');
    }
    this._reslinks.push(['dict', scriptNode, loc]);
  };

  Context.prototype._addJSON = function addJSON(scriptNode, locale) {
    var res = new Resource(null);
    res.ast = JSON.parse(scriptNode.innerHTML);
    locale.resources.push(res);
  };

  Context.prototype.linkResource = function linkResource(uri) {
    if (this._isFrozen) {
      throw new ContextError('Context is frozen');
    }
    this._reslinks.push([typeof uri === 'function' ? 'template' : 'uri', uri]);
  };

  Context.prototype._link = function link(uri, locale) {
    if (!locale.hasResource(uri)) {
      var res = new Resource(uri, this._parser);
      locale.resources.push(res);
    }
  };

  Context.prototype.registerLocales = function registerLocales(
                                                 defaultLocale, 
                                                 availableLocales) {
    if (this._isFrozen) {
      throw new ContextError('Context is frozen');
    }

    if (defaultLocale === undefined) {
      return;
    }

    this._default = defaultLocale;
    this._registered = [];

    if (!availableLocales) {
      availableLocales = [];
    }
    availableLocales.push(defaultLocale);

    // uniquify `available` into `_registered`
    availableLocales.forEach(function l10n_ctx_addlocale(locale) {
      if (typeof locale !== 'string') {
        throw new ContextError('Language codes must be strings');
      }
      if (this._registered.indexOf(locale) === -1) {
        this._registered.push(locale);
      }
    }, this);
  };

  Context.prototype._negotiate = function C_negotiate(available,
                                                     requested,
                                                     defaultLocale) {
    if (available.indexOf(requested[0]) === -1 ||
        requested[0] === defaultLocale) {
      return [defaultLocale];
    } else {
      return [requested[0], defaultLocale];
    }
  };

  Context.prototype.cleanBuiltLocales = function C_cleanBuiltLocales() {
    for (var loc in this._locales) {
      if (this._locales.hasOwnProperty(loc) && this._locales[loc].isReady) {
        this._locales[loc].clean();
      }
    }
  };

  Context.prototype._getLocale = function C_getLocale(code) {
    if (this._locales[code]) {
      return this._locales[code];
    }

    var locale = new Locale(code, this);
    this._locales[code] = locale;
    // populate the locale with resources
    for (var j = 0; j < this._reslinks.length; j++) {
      var res = this._reslinks[j];
      if (res[0] === 'text') {
        // a resource added via addResource(String)
        this._add(res[1], locale);
      } else if (res[0] === 'dict') {
        // a JSON resource added via addDictionary(HTMLScriptElement)
        // only add if no locale was specified or if the locale specified
        // matches the locale being created here
        if (res[2] === undefined || res[2] === locale.id) {
          this._addJSON(res[1], locale);
        }
      } else if (res[0] === 'uri') {
        // a resource added via linkResource(String)
        this._link(res[1], locale);
      } else {
        // a resource added via linkResource(Function);  the function
        // passed is a URL template and it takes the current locale's code
        // as an argument
        this._link(res[1](locale.id), locale);
      }
    }
    locale.ast.body['plural'] = {
      type: 'Macro',
      args: [{
        type: 'Identifier',
        name: 'n'
      }],
      expression: getPluralRule(code)
    };
    return locale;
  };

  Context.prototype.requestLocales = function C_requestLocales() {
    if (this._isFrozen && !this._isReady) {
      throw new ContextError('Context not ready');
    }

    if (this._reslinks.length == 0) {
      this._warn(new ContextError('Context has no resources; not freezing'));
      return;
    }

    this._isFrozen = true;
    this._requested = Array.prototype.slice.call(arguments);

    if (this._requested.length) {
      this._requested.forEach(function l10n_throwError(locale) {
        if (typeof locale !== 'string') {
          throw new ContextError('Language codes must be strings');
        }
      });
    }

    var fallbackChain = this._negotiate(this._registered, this._requested,
                                        this._default);
    // if the negotiator returned something, freeze synchronously
    if (fallbackChain) {
      this._freeze(fallbackChain);
    }
  };

  Context.prototype._freeze = function C_freeze(fallbackChain) {
    this._fallbackChain = fallbackChain;
    var locale = this._getLocale(this._fallbackChain[0]);
    if (locale.isReady) {
      this._setReady();
    } else {
      locale.build(this._setReady.bind(this));
    }
  };

  Context.prototype._setReady = function C_setReady() {
    this._isReady = true;
    this._emitter.emit('ready');
  };

  Context.prototype.addEventListener = function C_addEventListener(type,
                                                                   listener) {
    this._emitter.addEventListener(type, listener);
  };

  Context.prototype.removeEventListener = function C_removeEventListener(
                                                     type, 
                                                     listener) {
    this._emitter.removeEventListener(type, listener);
  };

  Context.prototype._warn = function C_warn(e) {
    this._emitter.emit('warning', e);
    return e;
  };

  Context.prototype._error = function C_error(e) {
    this._emitter.emit('error', e);
    return e;
  };

  Context.Error = ContextError;
  Context.RuntimeError = RuntimeError;
  Context.TranslationError = TranslationError;

  function ContextError(message) {
    this.name = 'ContextError';
    this.message = message;
  }
  ContextError.prototype = Object.create(Error.prototype);
  ContextError.prototype.constructor = ContextError;

  function RuntimeError(message, id, supported) {
    ContextError.call(this, message);
    this.name = 'RuntimeError';
    this.entity = id;
    this.supportedLocales = supported.slice();
    this.message = id + ': ' + message + '; tried ' + supported.join(', ');
  }
  RuntimeError.prototype = Object.create(ContextError.prototype);
  RuntimeError.prototype.constructor = RuntimeError;

  function TranslationError(message, id, supported, locale) {
    RuntimeError.call(this, message, id, supported);
    this.name = 'TranslationError';
    this.locale = locale.id;
    this.message = '[' + this.locale + '] ' + id + ': ' + message;
  }
  TranslationError.prototype = Object.create(RuntimeError.prototype);
  TranslationError.prototype.constructor = TranslationError;

  exports.Context = Context;
  exports.Locale = Locale;
  exports.Resource = Resource;

});
