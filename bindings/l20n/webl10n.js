define(function (require, exports, module) {
  'use strict';


  var L20n = require('../l20n');

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

});
