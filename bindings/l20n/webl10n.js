define(function (require, exports, module) {
  'use strict';


  var L20n = require('../l20n');
  var Locale = require('./context').Locale;
  var Context = require('./context').Context;

  var isPretranslated = false;
  navigator.mozL10n = L20n.getContext();

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
  Context.prototype.translate = translateFragment;

  Context.prototype.localize = localizeElement;

  if (typeof(document) !== 'undefined') {
    window.addEventListener('load', function() {
      if (document.documentElement.lang) {
        isPretranslated = true;
      }
      setTimeout(loadResources, 1000);
    });
  }

  function loadResources() {

    var locale = new Locale();

    var nodes = document.querySelectorAll('link[type="application/l10n"]');
    var iniLoads = nodes.length;

    function onIniLoaded() {
      iniLoads--;
      if (iniLoads === 0) {
        navigator.mozL10n.locales[navigator.mozL10n.curLanguage] = locale;
        onReady();
      }
    }

    for (var i = 0; i < nodes.length; i++) {
      var path = nodes[i].getAttribute('href');
      locale.loadResource(path, onIniLoaded);
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

