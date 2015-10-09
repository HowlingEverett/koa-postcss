'use strict';

var fs = require('fs');

var test = require('tape');
var sinon = require('sinon');

var middleware = require('../');

var basicCss = `
.centred-block {
    transition: transform 300 ease-in-out;
    transform: translateX(0);
}
.centred-block:hover {
    transform: translateX(30px);
}
`;

test('Transforms single css file on request', function(t) {
    sinon.stub(fs, 'readFile').yieldAsync(null, basicCss);
    sinon.stub(fs, 'writeFile').yieldAsync(null);
    sinon.stub(fs, 'stat').yieldAsync(null, {
        mtime: Date.now()
    });

    fs.readFile.restore();
    fs.writeFile.restore();
    t.end();
});