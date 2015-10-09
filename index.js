'use strict';

let fs = require('fs');
let path = require('path');

var ohMyGlob = require('glob');
let postcss = require('postcss');
let promisify = require('es6-promisify');
var mkdirp = promisify(require('mkdirp'));

// If the input CSS file includes imports, we'll cache them by id so that we
// can check their mtimes for determining if we should recompile the whole file.
let imports = {};

// Convert stat & writeFile into a promise interface so we can yield it in
// generators
let stat = promisify(fs.stat);
let writeFile = promisify(fs.writeFile);
let readFile = promisify(fs.readFile);
let glob = promisify(ohMyGlob);

/**
 * Return a Koa middleware configured with the given options:
 * 
 * @param {object} options Configuration object
 * @param {array} options.plugins List of postcss plugins. These are passed 
 * as-is to the postcss initialiser, which means you can pass either raw 
 * modules, e.g require('cssnext') or configured initialised moduldes,
 * e.g. require('cssnext')({features: {customProperties: false}})
 * @param {string} options.src path to source CSS file, relative to
 * process.cwd()
 * @param {string} options.dest path to write output CSS to, relative to
 * process.cwd()
 * @return {function*} middleware generator function
 */
module.exports = function(options) {
  if (!options.src) {
    throw new Error('koa-postcss: requires options.src path (file or glob)');
  }
  if (!options.dest) {
    throw new Error('koa-postcss: requires options.dest directory');
  }
  if (!options.plugins || !(options.plugins instanceof Array)) {
    throw new Error('koa-postcss: must pass an array of postcss plugins');
  }

  return function*(next) {
    if (this.method !== 'GET') {
      return yield next;
    }

    options.cwd = options.cwd || process.cwd();
    options.dest = path.resolve(options.cwd, options.dest);
    let files = yield glob(options.src, options);
    yield Promise.all(files.map(function(file) {
      return processPromise(file, options);
    }));
    yield next;
  };
};

function processPromise(inputFile, options) {
  let src = path.resolve(options.cwd, inputFile);
  let inCss;
  try {
    return readFile(src, {encoding: 'utf8'})
      .then(function(css) {
        inCss = css;
        return shouldRecompile(src, options.dest);
      })
      .then(function(recompile) {
        if (!recompile) {
          throw new FileNotDirtyError('This file does not require recompiling');
        }
        return markImports(inCss, src);
      })
      .then(function() {
        return mkdirp(options.dest);
      })
      .then(function() {
        return postcss(options.plugins)
          .process(inCss, {from: options.src, to: options.dest});
      })
      .then(function(processedCss) {
        let destFile = path.resolve(options.dest, path.basename(src));
        return writeFile(destFile, processedCss, {encoding: 'utf8'});
      });
  } catch (error) {
    // If we short-circuited because of a FileNotDirtyError, return a value
    // that will be automatically resolved as a 'successful' promise
    if (error instanceof FileNotDirtyError) {
      return true;
    }
    // Otherwise it's a real error so throw on
    throw error;
  }
}

function FileNotDirtyError(message) {
  this.name = 'FileNotDirtyError';
  this.message = message;
  this.stack = (new Error()).stack;
}
FileNotDirtyError.prototype = Object.create(Error.prototype);
FileNotDirtyError.prototype.constructor = FileNotDirtyError;

function *shouldRecompile(cssInputPath, cssOutputPath) {
  try {
    let inStats = yield stat(cssInputPath);
    let outStats = yield stat(cssOutputPath);
    let importsChanged = yield checkImports(cssInputPath, cssOutputPath,
      outStats.mtime);

    if (inStats.mtime > outStats.mtime || importsChanged) {
      return true;
    }
  } catch (e) {
    if (e.code === 'ENOENT') {
      // Compiled CSS Doesn't exist, so compile it!
      return true;
    } else {
      throw e;
    }
  }
}

function *checkImports(cssInputPath, cssOutputPath, outputMtime) {
  let nodes = imports[cssInputPath];

  // If there is no imports array for this object, it hasn't been checked at
  // all, so recompile.
  if (!nodes) {
    return true;
  }

  // However, if the key exists but it's empty, this file has no imports so
  // don't recompile
  if (nodes.length === 0) {
    return false;
  }

  // Otherwise determine if we need to recompile based on the imports
  for (let i = 0; i < nodes.length; i++) {
    let imported = nodes[i];
    let importedMtime = yield stat(imported);
    let importDirty = importedMtime > outputMtime;
    if (!importDirty) {
      importDirty = yield shouldRecompile(imported, cssOutputPath);
    }
    if (importDirty) {
      return true;
    }
  }
  return false;
}

function *markImports(cssContent, cssSrcPath) {
  let rootNode = postcss.parse(cssContent);
  for (let cssNode of rootNode.nodes) {
    // Ignore every node except @imports
    if (cssNode.type !== 'atrule' || cssNode.name !== 'import') {
      continue;
    }

    // If we've found an import in the source, add it to our list of imports to
    // check for this master CSS file.
    if (!imports[cssSrcPath]) {
      imports[cssSrcPath] = [];
    }
    let cssImport = cssNode.params.replace(/'|"/g, '');
    imports[cssSrcPath] = cssImport;
    let importPath = cssImport;
    if (!path.extname(cssImport)) {
      importPath = cssImport + '.css';
    }
    let subContent, subFilePath;

    // Recursively mark imports for any imported files. I'm not suggesting a
    // deep import tree is a good idea, but a single-level of imports doesn't
    // cover every use case.
    try {
      let cssSrcDirectory = path.dirname(cssSrcPath);
      subFilePath = path.resolve(cssSrcDirectory, importPath);
      subContent = yield readFile(subFilePath, {encoding: 'utf8'});
    } catch (e) {
      console.warn('Couldn\'t resolve', subFilePath, 'relative to src.');
    } finally {
      yield markImports(subContent, subFilePath);
    }
  }
}
