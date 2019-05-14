const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

module.exports = {
  // props
  results: {},
  key: '',

  // public methods
  init(key) {
    this.key = key;
    this.results = {};
  },
  finish() {
    this._writeFile();
  },
  saveResult(type, result) {
    console.log(chalk`  => The test '${type}' finished {green successfuly} in {cyan ${result.duration.toFixed(4)}s}`);
    this.results[type] = result;
    this._writeFile();
  },

  // private methods
  _writeFile() {
    fs.writeFileSync(
      this._getPath(), 
      JSON.stringify(this.results), 
      { encoding: 'utf-8' }
    );
  },
  _getPath() {
    const curr = __dirname;

    return path.join(curr, `../results/${this.key}.json`);
  }
}