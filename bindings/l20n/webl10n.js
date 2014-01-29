  'use strict';

  var Locale = require('./context').Locale;
  var Context = require('./context').Context;
  var io = require('./platform/io');

  var isPretranslated = false;
  var ctx = new Context();
  navigator.mozL10n = {};

  navigator.mozL10n.language = {
    set code(lang) {
      ctx.currentLocale = lang;

      if (ctx.resLinks.length) {
        initLocale(true);
      } else {
        initDocumentLocalization(initLocale.bind(this, true));
      }
    },
    get code() {
      return ctx.currentLocale;
    },
    direction: 'ltr',
  };

  navigator.mozL10n.getDictionary = function(fragment) {
    if (!fragment) {
      return ctx.getLocale().ast;
    }

    var ast = {};

    // don't build inline JSON for default language
    if (ctx.currentLocale === 'en-US') {
      return {};
    }
    var elements = getTranslatableChildren(fragment);

    for (var i = 0; i < elements.length; i++) {
      var attrs = getL10nAttributes(elements[i]);
      var val = ctx.get(attrs.id);
      ast[attrs.id] = val;
    }
    return ast;
  };

  navigator.mozL10n.init = function() {
    ctx = new Context();
  };

  navigator.mozL10n.translate = translateFragment;

  navigator.mozL10n.localize = localizeElement;

  navigator.mozL10n.get = ctx.get.bind(ctx);

  navigator.mozL10n.ready = ctx.ready.bind(ctx);


  if (window.document) {
    isPretranslated = document.documentElement.lang === navigator.language;

    ctx.currentLocale = navigator.language;

    if (isPretranslated) {
      waitFor('complete', function() {
        window.setTimeout(initDocumentLocalization.bind(null, initLocale));
      });
    } else {
      if (document.readyState === 'complete') {
        window.setTimeout(initDocumentLocalization.bind(null, initLocale));
      } else {
        waitFor('interactive', pretranslate);
      }
    }

    if ('mozSettings' in navigator && navigator.mozSettings) {
      navigator.mozSettings.addObserver('language.current', function(event) {
        ctx.currentLocale = event.settingValue;
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

  function pretranslate() {
    if (inlineLocalization()) {
      waitFor('complete', function() {
        window.setTimeout(initDocumentLocalization.bind(null, initLocale));
      });
    } else {
      initDocumentLocalization(initLocale);
    }
  }

  function inlineLocalization() {
    var locale = new Locale();
    var body = document.body;
    var script = body.querySelector('script[type="application/l10n"][lang="' + ctx.currentLocale + '"]');
    if (script) {
      locale.addJSONResource(null, null, JSON.parse(script.innerHTML));
      ctx.locales[ctx.currentLocale] = locale;
      translateFragment();
      ctx.locales[ctx.currentLocale] = null;
      isPretranslated = true;
      return true;
    }
    return false;
  }

  function initDocumentLocalization(cb) {
    var head = document.head;

    var resLinks = head.querySelectorAll('link[type="application/l10n"]');
    var iniLinks = [];
    var i;

    for (i = 0; i < resLinks.length; i++) {
      var url = resLinks[i].getAttribute('href');
      ctx.resLinks.push(url);
      var type = url.substr(url.lastIndexOf('.')+1);
      if (type === 'ini') {
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

    for (i = 0; i < iniLinks.length; i++) {
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
      var pos = ctx.resLinks.indexOf(url);

      var patterns = [];
      for (var i = 0; i < ini.resources.length; i++) {
        patterns.push(ini.resources[i].replace('en-US', '{{locale}}'));
      }
      var args = [pos, 1].concat(patterns);

      ctx.resLinks.splice.apply(ctx.resLinks, args);

      cb();
    });
  }

  function initLocale(forced) {
    if (ctx.getLocale()) {
      onReady(forced);
      return;
    }

    var locale = new Locale();

    var code = ctx.currentLocale;

    var l10nLoads = ctx.resLinks.length;

    function onL10nLoaded() {
      l10nLoads--;
      if (l10nLoads <= 0) {
        ctx.locales[code] = locale;
        onReady(forced);
      }
    }

    if (l10nLoads === 0) {
      onL10nLoaded();
      return;
    }

    for (var i = 0; i < ctx.resLinks.length; i++) {
      var path = ctx.resLinks[i];
      var type = path.substr(path.lastIndexOf('.')+1);

      switch (type) {
        case 'json':
          io.loadJSON(path.replace('{{locale}}', code),
                      locale.addJSONResource.bind(locale, onL10nLoaded));
          break;
        case 'properties':
          io.load(path.replace('{{locale}}', code),
                  locale.addPropResource.bind(locale, onL10nLoaded));
          break;
      }
    }
  }

  function relativePath(baseUrl, url) {
    if (url[0] === '/') {
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
    var entries = source.split(iniPatterns.entry);
    var locales = ['en-US'];
    var genericSection = true;
    var uris = [];
    var match;

    for (var i = 0; i < entries.length; i++) {
      var line = entries[i];
      // we only care about en-US resources
      if (genericSection && iniPatterns['import'].test(line)) {
        match = iniPatterns['import'].exec(line);
        var uri = relativePath(iniPath, match[1]);
        uris.push(uri);
        continue;
      }

      // but we need the list of all locales in the ini, too
      if (iniPatterns.section.test(line)) {
        genericSection = false;
        match = iniPatterns.section.exec(line);
        locales.push(match[1]);
      }
    }
    return {
      locales: locales,
      resources: uris
    };
  }

  function onReady(forced) {
    ctx.isReady = true;
    ctx.emitter.emit('ready');
    if (forced || !isPretranslated) {
      translateFragment();
    }

    ctx.fireReady();
    fireLocalizedEvent();
  }

  function fireLocalizedEvent() {
    var event = document.createEvent('Event');
    event.initEvent('localized', false, false);
    event.language = ctx.currentLocale;
    window.dispatchEvent(event);
  }

  function translateFragment(element) {

    element = element || document.documentElement;

    var nodes = getTranslatableChildren(element);

    for (var i = 0; i < nodes.length; i++) {
      var l10nId = nodes[i].getAttribute('data-l10n-id');
      nodes[i].textContent = ctx.get(l10nId);
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

    element.textContent = ctx.get(l10n.id);
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
