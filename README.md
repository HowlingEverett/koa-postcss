# PostCSS Koa Middleware

This middleware runs source CSS through a PostCSS plugin pipeline, and caches the results. It
simply 

## Installation

koa-postcss is available on npm:

```
npm install koa-postcss
```

## Usage

Load koa-postcss as with any other koa middleware. At the moment, it only supports processing a
single source entrypoint per config (that will probably change soon, though), but if you use
@imports in your CSS with a relevant postcss plugin, changing your imports will correctly trigger
a re-run.

You'll also want to use a static file middleware to serve the processed CSS.

```
var koa = require('koa');
var postcss = require('koa-postcss');
var import = require('postcss-import');
var autoprefixer = require('autoprefixer');
var serve = require('koa-static');

var app = koa();

// koa-postcss middleware. src, dest, and plugins are all required
app.use({
    src: './src/css/main.css',
    dest: './public/css/main.css',
    plugins: [
        import(),
        autoprefixer({browsers: ['last 2 versions']})
    ]
});
app.use(serve('./public'));

// GET requests will now recompile /src/css/main.css to /public/css/main.css whenever the source
// file changes, or any of its imports change.

```

