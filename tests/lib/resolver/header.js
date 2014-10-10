/* global window, navigator, process, exports, assert:true */
/* exported assert, compile */

'use strict';

var assert = require('assert') || window.assert;
var PropertiesParser;

if (typeof navigator !== 'undefined') {
  var L10n = navigator.mozL10n._getInternalAPI();
  PropertiesParser = L10n.PropertiesParser;
} else {
  var L10n = {
    Resolver: process.env.L20N_COV ?
      require('../../../build/cov/lib/l20n/resolver'):
      require('../../../lib/l20n/resolver'),
    getPluralRule: require('../../../lib/l20n/plurals').getPluralRule
  };

  PropertiesParser = process.env.L20N_COV ?
    require('../../../build/cov/lib/l20n/parser').PropertiesParser
    : require('../../../lib/l20n/format/properties/parser').PropertiesParser;
}

var propertiesParser = new PropertiesParser();

function createEntries(source) {
  var entries = Object.create(null);
  var ast = propertiesParser.parse(null, source);

  for (var id in ast) {
    entries[id] = L10n.Resolver.createEntity(id, ast[id], entries);
  }

  entries.__plural = L10n.getPluralRule('en-US');
  return entries;
}

exports.assert = assert;
exports.createEntries = createEntries;
exports.Resolver = L10n.Resolver;
