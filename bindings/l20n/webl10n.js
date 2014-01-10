define(function (require, exports, module) {
  'use strict';


  var Locale = require('./context').Locale;
  var Context = require('./context').Context;

  var isPretranslated = false;
  navigator.mozL10n = new Context();

  Context.prototype.language = {
    set code(lang) {
      var locale = navigator.mozL10n.getLocale();
      if (locale) {
        locale.entries = {};
      }
      navigator.mozL10n.curLanguage = lang;
      initLocale(true);
    },
    get code() { return navigator.mozL10n.curLanguage; },
    direction: 'ltr',
  };

  Context.prototype.getDictionary = function(fragment) {
    if (!fragment) {
      return this.getLocale().ast;
    }

    var ast = {};

    // don't build inline JSON for default language
    if (navigator.mozL10n.curLanguage == 'en-US') {
      return {};
    }
    var elements = getTranslatableChildren(fragment);

    for (var i = 0; i < elements.length; i++) {
      var attrs = getL10nAttributes(elements[i]);
      var val = this.get(attrs.id);
      ast[attrs.id] = val;
    }
    return ast;
  };
  Context.prototype.translate = translateFragment;

  Context.prototype.localize = localizeElement;

  if (window.document) {
    isPretranslated = document.documentElement.lang === navigator.language;

    if (isPretranslated) {
      waitFor('complete', function() {
        window.setTimeout(initLocale);
      });
    } else {
      waitFor('interactive', initLocale);
    }
  }

  function waitFor(state, callback) {
    if (document.readyState === state) {
      callback();
      return;
    }
    document.addEventListener('readystatechange', function l10n_onrsc() {
      if (document.readyState === state) {
        document.removeEventListener('readystatechange', l10n_onrsc);
        callback();
      }
    });
  }

  function initLocale(forcedLocale) {
    var locale = new Locale();

    var head = document.head;

    var resLinks = document.querySelectorAll('link[type="application/l10n"]');
    var l10nLoads = resLinks.length;

    function onL10nLoaded() {
      l10nLoads--;
      if (l10nLoads <= 0) {
        navigator.mozL10n.locales[navigator.mozL10n.curLanguage] = locale;
        onReady();
      }
    }

    if (l10nLoads === 0) {
      onL10nLoaded();
      return;
    }

    for (var i = 0; i < resLinks.length; i++) {
      var path = resLinks[i].getAttribute('href');
      locale.loadResource(path, onL10nLoaded);
    }
  }

  function onReady() {
    navigator.mozL10n.isReady = true;
    navigator.mozL10n.emitter.emit('ready');
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

  function translateFragment(element) {

    element = element || document.documentElement;

    var nodes = getTranslatableChildren(element);

    for (var i = 0; i < nodes.length; i++) {
      var l10nId = nodes[i].getAttribute('data-l10n-id');
      nodes[i].textContent = navigator.mozL10n.get(l10nId);
    }
    return [];
  }

  function getTranslatableChildren(element) {
    return element ? element.querySelectorAll('*[data-l10n-id]') : [];
  }

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

});

