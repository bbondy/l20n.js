'use strict';

var Context = require('./l20n/context').Context;
var PropertiesParser =
  require('./l20n/format/properties/parser').PropertiesParser;
var getPluralRule = require('./l20n/plurals').getPluralRule;
var Resolver = require('./l20n/resolver');

exports.Context = Context;
exports.PropertiesParser = PropertiesParser;
exports.getPluralRule = getPluralRule;
exports.getContext = function L20n_getContext(id) {
    return new Context(id);
};
exports.Resolver = Resolver;
exports.createEntries = function(ast) {
  var entries = Object.create(null);
  for (var i = 0, len = ast.length; i < len; i++) {
    entries[ast[i].$i] = Resolver.createEntry(ast[i], entries);
  }
  return entries;
};
