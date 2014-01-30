'use strict';

module.exports = {
  options: {
    separator: '',
    banner: '' +
      '/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */\n' +
      '/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */\n' +
      '(function(window, undefined) {\n \'use strict\';\n\n',
    footer: '})(this);',
    process: function(src) {
      src = src.replace(
        /var .* = require.*;/g,
        '');
      src = src.replace(
        /exports.*;/g,
        '');
      src = src.replace(
        /'use strict';/g,
        '');
      return src;
    }
  },
  dist: {
    src: [
      'lib/client/l20n/platform/io.js',
      'lib/l20n/events.js',
      'lib/l20n/parser.js',
      'lib/l20n/compiler.js',
      'lib/l20n/context.js',
      'bindings/l20n/webl10n.js',
    ],
    dest: 'dist/webl10n/l10n.js',
  },
};