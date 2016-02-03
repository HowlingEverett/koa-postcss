"use strict";

let fs = require("fs");
let path = require("path");

let co = require("co");
let postcss = require("postcss");
let promisify = require("es6-promisify");
var mkdirp = promisify(require("mkdirp"));

// Convert stat & writeFile into a promise interface so we can yield it in
// generators
let stat = promisify(fs.stat);
let writeFile = promisify(fs.writeFile);
let readFile = promisify(fs.readFile);

/**
 * Return a Koa middleware configured with the given options:
 *
 * @param {object} options Configuration object
 * @param {array} options.plugins List of postcss plugins. These are passed
 * as-is to the postcss initialiser, which means you can pass either raw
 * modules, e.g require("cssnext") or configured initialised moduldes,
 * e.g. require("cssnext")({features: {customProperties: false}})
 * @param {string} options.src path to source CSS file, relative to
 * process.cwd()
 * @param {string} options.dest path to write output CSS to, relative to
 * process.cwd()
 * @return {function*} middleware generator function
 */
module.exports = function(options) {
  if (!options.src) {
    throw new Error("koa-postcss: requires options.src directory " +
      "(base for finding input css files)");
  }
  if (!options.dest) {
    throw new Error("koa-postcss: requires options.dest directory");
  }
  if (!options.plugins || !(options.plugins instanceof Array)) {
    throw new Error("koa-postcss: must pass an array of postcss plugins");
  }

  return function*(next) {

    // Pass through if the request isn't to a CSS file
    let cssPath = this.path;
    if (!/\.css$/.test(cssPath)) {
      return yield next;
    }

    options.cwd = options.cwd || process.cwd();
    options.dest = path.resolve(options.cwd, options.dest);

    let file = path.basename(cssPath);

    yield processPromise(file, options);
    yield next;
  };
};

function processPromise(inputFile, options) {
  let src = path.resolve(options.cwd, options.src, inputFile);
  let out = path.resolve(options.cwd, options.dest, inputFile);
  let inCss;
  return co(shouldRecompile(src, out))
    .then(function(recompile) {
      if (!recompile) {
        throw new FileNotDirtyError("This file does not require recompiling");
      }
      return readFile(src, {encoding: "utf8"});
    })
    .then(function(css) {
      inCss = css;
      return mkdirp(options.dest);
    })
    .then(function() {
      return postcss(options.plugins)
        .process(inCss, {from: options.src, to: options.dest});
    })
    .then(function(processedCss) {
      let destFile = path.resolve(options.dest, path.basename(src));
      return writeFile(destFile, processedCss, {encoding: "utf8"});
    }).catch(error => {
      // If we short-circuited because of a FileNotDirtyError, return a value
      // that will be automatically resolved as a "successful" promise
      if (error instanceof FileNotDirtyError) {
        return true;
      }
      // Otherwise it"s a real error so throw on
      throw error;
    });
}

class FileNotDirtyError extends Error {
  constructor(message) {
    super(message);

    this.name = "FileNotDirtyError";
    this.message = message;
  }
}

function *shouldRecompile(cssInputPath, cssOutputPath) {
  try {
    let inStats = yield stat(cssInputPath);
    let outStats = yield stat(cssOutputPath);
    if (inStats.mtime > outStats.mtime) {
      return true;
    }
  } catch (e) {
    if (e.code === "ENOENT") {
      // Compiled CSS Doesn"t exist, so compile it!
      return true;
    } else {
      throw e;
    }
  }
}
