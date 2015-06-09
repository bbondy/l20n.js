'use strict';

import Context from './context';
import { createEntry } from './resolver';
import PropertiesParser from './format/properties/parser';
import L20nParser from './format/l20n/parser';
import { walkContent, getPseudo } from './pseudo';
import { emit, addEventListener, removeEventListener } from './events';

const parsers = {
  properties: PropertiesParser.parse.bind(PropertiesParser),
  l20n: L20nParser.parse.bind(L20nParser),
  json: null
};

export default class Env {
  constructor(id, defaultLang, fetch) {
    this.id = id;
    this.defaultLang = defaultLang;
    this.fetch = fetch;

    this._resMap = Object.create(null);
    this._resCache = Object.create(null);

    let listeners = {};
    this.emit = emit.bind(this, listeners);
    this.addEventListener = addEventListener.bind(this, listeners);
    this.removeEventListener = removeEventListener.bind(this, listeners);
  }

  createContext(resIds) {
    var ctx = new Context(this, resIds);

    resIds.forEach(function(res) {
      if (!this._resMap[res]) {
        this._resMap[res] = new Set();
      }
      this._resMap[res].add(ctx);
    }, this);

    return ctx;
  }

  destroyContext(ctx) {
    var cache = this._resCache;
    var map = this._resMap;

    ctx._resIds.forEach(function(resId) {
      if (map[resId].size === 1) {
        map[resId].clear();
        delete cache[resId];
      } else {
        map[resId].delete(ctx);
      }
    });
  }

  _getResource(lang, res) {
    let { code, src } = lang;
    let cache = this._resCache;

    if (!cache[res]) {
      cache[res] = Object.create(null);
      cache[res][code] = Object.create(null);
    } else if (!cache[res][code]) {
      cache[res][code] = Object.create(null);
    } else if (cache[res][code][src]) {
      return cache[res][code][src];
    }

    let syntax = res.substr(res.lastIndexOf('.') + 1);
    let parser = parsers[syntax];

    let saveEntries = data => {
      let ast = parser ? parser(this, data) : data;
      cache[res][code][src] = createEntries(lang, ast);
    };

    let recover = err => {
      this.emit('fetcherror', err);
      cache[res][code][src] = err;
    };

    let langToFetch = src === 'qps' ?
      { code: this.defaultLang, src: 'app' } :
      lang;

    return cache[res][code][src] = this.fetch(res, langToFetch).then(
      saveEntries, recover);
  }
}

function createEntries(lang, ast) {
  let entries = Object.create(null);
  let create = lang.src === 'qps' ?
    createPseudoEntry.bind(null, getPseudo(lang.code)) :
    createEntry;

  for (var i = 0, node; node = ast[i]; i++) {
    entries[node.$i] = create(node, lang);
  }

  return entries;
}

function createPseudoEntry(qps, node, lang) {
  return createEntry(
    walkContent(node, qps.translate), lang);
}
