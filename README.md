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

Load koa-postcss as with any other koa middleware. Pass a source directory from
which to resolve your source files, the plugins you want to use to process your 
CSS, and a destination directory. If you're using `@import` in your source CSS 
files (i.e. via postcss-import or cssnext), modifying imports will trigger a 
recompile.

The middleware will only apply to requests directly to a CSS file. It resolves
by looking for an input CSS file in your `src` directory that matches the
filename of the CSS file on the request. E.g. requesting /public/css/main.css
in your app will cause the middleware to attempt to process
`/my/source/dir/main.css`.

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
    src: './src/css',
    dest: './public/css',
    plugins: [
        cssImport(),
        autoprefixer({browsers: ['last 2 versions']})
    ]
}));
app.use(serve('./public'));

// GET requests will now recompile /src/css/main.css to /public/css/main.css
// whenever the source file changes, or any of its imports change.

```
