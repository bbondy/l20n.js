'use strict';

module.exports = {
  web: {
    dest: 'build/dist/gobble',
    force: true,
    config: function () {
      var gobble = require('gobble');
      return  gobble('src').transform('esperanto-bundle', {
        entry: 'runtime/web/index.js',
        sourceMap: false,
        strict: true,
        type: 'cjs',
        banner: '(function() {\n',
        footer: '\n})();'
      });
    }
  },
};
