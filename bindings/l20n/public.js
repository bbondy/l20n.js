'use strict';

/* global Promise */
/* global MozL10nMutationObserver, Intl */
/* global getDefaultLanguage, getAvailableLanguages */
/* global translateDocument, translateFragment */
/* global setL10nAttributes, getL10nAttributes */
/* global PSEUDO_STRATEGIES */
/* exported fireLocalizedEvent */

navigator.mozL10n = {
  env: null,
  ctx: null,
  resources: [],
  observer: new MozL10nMutationObserver(),

  rtlList: ['ar', 'he', 'fa', 'ps', 'qps-plocm', 'ur'],

  get: function get() {
    return 'xxx';
  },
  translateFragment: function(fragment) {
    return translateFragment.call(this, fragment);
  },
  setAttributes: setL10nAttributes,
  getAttributes: getL10nAttributes,

  ready: function(callback) {
    return this.ctx.ready.then(callback);
  },
  once: function(callback) {
    return this.ctx.ready.then(callback);
  },

  supportedLanguages: null,
  negotiateLanguages: createLanguageNegotiator(
    getDefaultLanguage(), getAvailableLanguages()),

  request: function(requested) {
    this.supportedLanguages = this.negotiateLanguages(requested);
    this.ctx = this.env.createContext(
      this.supportedLanguages, this.resources);
    return this.ctx.ready.then(translateDocument.bind(this));
  },

  handleEvent: function(evt) {
    switch (evt.name) {
      case 'additionallanguageschange':
        onadditionallanguageschange(evt);
        break;
      case 'languagechange':
        onlanguagechange(evt);
        break;
      case 'supportedlanguageschange':
        translateDocument(evt.languages);
        break;
    }
  },

  readyState: 'complete',
  language: {},
  qps: PSEUDO_STRATEGIES
};

function getDirection(lang) {
  return (navigator.mozL10n.rtlList.indexOf(lang) >= 0) ? 'rtl' : 'ltr';
}

function createLanguageNegotiator(def, avail) {
  return function(req) {
    return Promise.all([avail, req, def]).then(
      Function.prototype.apply.bind(Intl.prioritizeLocales, Intl));
  };
}

function dispatchEvent(name, supported) {
  document.dispatchEvent(new CustomEvent(name, {
    'bubbles': false,
    'cancelable': false,
    'detail': {
      'languages': supported
    }
  }));
}

function onadditionallanguageschange(evt) {
  var newSupported = Intl.prioritizeLocales(
    evt.default, evt.available, navigator.languages);
  navigator.mozL10n.supportedLanguages.then(function(oldSupported) {
    if (!arrEqual(oldSupported, newSupported)) {
      dispatchEvent('supportedlanguageschange', newSupported);
    }
  });
}

function onlanguagechange() {
  Promise.all([
    navigator.mozL10n.supportedLanguages,
    navigator.mozL10n.negotiateLanguages(navigator.languages)
  ]).then(function(results) {
    if (!arrEqual.apply(null, results)) {
      dispatchEvent('supportedlanguageschange', results[1]);
    }
  });
}

function contains(arr, elem) {
  return arr.indexOf(elem) > -1;
}

function arrEqual(arr1, arr2) {
  return arr1.length === arr2.length &&
    arr1.every(contains.bind(null, arr2));
}
