const MongoDB = require('./mongoDB/MongoDB');
const MailChimp = require('./mailchimp/MailChimp');
const GoogleAnalytic = require('./googleAnalytic/GoogleAnalytic');

module.exports = {
  MongoDB,
  MailChimp,
  GoogleAnalytic
};