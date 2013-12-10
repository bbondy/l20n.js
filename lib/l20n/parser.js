if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(function (require, exports, module) {
  'use strict';

  var getPluralRule = require('./plurals').getPluralRule;

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

  exports.Parser = {
    parse: parseProperties,
  };

});
