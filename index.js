let fs = require('fs');
let path = require('path');

let postcss = require('postcss');
let promisify = require('es6-promisify');

// If the input CSS file includes imports, we'll cache them by id so that we can check their mtimes
// for determining if we should recompile the whole file.
let imports = {};

// Convert stat & writeFile into a promise interface so we can yield it in generators
let stat = promisify(fs.stat);
let writeFile = promisify(fs.writeFile);
let readFile = promisify(fs.readFile);

/**
 * Return a Koa middleware configured with the given options:
 * 
 * @param {object} options Configuration object
 * @param {array} options.plugins List of postcss plugins. These are passed as-is to the postcss
 * initialiser, which means you can pass either raw modules, e.g require('cssnext') or configured
 * initialised moduldes, e.g. require('cssnext')({features: {customProperties: false}})
 * @param {string} options.src path to source CSS file, relative to process.cwd()
 * @param {string} options.dest path to write output CSS to, relative to process.cwd()
 * @return {function*} middleware generator function
 */
module.exports = function(options) {
  if (!options.src) {
    throw new Error('koa-postcss: requires options.src file');
  }
  if (!options.dest) {
    throw new Error('koa-postcss: requires options.dest file');
  }
  if (!options.plugins || !(options.plugins instanceof Array)) {
    throw new Error('koa-postcss: must pass an array of postcss plugins');
  }

  let src = path.resolve(process.cwd(), options.src);
  let dest = path.resolve(process.cwd(), options.dest);

  return function*(next) {
    if (this.method === 'GET') {
      let inCss = yield readFile(src, {encoding: 'utf8'});
      let recompile = yield shouldRecompile(src, dest);
      if (recompile) {
        yield markImports(inCss, src);
        let outCss = yield postcss(options.plugins)
          .process(inCss, {from: options.src, to: options.dest});
        yield writeFile(dest, outCss, {encoding: 'utf8'});
      }
    }
    
    yield next;
  };
};

function *shouldRecompile(cssInputPath, cssOutputPath) {
  try {
    let inStats = yield stat(cssInputPath);
    let outStats = yield stat(cssOutputPath);
    let importsChanged = yield checkImports(cssInputPath, cssOutputPath, outStats.mtime);

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

  // If there is no imports array for this object, it hasn't been checked at all, so recompile.
  if (!nodes) {
    return true;
  }

  // However, if the key exists but it's empty, this file has no imports so don't recompile
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

    // If we've found an import in the source, add it to our list of imports to check
    // for this master CSS file.
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

    // Recursively mark imports for any imported files. I'm not suggesting a deep import tree is
    // a good idea, but a single-level of imports doesn't cover every use case.
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
