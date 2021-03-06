const Buffer = require('buffer').Buffer;
const fs = require('fs');
const gutil = require('gulp-util');
const path = require('path');
const through = require('through');
const parser = require('./parser.js');

const PLUGIN_NAME = 'gulp-closure-deps';

const cache = {};
let cwd, prefix, baseDir;

let extractDependency = function(filePath, contents) {
  return parser.getDependencyCommand(contents, filePath, prefix);
};

module.exports = function(opt) {
  opt = opt || {};
  prefix = opt.prefix || '';
  baseDir = opt.baseDir || '';
  let fileName = opt.fileName || 'deps.js';
  let files = [];

  function bufferContents(file) {
    if (file.isNull()) return;
    if (file.isStream()) {
      return this.emit('error',
        new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
    }
    files.push(file);
  }

  function endStream() {
    if (!files.length) return this.emit('end');

    let firstFile = files[0];
    let lines = [];
    files.forEach(function(file) {
      cwd = file.cwd;
      let contents = file.contents.toString();
      let line = extractDependency(file.path, contents);
      if (!line) return;
      cache[file.path] = line;
      lines.push(line);
    });

    lines.sort();

    let contents = [
      '// This file was autogenerated by gulp-closure-deps plugin.',
      '// Please do not edit.'
    ].concat(lines).join('\n');

    let depsFile = new gutil.File({
      base: firstFile.base,
      contents: new Buffer(contents),
      cwd: firstFile.cwd,
      path: path.join(firstFile.base, fileName)
    });

    this.emit('data', depsFile);
    this.emit('end');
  }

  return through(bufferContents, endStream);
};

module.exports.changed = function(changedFilePath) {
  // We need at least once run deps to get prefix.
  if (!changedFilePath || !prefix) return true;
  let previous = JSON.stringify(cache);
  let contents = fs.readFileSync(changedFilePath, 'utf-8');
  cache[changedFilePath] = extractDependency(changedFilePath, contents);
  return previous != JSON.stringify(cache);
};
