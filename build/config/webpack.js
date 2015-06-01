'use strict';

// resolve relative to build/config
var path = require('path').resolve.bind(null, __dirname);

module.exports = {
  web: {
    context: path('../../src'),
    entry: {
      web: './runtime/web/index.js',
    },
    output: {
      path: path('../dist'),
      filename: 'webpack/[name]/l20n.js',
      libraryTarget: 'this',

    },
    module: {
      loaders: [{ 
        test: /\.js$/,
        include: [
          path('../../src')
        ],
        loader: 'babel',
      }]
    }
  },
  gaia: {
    context: path('../../src'),
    entry: {
      gaia: './runtime/web/index.js',
    },
    output: {
      path: path('../dist'),
      filename: 'webpack/[name]/l20n.js',
      libraryTarget: 'this',

    },
    module: {
      loaders: [{ 
        test: /\.js$/,
        include: [
          path('../../src')
        ],
        loader: 'babel',
        query: {
          comments: false,
          whitelist: [
            'strict',
            'es6.modules',
            'es6.destructuring',
            'es6.arrowFunctions',
            'es6.properties.shorthand',
            'es6.forOf',
            'es6.spread',
            'es6.parameters.rest',
            'es6.blockScoping'
          ],
        }
      }]
    }
  },
  shell: {
    context: path('../../src'),
    entry: {
      shell: './bindings/node/index.js',
    },
    output: {
      path: path('../dist'),
      filename: 'webpack/[name]/l20n.js',
      libraryTarget: 'commonjs2',
    },
    externals: {
      'fs': true
    },
    module: {
      loaders: [{ 
        test: /\.js$/,
        include: [
          path('../../src')
        ],
        loader: 'babel'
      }]
    }
  },
};
