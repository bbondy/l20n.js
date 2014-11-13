'use strict';

/* global Env, io */

if (window.document) {
  init();
}

function init() {
  /* jshint boss:true */
  var nodes = document.head
                      .querySelectorAll('link[rel="localization"],' +
                                        'link[rel="manifest"]');
  for (var i = 0, node; node = nodes[i]; i++) {
    var type = node.getAttribute('rel') || node.nodeName.toLowerCase();
    switch (type) {
      case 'manifest':
        navigator.mozL10n.env = new Env(
          window.document ? document.URL : null,
          io.loadJSON(node.getAttribute('href')));
        break;
      case 'localization':
        navigator.mozL10n.resources.push(node.getAttribute('href'));
        break;
    }
  }

  navigator.mozL10n.request(navigator.languages);
  navigator.mozL10n.observer.start();

  window.addEventListener('languagechange', function langchange() {
    navigator.mozL10n.request(navigator.languages);
  });
}
