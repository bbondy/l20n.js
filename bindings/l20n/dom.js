'use strict';

/* jshint -W104 */
/* global Promise, L10nError, dispatchEvent */
/* exported translateFragment, translateDocument */
/* exported setL10nAttributes, getL10nAttributes */

function setL10nAttributes(element, id, args) {
  element.setAttribute('data-l10n-id', id);
  if (args) {
    element.setAttribute('data-l10n-args', JSON.stringify(args));
  }
}

function getL10nAttributes(element) {
  return {
    id: element.getAttribute('data-l10n-id'),
    args: JSON.parse(element.getAttribute('data-l10n-args'))
  };
}

function getTranslatables(element) {
  var nodes = [];

  if (element.hasAttribute('data-l10n-id')) {
    nodes.push(element);
  }

  return nodes.concat.apply(
    nodes, element.querySelectorAll('*[data-l10n-id]'));
}

function translateDocument(supported) {
  document.documentElement.lang = supported[0];
  document.documentElement.dir = getDirection(supported[0]);
  return translateFragment.call(this, document.documentElement).then(
      dispatchEvent.bind(this, 'mozDOMLocalized', supported));
}


function translateFragment(element) {
  return Promise.all(
    getTranslatables(element).map(
      translateElement.bind(this)));
}

function translateElement(element) {
  var l10n = getL10nAttributes(element);

  if (!l10n.id) {
    return false;
  }

  return this.ctx.formatEntity(l10n.id, l10n.args).then(function(entity) {
    this.observer.stop();

    if (typeof entity === 'string') {
      setTextContent(l10n.id, element, entity);
    } else if (entity.value) {
      setTextContent(l10n.id, element, entity.value);
    }

    for (var key in entity.attrs) {
      var attr = entity.attrs[key];
      if (key === 'ariaLabel') {
        element.setAttribute('aria-label', attr);
      } else if (key === 'innerHTML') {
        // XXX: to be removed once bug 994357 lands
        element.innerHTML = attr;
      } else {
        element.setAttribute(key, attr);
      }
    }

    this.observer.start();
  }.bind(this));
}

function setTextContent(id, element, text) {
  if (element.firstElementChild) {
    throw new L10nError(
      'setTextContent is deprecated (https://bugzil.la/1053629). ' +
      'Setting text content of elements with child elements is no longer ' +
      'supported by l10n.js. Offending data-l10n-id: "' + id +
      '" on element ' + element.outerHTML + ' in ' + this.ctx.id);
  }

  element.textContent = text;
}
