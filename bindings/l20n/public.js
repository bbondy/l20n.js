'use strict';

/* global MozL10nMutationObserver */
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

  request: function(langs) {
    this.ctx = this.env.createContext(langs, this.resources);
    return this.ctx.ready.then(translateDocument.bind(this));
  },

  readyState: 'complete',
  language: {},
  qps: PSEUDO_STRATEGIES
};

function getDirection(lang) {
  return (navigator.mozL10n.rtlList.indexOf(lang) >= 0) ? 'rtl' : 'ltr';
}

function fireLocalizedEvent(supported) {
  window.dispatchEvent(new CustomEvent('localized', {
    'bubbles': false,
    'cancelable': false,
    'detail': {
      'languages': supported
    }
  }));
}
