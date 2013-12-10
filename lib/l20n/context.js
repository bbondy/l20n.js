if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(function (require, exports, module) {
  'use strict';

  var Locale = require('./locale').Locale;

  function Context() {
    this.curLanguage = 'en-US';
    this.whenComplete = [];
    this.isReady = false;
    this.locales = {};

    Object.defineProperty(this, 'readyState', {
      get: this.getReadyState.bind(this),
      enumerable: true
    });
  }

  Context.prototype.ready = function(cb) {
    if (this.isReady) {
      cb();
    } else {
      this.whenComplete.push(cb);
    }
  };

  Context.prototype.get = function(id) {
    return navigator.mozL10n.getFromLocale(id);
  };

  Context.prototype.translate = translateFragment;

  Context.prototype.localize = localizeElement;

  Context.prototype.language = {
    set code(lang) {
      var locale = navigator.mozL10n.getLocale();
      if (locale) {
        locale.entries = {};
      }
      navigator.mozL10n.curLanguage = lang;
      loadResources();
    },
    get code() { return navigator.mozL10n.curLanguage; },
    direction: 'ltr',
  };

  Context.prototype.getDictionary = function(fragment) {
    if (!fragment) {
      return this.getLocale().entries;
    }

    var ast = {};
    var elements = getTranslatableChildren(fragment);

    for (var i = 0; i < elements.length; i++) {
      var attrs = getL10nAttributes(elements[i]);
      var val = this.get(attrs.id);
      ast[attrs.id] = val;
    }
    return ast;
  };

  /* private */

  Context.prototype.getLocale = function() {
    return this.locales[this.curLanguage];
  };

  Context.prototype.getReadyState = function() {
    return this.isReady ? 'complete' : 'loading';
  };

  Context.prototype.getFromLocale = function C_getFromLocale(id) {
    var locale = navigator.mozL10n.getLocale();
    if (!locale) {
      return 'Locale is not ready: '+id;
    }
    var entry = locale.getEntry(id);

    return entry;
  };


  Context.prototype.fireReady = function() {
    for (var i = 0; i < this.whenComplete.length; i++) {
      this.whenComplete[i]();
    }
    this.whenComplete = [];
  };

  var isPretranslated = false;
  navigator.mozL10n = new Context();

  function getL10nAttributes(element) {
    if (!element) {
      return {};
    }

    var l10nId = element.getAttribute('data-l10n-id');
    var l10nArgs = element.getAttribute('data-l10n-args');

    var args = {};
    if (l10nArgs) {
      args = JSON.parse(l10nArgs);
    }
    return {id: l10nId, args: args};
  }

  function getTranslatableChildren(element) {
    return element ? element.querySelectorAll('*[data-l10n-id]') : [];
  }

  function translateElement(element) {
    var l10n = getL10nAttributes(element);
    if (!l10n.id) {
      return;
    }

    element.textContent = navigator.mozL10n.get(l10n.id);
    return true;
  }

  function localizeElement(element, id, args) {
    if (!element) {
      return;
    }

    if (!id) {
      element.textContent = '';
      element.removeAttribute('data-l10n-id');
      element.removeAttribute('data-l10n-args');
    }

    element.setAttribute('data-l10n-id', id);
    if (args && typeof args === 'object') {
      element.setAttribute('data-l10n-args', JSON.stringify(args));
    } else {
      element.removeAttribute('data-l10n-args');
    }

    translateElement(element);
  }

  function translateFragment(element) {

    element = element || document.documentElement;

    var nodes = getTranslatableChildren(element);

    for (var i = 0; i < nodes.length; i++) {
      var l10nId = nodes[i].getAttribute('data-l10n-id');
      nodes[i].textContent = navigator.mozL10n.get(l10nId);
    }
    return [];
  }

  function onReady() {
    navigator.mozL10n.isReady = true;
    if (!isPretranslated) {
      translateFragment();
    }

    navigator.mozL10n.fireReady();
    fireLocalizedEvent();
  }



  function fireLocalizedEvent() {
    var event = document.createEvent('Event');
    event.initEvent('localized', false, false);
    event.language = 'en-US';
    window.dispatchEvent(event);
  }

});
