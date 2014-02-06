  'use strict';

  var getPluralRule = require('./plurals').getPluralRule;

  var rePlaceable = /\{\{\s*(.+?)\s*\}\}/g;

  function Entity(id, node, env) {
    this.id = id;
    this.env = env;
    if (typeof node === 'string') {
      this.value = node;
    } else {
      // it's either a hash or it has attrs, or both
      for (var key in node) {
        if (node.hasOwnProperty(key) && key[0] !== '_') {
          if (!this.attributes) {
            this.attributes = {};
          }
          this.attributes[key] = new Entity(this.id + '.' + key, node[key]);
        }
      }
      this.value = node._;
      this.index = node._index;
    }
  }

  Entity.prototype.getString = function E_getString(ctxdata) {
    return resolve(this.value, this.env, ctxdata || {}, this.index);
  };

  Entity.prototype.get = function E_get(ctxdata) {
    var entity = {
      value: this.getString(ctxdata),
      attributes: {}
    };
    for (var key in this.attributes) {
      if (this.attributes.hasOwnProperty(key)) {
        entity.attributes[key] = this.attributes[key].getString(ctxdata);
      }
    }
    return entity;
  };

  function subPlaceable(env, ctxdata, match, id) {
    if (ctxdata.hasOwnProperty(id)) {
      return ctxdata[id];
    }
    if (env.hasOwnProperty(id)) {
      return env[id].toString(ctxdata);
    }
    return match;
  }

  function interpolate(str, env, ctxdata) {
    return str.replace(rePlaceable, subPlaceable.bind(null, env, ctxdata));
  }

  function resolve(expr, env, ctxdata, index) {
    if (typeof expr === 'string') {
      return interpolate(expr, env, ctxdata);
    }

    if (typeof expr === 'boolean' ||
        typeof expr === 'number' ||
        !expr) {
      return expr;
    }

    // otherwise, it's a hash

    // XXX this assumes too much about the macro arg, but works okay for now
    var argValue = ctxdata[index[1]];

    // special cases for zero, one, two if they are defined on the hash
    if (argValue === 0 && 'zero' in expr) {
      return resolve(expr.zero, env, ctxdata);
    }
    if (argValue === 1 && 'one' in expr) {
      return resolve(expr.one, env, ctxdata);
    }
    if (argValue === 2 && 'two' in expr) {
      return resolve(expr.two, env, ctxdata);
    }

    var selector = getPluralRule('en-US')(ctxdata[index[1]]);
    if (expr.hasOwnProperty(selector)) {
      return resolve(expr[selector], env, ctxdata);
    }
  }

  function compile(ast, env) {
    if (!env) {
      env = {};
    }

    for (var id in ast) {
      if (!ast.hasOwnProperty(id)) {
        continue;
      }
      if (typeof ast[id] === 'string' && !(rePlaceable.test(ast[id]))) {
        env[id] = ast[id];
      } else {
        env[id] = new Entity(id, ast[id], env);
      }
    }
    return env;
  }

  exports.compile = compile;
