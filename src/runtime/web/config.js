'use strict';

/* jshint node:true */

var bundle = require('../../../build/babel/bundle');

module.exports = {
  web: {
    options: bundle,
    files: {
      'dist/bundle/web/l20n.js': 'src/runtime/web/index.js',
      'dist/bundle/web/l20n-parser.js': 'src/runtime/web/parser.js',
      'dist/bundle/web/l20n-parser-properties.js':
        'src/runtime/web/properties.js',
    }
  },
  webcommon: {
    options: bundle,
    files: {
      'dist/bundle/web/l20n-common.js': 'src/runtime/web/api.js'
    }
  },
};
