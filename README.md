# PostCSS Koa Middleware

This middleware runs source CSS through a PostCSS plugin pipeline, and caches the results,
re-running only when you've udpated the source files.

## Installation

koa-postcss is available on npm:

```
npm install koa-postcss postcss
```

*Note:* PostCSS is a peer dependency, so you control what version to install
into your project. However, koa-postcss only supports PostCSS >5.0.

## Usage

Load koa-postcss as with any other koa middleware. Pass a single file or a glob
as the src option, the plugins you want to use to process your CSS, and a
destination directory. If you're using `@import` in your source CSS files (i.e.
via postcss-import or cssnext), modifying imports will trigger a recompile.

You'll also want to use a static file middleware to serve the processed CSS.

```node
var koa = require('koa');
var postcss = require('koa-postcss');
var cssImport = require('postcss-import');
var autoprefixer = require('autoprefixer');
var serve = require('koa-static');

var app = koa();

// koa-postcss middleware. src, dest, and plugins are all required
app.use(postcss({
    src: './src/css/*.css',
    dest: './public/css',
    plugins: [
        cssImport(),
        autoprefixer({browsers: ['last 2 versions']})
    ]
}));
app.use(serve('./public'));

// GET requests will now recompile /src/css/main.css to /public/css/main.css whenever the source
// file changes, or any of its imports change.

```

## Imports

If you're using `@import`, don't try to include your import files in the `src`
glob, or the middleware will unnecessarily process these files separately and
write them to your dest directory. Either use a glob that won't match these
files, or optionally exclude your imports in the optional 'ignore' option. This
pattern or array of patterns will be passed directly to
glob: https://github.com/isaacs/node-glob

```js
app.use(postcss({
    src: './src/css/*.css',
    dest: './public',
    plugins: [
        cssImport(),
        autoprefixer({browsers: ['last 2 versions']})
    ],
    ignore: [
        './src/css/import.css',
        './src/css/other-import.css'
    ]
}));
```
