  'use strict';

  var rePlaceables = /\{\{\s*(.+?)\s*\}\}/g;

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
          this.attributes[key] = new Entity(this.id + '.' + key, node[key],
                                            env);
        }
      }
      this.value = node._;
      this.index = node._index;
    }
  }

  Entity.prototype.getString = function E_getString(ctxdata) {
    var val = resolve(this.value, this.env, ctxdata || {}, this.index);
    if (val === null) {
      return this.id;
    }
    return val;
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
      if (typeof env[id] === 'string') {
        return env[id];
      } else {
        return env[id].getString(ctxdata);
      }
    }
    return match;
  }

  function interpolate(str, env, ctxdata) {
    return str.replace(rePlaceables, subPlaceable.bind(null, env, ctxdata));
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

    // otherwise, it's a dict

    if (index) {
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

      var selector = env.__plural(argValue);
      if (expr.hasOwnProperty(selector)) {
        return resolve(expr[selector], env, ctxdata);
      }
    }

    // if there was no index or no selector was found, try 'other'
    if ('other' in expr) {
      return resolve(expr.other, env, ctxdata);
    }

    return null;
  }

  function compile(ast, env) {
    if (!env) {
      env = {};
    }

    for (var id in ast) {
      if (!ast.hasOwnProperty(id)) {
        continue;
      }
      if (typeof ast[id] === 'string' && !(rePlaceables.test(ast[id]))) {
        env[id] = ast[id];
      } else {
        env[id] = new Entity(id, ast[id], env);
      }
      // reset the regexp
      rePlaceables.lastIndex = 0;
    }
    return env;
  }

  exports.compile = compile;
  exports.rePlaceables = rePlaceables;
