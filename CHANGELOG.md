# 0.4.0

Taking a hint from node-sass-middleware, we now only attempt to process css
on requests to actual CSS files. This means that glob source files are no longer
necessary, since we only try to process a source CSS file with the same name
as the CSS file on the request.

E.g. `/public/css/main.css` will look for an input file /my/source/dir/main.css`
. We don't have to play around with ignoring imports now, since each request
will have a single entrypoint.

# 0.3.0

Now using [mkdirp](https://github.com/substack/node-mkdirp) to create the
destination directory if it doesn't already exist.

# 0.2.0

koa-postcss now supports passing globs as src patterns.

# 0.1.0

Initial release. Automatically runs postcss plugins of your choice over a source
CSS file on request, and caches the results in a destination directory.