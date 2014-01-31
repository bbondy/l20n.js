  'use strict';

  var Parser = require('./parser').Parser;
  var Compiler = require('./compiler').Compiler;
  var io = require('./platform/io.js');

  function Locale(id, ctx) {
    this.id = id;
    this.ctx = ctx;
    this.ast = {};
    this.entries = {};
    this.isReady = false;
  }

  Locale.prototype.getEntry = function L_getEntry(id) {
    return this.entries[id];
  };

  Locale.prototype.setReady = function L_setReady(callback) {
    this.isReady = true;
    if (this.ctx.isRuntime) {
      this.ast = null;
    }
    if (callback) {
      callback();
    }
  };

  Locale.prototype.build = function L_build(callback) {
    var sync = !callback;
    var l10nLoads = this.ctx.resLinks.length;
    var self = this;

    function onL10nLoaded() {
      if (--l10nLoads <= 0) {
        self.setReady(callback);
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


  Locale.prototype.addAST = function(ast) {
    Compiler.compile(ast, this.entries);
  };

  Locale.prototype.addPropResource = function(source) {
    if (!source) {
      return;
    }
    var ast = Parser.parse(source);
    for (var i in ast) {
      this.ast[i] = ast[i];
    }
    this.addAST(ast);
  };

  exports.Locale = Locale;
