/* eslint-disable */
const fs = require('fs');

function copy() {
  fs.readdirSync('./static').forEach(fileName => fs.copyFileSync('./static/' + fileName, './dist/' + fileName));
  console.log('Copied static files.');
}

copy();
fs.watch('./static', copy);
