'use strict';

import { qps } from '../../lib/pseudo';
import { getResourceLinks, documentReady } from './head';
import {
  pDom, setAttributes, getAttributes, translateFragment, translateMutations
} from './dom';

const pView = {
  doc: Symbol('doc'),
  init: Symbol('init'),
  interactive: Symbol('interactive'),
  translateDocument: Symbol('translateDocument'),
};

const observerConfig = {
  attributes: true,
  characterData: false,
  childList: true,
  subtree: true,
  attributeFilter: ['data-l10n-id', 'data-l10n-args']
};

export class View {
  constructor(client, doc) {
    const observer = new MutationObserver(onMutations.bind(this));

    this[pView.doc] = doc;
    this[pDom.observe] = () => observer.observe(doc, observerConfig);
    this[pDom.disconnect] = () => observer.disconnect();
    this[pView.interactive] = documentReady().then(
      () => this[pView.init](client));

    this.qps = qps;
    this.ready = new Promise(function(resolve) {
      const viewReady = function(evt) {
        doc.removeEventListener('DOMLocalized', viewReady);
        resolve(evt.detail.languages);
      };
      doc.addEventListener('DOMLocalized', viewReady);
    });

    this.resolvedLanguages().then(
      langs => this[pView.translateDocument](langs));
  }

  [pView.init](client) {
    this[pDom.observe]();
    return client.registerView(
      this, getResourceLinks(this[pView.doc].head)).then(
        () => client);
  }

  [pView.translateDocument](langs) {
    const doc = this[pView.doc];

    if (langs[0].code === doc.documentElement.getAttribute('lang')) {
      return Promise.resolve().then(
        () => dispatchEvent(doc, 'DOMLocalized', langs));
    }

    return translateFragment(this, langs, doc.documentElement).then(
      () => {
        doc.documentElement.lang = langs[0].code;
        doc.documentElement.dir = langs[0].dir;
        dispatchEvent(doc, 'DOMLocalized', langs);
      });
  }

  [pDom.resolveEntities](langs, keys) {
    return this[pView.interactive].then(
      client => client.resolveEntities(this, langs, keys));
  }

  resolvedLanguages() {
    return this[pView.interactive].then(
      client => client.languages);
  }

  requestLanguages(langs) {
    return this[pView.interactive].then(
      client => client.requestLanguages(langs));
  }

  formatValues(...keys) {
    return this[pView.interactive].then(
      client => client.formatValues(this, keys));
  }

  formatValue(id, args) {
    return this[pView.interactive].then(
      client => client.formatValues(this, [[id, args]])).then(
        values => values[0]);
  }

  translateFragment(frag) {
    return this.resolvedLanguages().then(
      langs => translateFragment(this, langs, frag));
  }
}

View.prototype.setAttributes = setAttributes;
View.prototype.getAttributes = getAttributes;

function onMutations(mutations) {
  return this.resolvedLanguages().then(
    langs => translateMutations(this, langs, mutations));
}

function dispatchEvent(root, name, langs) {
  const event = new CustomEvent(name, {
    bubbles: false,
    cancelable: false,
    detail: {
      languages: langs
    }
  });
  root.dispatchEvent(event);
}
