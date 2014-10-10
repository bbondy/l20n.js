'use strict';

var L10nError = require('../../errors').L10nError;

var unescape = require('querystring').unescape;

function PropertiesParser() {
  var parsePatterns = {
    comment: /^\s*#|^\s*$/,
    entity: /^([^=\s]+)\s*=\s*(.+)$/,
    multiline: /[^\\]\\$/,
    index: /\{\[\s*(\w+)(?:\(([^\)]*)\))?\s*\]\}/i,
    unicode: /\\u([0-9a-fA-F]{1,4})/g,
    entries: /[\r\n]+/,
    controlChars: /\\([\\\n\r\t\b\f\{\}\"\'])/g
  };

  this.parse = function (ctx, source) {
    var ast = [];

    var entries = source.split(parsePatterns.entries);
    for (var i = 0; i < entries.length; i++) {
      var line = entries[i];

      if (parsePatterns.comment.test(line)) {
        continue;
      }

      while (parsePatterns.multiline.test(line) && i < entries.length) {
        line = line.slice(0, -1) + entries[++i].trim();
      }

      var entityMatch = line.match(parsePatterns.entity);
      if (entityMatch) {
        parseEntity(entityMatch[1], entityMatch[2], ast);
      }
    }
    return ast;
  };

  function findInAst(ast, key) {
    for (var i in ast) {
      if (ast[i]['$i'] === key) {
        return i;
      }
    }
    return -1;
  }

  function setEntityValue(id, attr, key, value, ast) {
    var pos;

    if (value.indexOf('{{') !== -1) {
      value = parseString(value);
    }

    if (attr) {
      pos = findInAst(ast, id);
      if (pos === -1) {
        var v = {'$i': id};
        if (key) {
          v[attr] = {};
          v[attr][key] = value;
        } else {
          v[attr] = value;
        }
        ast.push(v);
        return;
      }
      if (key) {
        if (typeof(ast[pos][attr]) === 'string') {
          ast[pos][attr] = {
            '$x': parseIndex(ast[pos][attr]),
            '$v': {}
          }
        }
        ast[pos][attr]['$v'][key] = value;
        return;
      }
      ast[pos][attr] = value;
      return;
    }

    // Hash value
    if (key) {
      pos = findInAst(ast, id);
      if (pos === -1) {
        var v = {};
        v[key] = value;
        ast.push({'$i': id, '$v': v});
        return;
      }
      if (typeof(ast[pos]['$v']) === 'string') {
        ast[pos]['$x'] = parseIndex(ast[pos]['$v']);
        ast[pos]['$v'] = {};
      }
      ast[pos]['$v'][key] = value;
      return;
    }

    // simple value
    ast.push({'$i': id, '$v': value});
  }

  function parseString(str) {
    var chunks = str.split(/{{\s*([^\s]*)\s*}}/);
    var complexStr = [];

    for (var i = 0; i < chunks.length; i++) {
      if (chunks[i].length === 0) {
        continue;
      }
      if (i % 2 === 1) {
        complexStr.push({'t': 'idOrVar', 'v': chunks[i]});
      } else {
        complexStr.push(chunks[i]);
      }
    }
    return complexStr;
  }

  function parseEntity(id, value, ast) {
    var name, key;

    var pos = id.indexOf('[');
    if (pos !== -1) {
      name = id.substr(0, pos);
      key = id.substring(pos + 1, id.length - 1);
    } else {
      name = id;
      key = null;
    }

    var nameElements = name.split('.');

    if (nameElements.length > 2) {
      throw new Error('Error in ID: "' + name + '".' +
          ' Nested attributes are not supported.');
    }

    var attr;
    if (nameElements.length > 1) {
      name = nameElements[0];
      attr = nameElements[1];
    } else {
      attr = null;
    }

    setEntityValue(name, attr, key, unescapeString(value), ast);
  }

  function unescapeControlCharacters(str) {
    return str.replace(parsePatterns.controlChars, '$1');
  }

  function unescapeUnicode(str) {
    return str.replace(parsePatterns.unicode, function(match, token) {
      return unescape('%u' + '0000'.slice(token.length) + token);
    });
  }

  function unescapeString(str) {
    if (str.lastIndexOf('\\') !== -1) {
      str = unescapeControlCharacters(str);
    }
    return unescapeUnicode(str);
  }

  function parseIndex(str) {
    var match = str.match(parsePatterns.index);
    if (!match) {
      throw new L10nError('Malformed macro');
    }
    if (match[2]) {
      return [{'t': 'idOrVar', 'v': match[1]}];
    } else {
      return [{'t': 'idOrVar', 'v': match[1]}, match[2]];
    }
  }
}

exports.PropertiesParser = PropertiesParser;
