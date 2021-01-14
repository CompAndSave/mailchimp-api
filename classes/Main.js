const MongoDB = require('./mongoDB/MongoDB');
const GoogleAnalytic = require('./googleAnalytic/GoogleAnalytic');
const ImportData = require('./ops/ImportData');

module.exports = {
  MongoDB,
  GoogleAnalytic,
  ImportData
};