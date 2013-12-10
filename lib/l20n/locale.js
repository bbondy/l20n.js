if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(function (require, exports, module) {
  'use strict';

  /* Parser */

  var ppatterns = {
    comment: /^\s*#|^\s*$/,
    entity: /^([^=\s]+)\s*=\s*(.+)$/,
    multiline: /[^\\]\\$/,
    entries: /[\r\n]+/
  };

  function parseProperties(source) {
    var ast = {};

    var entries = source.split(ppatterns['entries']);
    for (var i = 0; i < entries.length; i++) {
      var line = entries[i];

      if (ppatterns['comment'].test(line)) {
        continue;
      }

      while (ppatterns['multiline'].test(line) && i < entries.length) {
        line = line.slice(0, line.length - 1) + entries[++i].trim();
      }

      var entityMatch = line.match(ppatterns['entity']);
      if (entityMatch && entityMatch.length == 3) {
        if (entityMatch[1].indexOf('[') === -1) {
          ast[entityMatch[1]] = entityMatch[2];
        }
      }
    }
    return ast;
  }

  /* IO */

  function loadAsync(url, callback, cb2) {
    var xhr = new XMLHttpRequest();

    if (xhr.overrideMimeType) {
      xhr.overrideMimeType('text/plain');
    }

    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if (xhr.status == 200 || xhr.status == 0) {
          callback(xhr.responseText, cb2);
        } else {
          callback(null, cb2);
          //console.log('load error: '+url);
        }
      }
    };

    xhr.open('GET', url, true);
    xhr.send('');
  }

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
        loadAsync(url.replace('{{locale}}', 'en-US'), this.addJSONResource.bind(this), cb);
        break;
      case 'properties':
        loadAsync(url, this.addPropResource.bind(this), cb);
        break;
    }
  };

  Locale.prototype.loadINI= function(url, cb) {
    var self = this;
    loadAsync(url, function(source) {
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

  Locale.prototype.addJSONResource = function(json, cb) {
    this.entries = JSON.parse(json);
    cb();
  };

  Locale.prototype.addPropResource = function(source, cb) {
    if (!source) {
      cb();
      return;
    }
    var prop = parseProperties(source);
    for (var i in prop) {
      this.entries[i] = prop[i];
    }
    cb();
  };

  exports.Locale = Locale;

});
