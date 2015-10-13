'use strict';

/* jshint node:true */

import { fetch } from './io';
import L20nParser from '../../lib/format/l20n/entries/parser';
import PropertiesParser from '../../lib/format/properties/parser';
import { Env } from '../../lib/env';

module.exports = {
  fetch,
  parsers: {
    l20n: L20nParser,
    properties: PropertiesParser
  },
  Env
};
