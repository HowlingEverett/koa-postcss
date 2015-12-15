"use strict";

let fs = require("fs");
let path = require("path");

let should = require("should");
let agent = require("supertest-koa-agent");
let koa = require("koa");
let autoprefixer = require("autoprefixer");

let postcss = require("../index");

describe("PostCSS Koa Middleware", () => {
  let request;
  before(() => {
    let app = koa();
    app.use(postcss({
      src: "./fixtures",
      dest: "./fixtures/out",
      cwd: __dirname,
      plugins: [
        autoprefixer()
      ]
    }));
    app.use(function*() {
      this.body = "Ok";
    });
    request = agent(app);
  });

  it("should pass through requests that aren't to CSS files", (done) => {
    request.get("/path/to/app")
      .end(() => {
        fs.stat(path.join(__dirname, "fixtures/out/test.css"), (err) => {
          should.exist(err);
          err.code.should.match(/ENOENT/);
          done();
        });
      });
  });

  it("should write output file with the same name as the requested file",
    (done) => {
      request.get("/public/css/test.css")
        .end(() => {
          fs.stat(path.resolve(__dirname, "fixtures/out/test.css"),
            (err, stat) => {
              should.not.exist(err);
              should.exist(stat);
              done();
            });
        });
    });

  it("should process the input file with provided PostCSS plugins", (done) => {
    request.get("/public/css/test.css")
      .end(() => {
        fs.readFile(path.resolve(__dirname, "fixtures/out/test.css"), "utf8",
          (err, content) => {
            should.not.exist(err);
            content.should.match(/-webkit-transform/);
            content.should.match(/-webkit-filter/);
            done();
          });
      });
  });

  afterEach((done) => {
    fs.unlink(path.resolve(__dirname, "fixtures/out/test.css"), () => {
      done();
    });
  });
});