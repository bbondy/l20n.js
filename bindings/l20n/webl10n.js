  'use strict';

  var Context = require('./context').Context;
  var io = require('./platform/io');

  var isPretranslated = false;
  // http://www.w3.org/International/questions/qa-scripts
  // Arabic, Hebrew, Farsi, Pashto, Urdu
  var rtlList = ['ar', 'he', 'fa', 'ps', 'ur'];

  var ctx = new Context();


  /* mozL10n public API */

  navigator.mozL10n = {
    translate: translateFragment,
    localize: localizeElement,
    get: ctx.get.bind(ctx),
    ready: ctx.ready.bind(ctx),
    get readyState() {
      if (!ctx.isFrozen) {
        return 'loading';
      }
      if (!ctx.isReady) {
        return 'interactive';
      }
      return 'complete';
    },
    language: {
      set code(lang) {
        ctx.setLocale(lang);
        initLocale(true);
      },
      get code() {
        return ctx.supportedLocales[0];
      },
      get direction() {
        return getDirection(ctx.supportedLocales[0]);
      }
    }
  };

  function getDirection(lang) {
    return (rtlList.indexOf(lang) >= 0) ? 'rtl' : 'ltr';
  }


  /* Initialization */

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

  if (window.document) {
    isPretranslated = (document.documentElement.lang === navigator.language);

    ctx.setLocale(navigator.language);
    document.documentElement.lang = ctx.supportedLocales[0];
    document.documentElement.dir = getDirection(ctx.supportedLocales[0]);

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
        navigator.mozL10n.language.code = event.settingValue;
      });
    }
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
    var body = document.body;
    var script = body.querySelector('script[type="application/l10n"][lang="' +
                                    ctx.supportedLocales[0] + '"]');
    if (!script) {
      return false;
    }
    var locale = ctx.getLocale();
    locale.addAST(JSON.parse(script.innerHTML));
    locale.isReady = true;
    translateFragment();
    locale.isReady = false;
    isPretranslated = true;
    return true;
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
    if (iniLoads === 0) {
      cb();
      return;
    }

    function onIniLoaded() {
      iniLoads--;
      if (iniLoads <= 0) {
        cb();
      }
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

  function initLocale(forced) {
    ctx.freeze(onReady.bind(null, forced));
    document.documentElement.lang = ctx.supportedLocales[0];
    document.documentElement.dir = getDirection(ctx.supportedLocales[0]);
  }

  function onReady(forced) {
    if (forced || !isPretranslated) {
      translateFragment();
    }

    fireLocalizedEvent();
  }

  function fireLocalizedEvent() {
    var event = document.createEvent('Event');
    event.initEvent('localized', false, false);
    event.language = ctx.supportedLocales[0];
    window.dispatchEvent(event);
  }


  /* API for webapp-optimize */

  navigator.mozL10n.init = function(callback) {
    ctx = new Context();
    ctx.isRuntime = false;
    initDocumentLocalization(callback);
  };

  navigator.mozL10n.getDictionary = function(fragment) {
    var ast = {};

    if (!fragment) {
      var sourceLocale = ctx.getLocale(ctx.supportedLocales.length - 1);
      if (!sourceLocale.isReady) {
        sourceLocale.build(null);
      }
      // iterate over all strings in en-US
      for (var id in sourceLocale.ast) {
        ast[id] = ctx.getEntitySource(id);
      }
      return ast;
    }

    // don't build inline JSON for default language
    if (ctx.supportedLocales[0] === 'en-US') {
      return {};
    }
    var elements = getTranslatableChildren(fragment);

    for (var i = 0; i < elements.length; i++) {
      var attrs = getL10nAttributes(elements[i]);
      var val = ctx.getEntitySource(attrs.id);
      ast[attrs.id] = val;
    }
    return ast;
  };


  /* DOM translation functions */

  function translateFragment(element) {
    element = element || document.documentElement;

    translateElement(element);
    var nodes = getTranslatableChildren(element);
    for (var i = 0; i < nodes.length; i++) {
      translateElement(nodes[i]);
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

    var entity = ctx.getEntity(l10n.id);

    if (entity.value) {
      element.textContent = entity.value;
    }

    for (var key in entity.attributes) {
      if (entity.attributes.hasOwnProperty(key)) {
        var attr = entity.attributes[key];
        var pos = key.indexOf('.');
        if (pos !== -1) {
          element[key.substr(0, pos)][key.substr(pos + 1)] = attr;
        } else {
          element[key] = attr;
        }
      }
    }
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

    if (ctx.isReady) {
      translateElement(element);
    }
  }
