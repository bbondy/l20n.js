  'use strict';

  var unescape = require('querystring').unescape;

  var nestedProps = ['style', 'dataset'];

  var ppatterns = {
    comment: /^\s*#|^\s*$/,
    entity: /^([^=\s]+)\s*=\s*(.+)$/,
    multiline: /[^\\]\\$/,
    macro: /\{\[\s*(\w+)\(([^\)]*)\)\s*\]\}/i,
    unicode: /\\u([0-9a-fA-F]{1,4})/g,
    entries: /[\r\n]+/
  };

  function unescapeControlCharacters(str) {
    return str.replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\{/g, '{')
    .replace(/\\}/g, '}')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, '\'');
  }

  function unescapeUnicode(str) {
    return str.replace(ppatterns.unicode, function(match, token) {
      return unescape('%u' + '0000'.slice(token.length) + token);
    });
  }

  function unescapeString(str) {
    if (str.lastIndexOf('\\') !== -1) {
      str = unescapeControlCharacters(str);
    }
    return unescapeUnicode(str);
  }

  function parseProperties(source) {
    var ast = {};

    var entries = source.split(ppatterns.entries);
    for (var i = 0; i < entries.length; i++) {
      var line = entries[i];

      if (ppatterns.comment.test(line)) {
        continue;
      }

      while (ppatterns.multiline.test(line) && i < entries.length) {
        line = line.slice(0, line.length - 1) + entries[++i].trim();
      }

      var entityMatch = line.match(ppatterns.entity);
      if (entityMatch && entityMatch.length === 3) {
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

    setEntityValue(name, attr, key, unescapeString(value), ast);
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
        obj[id2]._[key] = value;
      } else {
        if (typeof(obj[id2]) === 'string') {
          obj[id2] = {'_index': parseMacro(obj[id2]), '_': {}};
          obj[id2]._[key] = value;
        } else {
          obj[id2]._[key] = value;
        }
      }
    }
    return;
  }

  function parseMacro(str) {
    var match = str.match(ppatterns.macro);
    if (!match) {
      return [];
    }
    return [match[1], match[2]];
  }

  exports.parseProperties = parseProperties;
