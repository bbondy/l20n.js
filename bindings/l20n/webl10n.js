define(function (require, exports, module) {
  'use strict';


  var Locale = require('./context').Locale;
  var Context = require('./context').Context;
  var io = require('./platform/io');

  var isPretranslated = false;
  navigator.mozL10n = new Context();

  Context.prototype.language = {
    set code(lang) {
      navigator.mozL10n.curLanguage = lang;

      if (navigator.mozL10n.resLinks.length) {
        initLocale(true);
      } else {
        initDocumentLocalization(initLocale.bind(this, true));
      }
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

  Context.prototype.init = function() {
    this.curLanguage = 'en-US';
    this.whenComplete = null;
    this.isReady = false;
    this.locales = {};
    this.resLinks = [];
  }

  Context.prototype.translate = translateFragment;

  Context.prototype.localize = localizeElement;

  if (window.document) {
    isPretranslated = document.documentElement.lang === navigator.language;

    if (isPretranslated) {
      waitFor('complete', function() {
        window.setTimeout(initDocumentLocalization.bind(this, initLocale));
      });
    } else {
      waitFor('interactive', initDocumentLocalization.bind(this, initLocale));
    }

    if ('mozSettings' in navigator && navigator.mozSettings) {
      navigator.mozSettings.addObserver('language.current', function(event) {
        navigator.mozL10n.curLanguage = event.settingValue;
        initLocale(true);
      });
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

  function initDocumentLocalization(cb) {
    var head = document.head;

    var resLinks = head.querySelectorAll('link[type="application/l10n"]');
    var iniLinks = [];

    for (var i = 0; i < resLinks.length; i++) {
      var url = resLinks[i].getAttribute('href');
      navigator.mozL10n.resLinks.push(url);
      var type = url.substr(url.lastIndexOf('.')+1);
      if (type == 'ini') {
        iniLinks.push(url);
      }
    }
    var iniLoads = iniLinks.length;

    function onIniLoaded() {
      iniLoads--;
      if (iniLoads <= 0) {
        cb();
      }
    }

    if (iniLoads === 0) {
      cb();
      return;
    }

    for (var i = 0; i < iniLinks.length; i++) {
      loadINI(iniLinks[i], onIniLoaded);
    }

  }

  function loadINI(url, cb) {
    io.load(url, function(err, source) {
      if (!source) {
        cb();
        return;
      }

      var ini = parseINI(source, url);
      var pos = navigator.mozL10n.resLinks.indexOf(url);

      var patterns = [];
      for (var i = 0; i < ini.resources.length; i++) {
        patterns.push(ini.resources[i].replace('en-US', '{{locale}}'));
      }
      var args = [pos, 1].concat(patterns);

      navigator.mozL10n.resLinks.splice.apply(navigator.mozL10n.resLinks, args);

      cb();
    });
  };

  function initLocale(forced) {
    if (navigator.mozL10n.getLocale()) {
      onReady(forced);
      return;
    }

    var locale = new Locale();

    var code = navigator.mozL10n.curLanguage;

    var l10nLoads = navigator.mozL10n.resLinks.length;

    function onL10nLoaded() {
      l10nLoads--;
      if (l10nLoads <= 0) {
        navigator.mozL10n.locales[code] = locale;
        onReady(forced);
      }
    }

    if (l10nLoads === 0) {
      onL10nLoaded();
      return;
    }

    for (var i = 0; i < navigator.mozL10n.resLinks.length; i++) {
      var path = navigator.mozL10n.resLinks[i];
      var type = path.substr(path.lastIndexOf('.')+1);

      switch (type) {
        case 'json':
          io.loadJSON(path.replace('{{locale}}', code), locale.addJSONResource.bind(locale, onL10nLoaded));
          break;
        case 'properties':
          io.load(path.replace('{{locale}}', code), locale.addPropResource.bind(locale, onL10nLoaded));
          break;
      }
    }
  }

  function relativePath(baseUrl, url) {
    if (url[0] == '/') {
      return url;
    }

    var dirs = baseUrl.split('/')
      .slice(0, -1)
      .concat(url.split('/'))
      .filter(function(path) {
        return path !== '.';
      });

    return dirs.join('/');
  }

  var iniPatterns = {
    section: /^\s*\[(.*)\]\s*$/,
    import: /^\s*@import\s+url\((.*)\)\s*$/i,
    entry: /[\r\n]+/
  };

  function parseINI(source, iniPath) {
    var entries = source.split(iniPatterns['entry']);
    var locales = ['en-US'];
    var genericSection = true;
    var uris = [];

    for (var i = 0; i < entries.length; i++) {
      var line = entries[i];
      // we only care about en-US resources
      if (genericSection && iniPatterns['import'].test(line)) {
        var match = iniPatterns['import'].exec(line);
        var uri = relativePath(iniPath, match[1]);
        uris.push(uri);
        continue;
      }

      // but we need the list of all locales in the ini, too
      if (iniPatterns['section'].test(line)) {
        genericSection = false;
        var match = iniPatterns['section'].exec(line);
        locales.push(match[1]);
      }
    }
    return {
      locales: locales,
      resources: uris
    };
  }

  function onReady(forced) {
    navigator.mozL10n.isReady = true;
    navigator.mozL10n.emitter.emit('ready');
    if (forced || !isPretranslated) {
      console.log('translating whole document into '+ navigator.mozL10n.curLanguage);
      translateFragment();
    }

    navigator.mozL10n.fireReady();
    fireLocalizedEvent();
  }

  function fireLocalizedEvent() {
    var event = document.createEvent('Event');
    event.initEvent('localized', false, false);
    event.language = navigator.mozL10n.curLanguage;
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

