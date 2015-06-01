'use strict';

module.exports = {
  stage: {
    files: [
      {
        expand: true,
        cwd: 'build/dist/gobble/runtime/web/',
        src: ['index.js'],
        dest: 'build/dist/stage/shared/js/',
        rename: function(dest) {
          return dest + 'l20n.js';
        }
      },
      {
        expand: true,
        cwd: 'tests/',
        src: '**',
        dest: 'build/dist/stage/apps/sharedtest/test/unit/l10n/'
      }
    ]
  }
};
