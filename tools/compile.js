#!/usr/bin/env node

'use strict';

var fs = require('fs');
var program = require('commander');
var colors = require('colors');

var PropertiesParser =
  require('../lib/l20n/format/properties/parser').PropertiesParser;

var propParser = new PropertiesParser();
var parse = propParser.parse.bind(null, null);
var Resolver = require('../lib/l20n/resolver');
var createEntries = require('../lib/l20n').createEntries;
var getPluralRule = require('../lib/l20n/plurals').getPluralRule;

program
  .version('0.0.1')
  .usage('[options] [file]')
  .option('-d, --data <file>', 'Context data to use (.json)')
  .option('-a, --ast', 'Treat input as AST, not source code')
  .option('-n, --no-color', 'Print without color')
  .option('-l, --with-local', 'Print local entities and attributes')
  .option('-p, --plural <locale>', 'Select the plural rule [en-US]', 'en-US')
  .parse(process.argv);


var data = {};
if (program.data) {
  data = JSON.parse(fs.readFileSync(program.data, 'utf8'));
}

var VALUE;
var ID = 'cyan';
var ERROR = 'red';

function color(str, col) {
  if (program.color && col && str) {
    return str[col];
  }
  return str;
}

function logError(err) {
  var message  = ': ' + err.message.replace('\n', '');
  var name = err.name + (err.entry ? ' in ' + err.entry : '');
  console.warn(color(name + message, ERROR));
}

function singleline(str) {
  return str && str.replace(/\n/g, ' ')
                   .replace(/\s{3,}/g, ' ')
                   .trim();
}

function format(entity) {
  return singleline(Resolver.formatValue(entity, data));
}

function print(id, entity) {
  // print the string value of the entity
  console.log(color(id, ID), color(format(entity), VALUE));
  // print the string values of the attributes
  for (var attr in entity.attrs) {
    console.log(color(' ::' + attr, ID),
                color(format(entity.attrs[attr]), VALUE));
  }
}

function compileAndPrint(err, code) {
  if (err) {
    return console.error('File not found: ' + err.path);
  }

  var ast;
  if (program.ast) {
    ast = code.toString();
  } else {
    try {
      ast = parse(code.toString());
    console.log(ast);
    } catch (e) {
      logError(e);
    }
  }

  var entries = createEntries(ast);
  entries.__plural = getPluralRule('en-US');
  for (var id in entries) {
    if (id.indexOf('__') === 0) {
      continue;
    }
    print(id, entries[id]);
  }
}

if (program.args.length) {
  fs.readFile(program.args[0], compileAndPrint);
} else {
  process.stdin.resume();
  process.stdin.on('data', compileAndPrint.bind(null, null));
}
