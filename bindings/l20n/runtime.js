'use strict';

/* exported getDefaultLanguage, getAvailableLanguages */

window.addEventListener('languagechange', navigator.mozL10n);
document.addEventListener('additionallanguageschange', navigator.mozL10n);
document.addEventListener('supportedlanguageschange', navigator.mozL10n);

function init() {
  /* jshint boss:true */
  var nodes = document.head
                      .querySelectorAll('link[rel="localization"]');
  for (var i = 0, node; node = nodes[i]; i++) {
    navigator.mozL10n.resources.push(node.getAttribute('href'));
  }

  navigator.mozL10n.request(navigator.languages);
  navigator.mozL10n.observer.start();
}

// XXX take last found instead of first?
// XXX optimize the number of qS?
function getDefaultLanguage() {
  var meta = document.head.querySelector('meta[name="defaultLanguage"]');
  return meta.getAttribute('content').trim();
}

function getAvailableLanguages() {
  var meta = document.head.querySelector('meta[name="availableLanguages"]');
  return meta.getAttribute('content').split(',').map(
    Function.prototype.call, String.prototype.trim);
}

if (window.document) {
  init();
}
