'use strict';

import { L10nError } from './errors';

const KNOWN_MACROS = ['plural'];
const MAX_PLACEABLE_LENGTH = 2500;

// Unicode bidi isolation characters
const FSI = '\u2068';
const PDI = '\u2069';

export function format(ctx, lang, args, entity) {
  const locals = {
    resolutionChain: new Set()
  };
  return formatValue(locals, ctx, lang, args, entity);
}

function formatValue(locals, ctx, lang, args, entity) {
  if (typeof entity === 'string') {
    return [locals, entity];
  }

  if (locals.resolutionChain.has(entity)) {
    throw new L10nError('Cyclic reference detected');
  }

  locals.resolutionChain.add(entity);
  const rv = resolveValue(
    locals, ctx, lang, args, entity.value, entity.index);
  locals.resolutionChain.delete(entity);
  return rv;
}

function resolveIdentifier(locals, ctx, lang, args, id) {
  if (KNOWN_MACROS.indexOf(id) > -1) {
    return [{}, ctx._getMacro(lang, id)];
  }

  if (args && args.hasOwnProperty(id)) {
    if (typeof args[id] === 'string' || (typeof args[id] === 'number' &&
        !isNaN(args[id]))) {
      return [{}, args[id]];
    } else {
      throw new L10nError('Arg must be a string or a number: ' + id);
    }
  }

  // XXX: special case for Node.js where still:
  // '__proto__' in Object.create(null) => true
  if (id === '__proto__') {
    throw new L10nError('Illegal id: ' + id);
  }

  const entity = ctx._getEntity(lang, id);

  if (entity) {
    return formatValue(locals, ctx, lang, args, entity);
  }

  throw new L10nError('Unknown reference: ' + id);
}

function subPlaceable(locals, ctx, lang, args, id) {
  let res;

  try {
    res = resolveIdentifier(locals, ctx, lang, args, id);
  } catch (err) {
    return [{ error: err }, '{{ ' + id + ' }}'];
  }

  const value = res[1];

  if (typeof value === 'number') {
    return res;
  }

  if (typeof value === 'string') {
    // prevent Billion Laughs attacks
    if (value.length >= MAX_PLACEABLE_LENGTH) {
      throw new L10nError('Too many characters in placeable (' +
                          value.length + ', max allowed is ' +
                          MAX_PLACEABLE_LENGTH + ')');
    }
    return res;
  }

  return [{}, '{{ ' + id + ' }}'];
}

function interpolate(locals, ctx, lang, args, arr) {
  return arr.reduce(function([localsSeq, valueSeq], cur) {
    if (typeof cur === 'string') {
      return [localsSeq, valueSeq + cur];
    } else {
      const [, value] = subPlaceable(locals, ctx, lang, args, cur.name);
      // wrap the substitution in bidi isolate characters
      return [localsSeq, valueSeq + FSI + value + PDI];
    }
  }, [locals, '']);
}

function resolveSelector(locals, ctx, lang, args, expr, index) {
  //XXX: Dehardcode!!!
  let selectorName;
  if (index[0].type === 'call' && index[0].expr.type === 'prop' &&
      index[0].expr.expr.name === 'cldr') {
    selectorName = 'plural';
  } else {
    selectorName = index[0].name;
  }
  const selector = resolveIdentifier(
    locals, ctx, lang, args, selectorName)[1];

  if (typeof selector !== 'function') {
    // selector is a simple reference to an entity or args
    return selector;
  }

  const argValue = index[0].args ?
    resolveIdentifier(locals, ctx, lang, args, index[0].args[0].name)[1] :
    undefined;

  if (selectorName === 'plural') {
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

function resolveValue(locals, ctx, lang, args, expr, index) {
  if (!expr) {
    return [locals, expr];
  }

  if (typeof expr === 'string' ||
      typeof expr === 'boolean' ||
      typeof expr === 'number') {
    return [locals, expr];
  }

  if (Array.isArray(expr)) {
    return interpolate(locals, ctx, lang, args, expr);
  }

  // otherwise, it's a dict
  if (index) {
    // try to use the index in order to select the right dict member
    const selector = resolveSelector(locals, ctx, lang, args, expr, index);
    if (selector in expr) {
      return resolveValue(locals, ctx, lang, args, expr[selector]);
    }
  }

  // if there was no index or no selector was found, try the default
  // XXX 'other' is an artifact from Gaia
  const defaultKey = expr.__default || 'other';
  if (defaultKey in expr) {
    return resolveValue(locals, ctx, lang, args, expr[defaultKey]);
  }

  throw new L10nError('Unresolvable value');
}
