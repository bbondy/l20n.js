if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(function (require, exports, module) {
  'use strict';

  var MAX_PLACEABLES = 100;
  var nestedProps = ['style', 'dataset'];

  var ppatterns = {
    comment: /^\s*#|^\s*$/,
    entity: /^([^=\s]+)\s*=\s*(.+)$/,
    multiline: /[^\\]\\$/,
    macro: /\{\[\s*(\w+)\(([^\)]*)\)\s*\]\}/i,
    entries: /[\r\n]+/,
    placeable: /\{\{\s*(.+?)\s*\}\}/g,
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
        parseEntity(entityMatch, ast);
      }
    }
    return ast;
  }

  function parseEntity(match, ast) {
    var name, key, attr, pos;
    var value = match[2];

    pos = match[1].indexOf('[');
    if (pos !== -1) {
      name = match[1].substr(0, pos);
      key = match[1].substring(pos + 1, match[1].length - 1);
    } else {
      name = match[1];
      key = null;
    }

    var nameElements = name.split('.');

    if (nameElements.length > 1) {
      var attrElements = [];
      attrElements.push(nameElements.pop());
      if (nameElements.length > 1) {
        // special quirk to comply with webl10n's behavior
        if (nestedProps.indexOf(
              nameElements[nameElements.length - 1]) !== -1) {
                attrElements.push(nameElements.pop());
              }
      } else if (attrElements[0] === 'ariaLabel') {
        // special quirk to comply with webl10n's behavior
        attrElements[0] = 'aria-label';
      }
      name = nameElements.join('.');
      attr = attrElements.reverse().join('.');
    } else {
      attr = null;
    }

    setEntityValue(name, attr, key, value, ast);
  }

  function setEntityValue(id, attr, key, value, ast) {
    var obj = ast;
    var id2 = id;
    if (attr) {
      if (!obj[id]) {
        obj[id] = {};
      }
      obj = obj[id];
      id2 = attr;
    }
    if (!key) {
      obj[id2] = value;
      return;
    } else {
      if (!obj[id2]) {
        obj[id2] = {'_': {}};
        obj[id2]['_'][key] = value;
      } else {
        if (typeof(obj[id2]) === 'string') {
          var index = obj[id2];
          obj[id2] = {'_index': parseMacro(obj[id2]), '_': {}};
          obj[id2]['_'][key] = value;
        } else {
          obj[id2]['_'][key] = value;
        }
      }
    }
    return;
  }

  function parseMacro(str) {
    var match = str.match(ppatterns['macro']);
    if (!match) {
      throw new Error("Expected macro call");
    }
    return [match[1], match[2]];
  }

  /* Example of subPlaceable */
  var placeables = {
    'brandName': 'Firefox',
  };
  function subPlaceable2(match, p1, offset, string) {
    if (placeables.hasOwnProperty(p1)) {
      return placeables[p1];
    }
    return match;
  }

  function parseString(str, subPlaceable) {
    if (!subPlaceable) {
      subPlaceable = subPlaceable2;
    }
    return str.replace(ppatterns.placeable, subPlaceable);
  }


  exports.Parser = {
    parse: parseProperties,
    parseString: parseString,
  };

});
