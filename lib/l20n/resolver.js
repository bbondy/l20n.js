'use strict';

var L10nError = require('./errors').L10nError;

var KNOWN_MACROS = ['plural'];

var MAX_PLACEABLE_LENGTH = 2500;
var MAX_PLACEABLES = 100;
var rePlaceables = /\{\{\s*(.+?)\s*\}\}/g;

function createEntry(node, env) {
  var keys = Object.keys(node);

  // the most common scenario: a simple string with no arguments
  if (typeof node.$v === 'string' && keys.length === 2) {
    return node.$v;
  }

  var attrs;

  /* jshint -W084 */
  for (var i = 0, key; key = keys[i]; i++) {
    if (key[0] === '$') {
      continue;
    }

    if (!attrs) {
      attrs = Object.create(null);
    }
    attrs[key] = createAttribute(node[key], env, node.$i + '.' + key);
  }

  return {
    id: node.$i,
    value: node.$v || null,
    index: node.$x || null,
    attrs: attrs || null,
    env: env,
    // the dirty guard prevents cyclic or recursive references
    dirty: false
  };
}

function createAttribute(node, env, id) {
  if (typeof node === 'string') {
    return node;
  }

  return {
    id: id,
    value: node.$v || null,
    index: node.$x || null,
    env: env,
    dirty: false
  };
}


function format(entity, ctxdata) {
  if (typeof entity === 'string') {
    return entity;
  }

  if (entity.dirty) {
    return undefined;
  }

  entity.dirty = true;
  var val;
  // if format fails, we want the exception to bubble up and stop the whole
  // resolving process;  however, we still need to clean up the dirty flag
  try {
    val = resolveValue(ctxdata, entity.env, entity.value, entity.index);
  } finally {
    entity.dirty = false;
  }
  return val;
}

function formatValue(entity, ctxdata) {
  if (typeof entity === 'string') {
    return entity;
  }

  try {
    return format(entity, ctxdata);
  } catch (e) {
    return undefined;
  }
}

function formatEntity(entity, ctxdata) {
  if (!entity.attrs) {
    return formatValue(entity, ctxdata);
  }

  var formatted = {
    value: formatValue(entity, ctxdata),
    attrs: Object.create(null)
  };

  for (var key in entity.attrs) {
    /* jshint -W089 */
    formatted.attrs[key] = formatValue(entity.attrs[key], ctxdata);
  }

  return formatted;
}

function resolveIdentifier(ctxdata, env, id) {
  if (KNOWN_MACROS.indexOf(id) > -1) {
    return env['__' + id];
  }

  if (ctxdata && ctxdata.hasOwnProperty(id) &&
      (typeof ctxdata[id] === 'string' ||
       (typeof ctxdata[id] === 'number' && !isNaN(ctxdata[id])))) {
    return ctxdata[id];
  }

  // XXX: special case for Node.js where still:
  // '__proto__' in Object.create(null) => true
  if (id in env && id !== '__proto__') {
    return format(env[id], ctxdata);
  }

  return undefined;
}

function subPlaceable(ctxdata, env, match, id) {
  var value = resolveIdentifier(ctxdata, env, id);

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    // prevent Billion Laughs attacks
    if (value.length >= MAX_PLACEABLE_LENGTH) {
      throw new L10nError('Too many characters in placeable (' +
                          value.length + ', max allowed is ' +
                          MAX_PLACEABLE_LENGTH + ')');
    }
    return value;
  }

  return match;
}

function interpolate(ctxdata, env, str) {
  var placeablesCount = 0;
  var value = str.replace(rePlaceables, function(match, id) {
    // prevent Quadratic Blowup attacks
    if (placeablesCount++ >= MAX_PLACEABLES) {
      throw new L10nError('Too many placeables (' + placeablesCount +
                          ', max allowed is ' + MAX_PLACEABLES + ')');
    }
    return subPlaceable(ctxdata, env, match, id);
  });
  placeablesCount = 0;
  return value;
}

function resolveSelector(ctxdata, env, expr, index) {
    var selector = resolveIdentifier(ctxdata, env, index[0]);
    if (selector === undefined) {
      throw new L10nError('Unknown selector: ' + index[0]);
    }

    if (typeof selector !== 'function') {
      // selector is a simple reference to an entity or ctxdata
      return selector;
    }

    var argLength = index.length - 1;
    if (selector.length !== argLength) {
      throw new L10nError('Macro ' + index[0] + ' expects ' +
                          selector.length + ' argument(s), yet ' + argLength +
                          ' given');
    }

    var argValue = resolveIdentifier(ctxdata, env, index[1]);

    if (selector === env.__plural) {
      // special cases for zero, one, two if they are defined on the hash
      if (argValue === 0 && 'zero' in expr) {
        return 'zero';
      }
      if (argValue === 1 && 'one' in expr) {
        return 'one';
      }
      if (argValue === 2 && 'two' in expr) {
        return 'two';
      }
    }

    return selector(argValue);
}

function resolveValue(ctxdata, env, expr, index) {
  if (typeof expr === 'string') {
    return interpolate(ctxdata, env, expr);
  }

  if (typeof expr === 'boolean' ||
      typeof expr === 'number' ||
      !expr) {
    return expr;
  }

  // otherwise, it's a dict
  if (index) {
    // try to use the index in order to select the right dict member
    var selector = resolveSelector(ctxdata, env, expr, index);
    if (expr.hasOwnProperty(selector)) {
      return resolveValue(ctxdata, env, expr[selector]);
    }
  }

  // if there was no index or no selector was found, try 'other'
  if ('other' in expr) {
    return resolveValue(ctxdata, env, expr.other);
  }

  return undefined;
}

var Resolver = {
  createEntry: createEntry,
  format: format,
  formatValue: formatValue,
  formatEntity: formatEntity,
  rePlaceables: rePlaceables
};

module.exports = Resolver;
