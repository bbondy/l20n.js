'use strict';

/* global translateFragment, translateElement */

function MozL10nMutationObserver() {
  this._observer = null;
}

MozL10nMutationObserver.prototype.start = function() {
  if (!this._observer) {
    this._observer =
      new MutationObserver(onMutations.bind(navigator.mozL10n));
  }
  return this._observer.observe(document, this.CONFIG);
};

MozL10nMutationObserver.prototype.stop = function() {
  return this._observer.disconnect();
};

MozL10nMutationObserver.prototype.CONFIG = {
  attributes: true,
  characterData: false,
  childList: true,
  subtree: true,
  attributeFilter: ['data-l10n-id', 'data-l10n-args']
};

function onMutations(mutations) {
  var mutation;

  for (var i = 0; i < mutations.length; i++) {
    mutation = mutations[i];
    if (mutation.type === 'childList') {
      var addedNode;

      for (var j = 0; j < mutation.addedNodes.length; j++) {
        addedNode = mutation.addedNodes[j];

        if (addedNode.nodeType !== Node.ELEMENT_NODE) {
          continue;
        }

        if (addedNode.childElementCount) {
          translateFragment.call(this, addedNode);
        } else if (addedNode.hasAttribute('data-l10n-id')) {
          translateElement.call(this, addedNode);
        }
      }
    }

    if (mutation.type === 'attributes') {
      translateElement.call(this, mutation.target);
    }
  }
}
