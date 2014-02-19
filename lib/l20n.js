'use strict';

var Context = require('./l20n/context').Context;

exports.getContext = function L20n_getContext(id) {
  return new Context(id);
};
