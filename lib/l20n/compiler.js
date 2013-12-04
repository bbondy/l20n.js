if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(function (require, exports, module) {
  'use strict';

  var EventEmitter = require('./events').EventEmitter;

  function Compiler() {

    // Public

    this.compile = compile;
    this.addEventListener = addEventListener;
    this.removeEventListener = removeEventListener;

    // Private

    var MAX_PLACEABLE_LENGTH = 2500;

    var _emitter = new EventEmitter();
    var _references = {
      identifiers: {}
    };

    var _entryTypes = {
      Entity: Entity,
      Macro: Macro
    };

    // Public API functions

    function compile(ast, env) {
      if (!env) {
        env = {};
      }

      for (var id in ast.body) {
        if (!ast.body.hasOwnProperty(id)) {
          continue;
        }
        var entry = ast.body[id];
        var constructor = _entryTypes[entry.type || 'Entity'];
        try {
          env[id] = new constructor(id, entry, env);
        } catch (e) {
          requireCompilerError(e);
        }
      }
      return env;
    }

    function addEventListener(type, listener) {
      return _emitter.addEventListener(type, listener);
    }

    function removeEventListener(type, listener) {
      return _emitter.removeEventListener(type, listener);
    }

    // utils

    function emitError(ctor, message, entry, source) {
      var e = new ctor(message, entry, source);
      _emitter.emit('error', e);
      return e;
    }

    // The Entity object.
    function Entity(id, node, env) {
      this.id = id;
      this.env = env;
      this.index = null;
      this.attributes = null;
      if (node.index) {
        this.index = [];
        for (var i = 0; i < node.index.length; i++) {
          this.index.push(new IndexExpression(node.index[i], this));
        }
      }
      if (node.attrs) {
        this.attributes = [];
        for (var key in node.attrs) {
          if (node.attrs.hasOwnProperty(key)) {
            this.attributes[key] = new Attribute(key, node.attrs[key], this);
          }
        }
      }
      // Bug 817610 - Optimize a fast path for String entities in the Compiler
      if (node.value && !node.value.type) {
        this.value = node.value.content;
      } else {
        if (node.value) {
          this.value = new LazyExpression(node.value, this, this.index);
        } else {
          this.value = null;
        }
      }
    }

    Entity.prototype.getString = function E_getString(ctxdata) {
      try {
        var locals = {
          __this__: this,
          __env__: this.env
        };
        return _resolve(this.value, locals, ctxdata);
      } catch (e) {
        requireCompilerError(e);
        // `ValueErrors` are not emitted in `StringLiteral` where they are 
        // created, because if the string in question is being evaluated in an 
        // index, we'll emit an `IndexError` instead.  To avoid duplication, 
        // `ValueErrors` are only be emitted if they actually make it to 
        // here.  See `IndexExpression` for an example of why they wouldn't.
        if (e instanceof ValueError) {
          _emitter.emit('error', e);
        }
        throw e;
      }
    };

    Entity.prototype.get = function E_get(ctxdata) {
      // reset `_references` to an empty state
      _references.identifiers = {};
      var entity = {
        value: this.getString(ctxdata),
        attributes: {}
      };
      for (var key in this.attributes) {
        if (this.attributes.hasOwnProperty(key)) {
          entity.attributes[key] = this.attributes[key].getString(ctxdata);
        }
      }
      entity.identifiers = _references.identifiers;
      return entity;
    };


    function Attribute(key, node, entity) {
      this.key = key;
      this.entity = entity;
      this.index = null;
      if (node.index) {
        this.index = [];
        for (var i = 0; i < node.index.length; i++) {
          this.index.push(new IndexExpression(node.index[i], this));
        }
      }
      // Bug 817610 - Optimize a fast path for String entities in the Compiler
      if (node.value && !node.value.type) {
        this.value = node.value.content;
      } else {
        if (node.value) {
          this.value = new LazyExpression(node.value, entity, this.index);
        } else {
          this.value = null;
        }
      }
    }

    Attribute.prototype.getString = function A_getString(ctxdata) {
      try {
        var locals = {
          __this__: this.entity,
          __env__: this.entity.env
        };
        return _resolve(this.value, locals, ctxdata);
      } catch (e) {
        requireCompilerError(e);
        if (e instanceof ValueError) {
          _emitter.emit('error', e);
        }
        throw e;
      }
    };

    function Macro(id, node, env) {
      this.id = id;
      this.env = env;
      this.local = node.local || false;
      this.expression = node.expression;
      this.args = node.args;
    }
    Macro.prototype._call = function M_call(arg) {
      return [null, this.expression.call(null, arg)];
    };


    var EXPRESSION_TYPES = {
      'Identifier': Identifier,
      'String': StringLiteral,
      'Hash': HashLiteral,
      'HashItem': Expression,
      'ComplexString': ComplexString,
      'CallExpression': CallExpression
    };

    function Expression(node, entry, index) {
      // An entity can have no value.  It will be resolved to `null`.
      if (!node) {
        return null;
      }
      // assume String type by default
      var type = node.type || 'String';
      if (!EXPRESSION_TYPES[type]) {
        throw emitError('CompilationError', 'Unknown expression type' + type);
      }
      if (index) {
        index = index.slice();
      }
      return new EXPRESSION_TYPES[type](node, entry, index);
    }

    function LazyExpression(node, entry, index) {
      this.expr = undefined;
      this.node = node;
      this.entry = entry;
      this.index = index;
    }

    LazyExpression.prototype.__call = function(locals, ctxdata, prop) {
      // An entity can have no value.  It will be resolved to `null`.
      if (!this.node) {
        return null;
      }
      if (this.expr) {
        return this.expr.__call(locals, ctxdata, prop);
      }
      this.expr = Expression(this.node, this.entry, this.index);
      return this.expr.__call(locals, ctxdata, prop);
    };

    function _resolve(expr, locals, ctxdata) {
      // Bail out early if it's a primitive value or `null`.  This is exactly 
      // what we want.
      if (typeof expr === 'string' || 
          typeof expr === 'boolean' || 
          typeof expr === 'number' ||
          !expr) {
        return expr;
      }

      // Check if `expr` is an Entity or an Attribute
      if (expr.value !== undefined) {
        return _resolve(expr.value, locals, ctxdata);
      }

      // Check if `expr` is an expression
      if (expr.__call !== undefined) {
        var current = expr.__call(locals, ctxdata);
        locals = current[0], current = current[1];
        return _resolve(current, locals, ctxdata);
      }

      // Throw if `expr` is a macro
      if (expr.expression) {
        throw new RuntimeError('Uncalled macro: ' + expr.id);
      }

      // Throw if `expr` is a non-primitive from ctxdata
      throw new RuntimeError('Cannot resolve ctxdata of type ' + typeof expr);

    }

    function Identifier(node) {
      this.name = node.name;
    }

    Identifier.prototype.__call = function identifier(locals, ctxdata) {
      if (ctxdata && ctxdata.hasOwnProperty(this.name)) {
        return  [locals, ctxdata[this.name]];
      }
      if (!locals.__env__.hasOwnProperty(this.name)) {
        throw new RuntimeError('Reference to an unknown entry: ' + this.name);
      }
      _references.identifiers[this.name] = true;
      locals = {
        __this__: locals.__env__[this.name],
        __env__: locals.__env__
      };
      return [locals, locals.__this__];
    };

    function StringLiteral(node) {
      this.content = node.content;
    }

    StringLiteral.prototype.__call =  function stringLiteral(locals, ctxdata) {
      return [locals, this.content];
    };

    function ComplexString(node, entry) {
      this.entry = entry;
      this.content = [];
      for (var i = 0; i < node.content.length; i++) {
        this.content.push(Expression(node.content[i], entry));
      }
      this.source = node.source;
      // Every complexString needs to have its own `dirty` flag whose state 
      // persists across multiple calls to the given complexString.
      this.dirty = false;
    }

    ComplexString.prototype.__call = function complexString(locals, ctxdata) {
      if (this.dirty) {
        throw new RuntimeError('Cyclic reference detected');
      }
      this.dirty = true;
      var parts = [];
      try {
        for (var i = 0; i < this.content.length; i++) {
          var part = _resolve(this.content[i], locals, ctxdata);
          if (typeof part !== 'string' && typeof part !== 'number') {
            throw new RuntimeError('Placeables must be strings or ' +
            'numbers');
          }
          if (part.length > MAX_PLACEABLE_LENGTH) {
            throw new RuntimeError('Placeable has too many characters, ' +
              'maximum allowed is ' +
            MAX_PLACEABLE_LENGTH);
          }
          parts.push(part);
        }
      } catch (e) {
        requireCompilerError(e);
        // only throw, don't emit yet.  If the `ValueError` makes it to 
        // `getString()` it will be emitted there.  It might, however, be 
        // cought by `IndexExpression` and changed into a `IndexError`.  
        // See `IndexExpression` for more explanation.
        throw new ValueError(e.message, this.entry, this.source);
      } finally {
        this.dirty = false;
      }
      return [locals, parts.join('')];
    };

    function IndexExpression(node, entry) {
      this.entry = entry;
      this.expression = Expression(node, entry);
      // This is analogous to `ComplexString` in that an individual index can 
      // only be visited once during the resolution of an Entity.
      this.dirty = false;
    }

    IndexExpression.prototype.__call = function indexExpression(locals, 
                                                                ctxdata) {
      if (this.dirty) {
        throw new RuntimeError('Cyclic reference detected');
      }
      this.dirty = true;
      try {
        // We need to resolve `expression` here so that we catch errors 
        // thrown deep within.  Without `_resolve` we might end up with an 
        // unresolved Entity object, and no "Cyclic reference detected" 
        // error would be thown.
        var retval = _resolve(this.expression, locals, ctxdata);
      } catch (e) {
        // If it's an `IndexError` thrown deeper within `expression`, it 
        // has already been emitted by its `indexExpression`.  We can 
        // safely re-throw it here.
        if (e instanceof IndexError) {
          throw e;
        }

        // Otherwise, make sure it's a `RuntimeError` or a `ValueError` and 
        // throw and emit an `IndexError`.
        requireCompilerError(e);
        throw emitError(IndexError, e.message, this.entry);
      } finally {
        this.dirty = false;
      }
      return [locals, retval];
    };

    function HashLiteral(node, entry, index) {
      this.entry = entry;
      this.content = {};
      this.defaultKey = undefined;
      this.defaultIndex = index ? index.shift() : undefined;
      for (var i = 0; i < node.content.length; i++) {
        var elem = node.content[i];
        // use `elem.value` to skip `HashItem` and create the value right away
        this.content[elem.key] = Expression(elem.value, entry, index);
        if (elem.default) {
          this.defaultKey = elem.key;
        }
      }
    }

    HashLiteral.prototype.__call = function hashLiteral(locals, ctxdata) {
      var keysToTry = [this.defaultIndex, this.defaultKey];
      var keysTried = [];
      locals.__overrides__ = {
        zero: 'zero' in this.content,
        one: 'one' in this.content,
        two: 'two' in this.content
      };
      for (var i = 0; i < keysToTry.length; i++) {
        var key = _resolve(keysToTry[i], locals, ctxdata);
        if (key === undefined) {
          continue;
        }
        keysTried.push(key);
        if (this.content.hasOwnProperty(key)) {
          return [locals, this.content[key]];
        }
      }
      var message = 'Hash key lookup failed ' +
        '(tried "' + keysTried.join('", "') + '").';
      throw emitError(IndexError, message, this.entry);
    };

    function CallExpression(node, entry) {
      this.callee = Expression(node.callee, entry);
      // support only one argument per callExpr for now
      this.arg = Expression(node.arguments[0], entry);
    }

    CallExpression.prototype.__call = function callExpression(locals, ctxdata) {
      // when arg is called, it returns a [locals, value] tuple; store the 
      // value in evaluated_args
      var argValue = this.arg.__call(locals, ctxdata)[1];

      argValue = parseFloat(argValue);
      if (isNaN(argValue)) {
        throw new RuntimeError('Macro arguments must be numbers');
      }

      // special cases for zero, one, two if they are defined on the hash
      if (argValue === 0 && locals.__overrides__.zero) {
        return [null, 'zero'];
      }
      if (argValue === 1 && locals.__overrides__.one) {
        return [null, 'one'];
      }
      if (argValue === 2 && locals.__overrides__.two) {
        return [null, 'two'];
      }

      // callee is an expression pointing to a macro, e.g. an identifier
      var macro = this.callee.__call(locals, ctxdata);
      locals = macro[0], macro = macro[1];
      if (!macro.expression) {
        throw new RuntimeError('Expected a macro, got a non-callable.');
      }
      // Rely entirely on the platform implementation to detect recursion.
      return macro._call(argValue);
    };

  }

  Compiler.Error = CompilerError;
  Compiler.CompilationError = CompilationError;
  Compiler.RuntimeError = RuntimeError;
  Compiler.ValueError = ValueError;
  Compiler.IndexError = IndexError;


  // `CompilerError` is a general class of errors emitted by the Compiler.
  function CompilerError(message) {
    this.name = 'CompilerError';
    this.message = message;
  }
  CompilerError.prototype = Object.create(Error.prototype);
  CompilerError.prototype.constructor = CompilerError;

  // `CompilationError` extends `CompilerError`.  It's a class of errors 
  // which happen during compilation of the AST.
  function CompilationError(message, entry) {
    CompilerError.call(this, message);
    this.name = 'CompilationError';
    this.entry = entry.id;
  }
  CompilationError.prototype = Object.create(CompilerError.prototype);
  CompilationError.prototype.constructor = CompilationError;

  // `RuntimeError` extends `CompilerError`.  It's a class of errors which 
  // happen during the evaluation of entries, i.e. when you call 
  // `entity.toString()`.
  function RuntimeError(message) {
    CompilerError.call(this, message);
    this.name = 'RuntimeError';
  };
  RuntimeError.prototype = Object.create(CompilerError.prototype);
  RuntimeError.prototype.constructor = RuntimeError;

  // `ValueError` extends `RuntimeError`.  It's a class of errors which 
  // happen during the composition of a ComplexString value.  It's easier to 
  // recover from than an `IndexError` because at least we know that we're 
  // showing the correct member of the hash.
  function ValueError(message, entry, source) {
    RuntimeError.call(this, message);
    this.name = 'ValueError';
    this.entry = entry.id;
    this.source = source;
  }
  ValueError.prototype = Object.create(RuntimeError.prototype);
  ValueError.prototype.constructor = ValueError;

  // `IndexError` extends `RuntimeError`.  It's a class of errors which 
  // happen during the lookup of a hash member.  It's harder to recover 
  // from than `ValueError` because we en dup not knowing which variant of the 
  // entity value to show and in case the meanings are divergent, the 
  // consequences for the user can be serious.
  function IndexError(message, entry) {
    RuntimeError.call(this, message);
    this.name = 'IndexError';
    this.entry = entry.id;
  };
  IndexError.prototype = Object.create(RuntimeError.prototype);
  IndexError.prototype.constructor = IndexError;

  function requireCompilerError(e) {
    if (!(e instanceof CompilerError)) {
      throw e;
    }
  }

  exports.Compiler = Compiler;

});
