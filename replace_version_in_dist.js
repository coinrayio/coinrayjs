const fs = require('fs');
const replace = require('replace-in-file');

var pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const changes = replace.sync({
  files: 'dist/coinray.js',
  from: '___COINRAYJS_VERSION___',
  to: pkg.version
});

console.log(changes);
