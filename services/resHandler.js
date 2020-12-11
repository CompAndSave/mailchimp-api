// const { Log } = require('cas-common-lib');

async function handleRes(req, res, next, status, messageJSON, err) {
  Promise.resolve().then(()=>{
    // if (err) { Log.log(req.originalUrl, err); }
    if (err) { console.log(err); }
    res.status(status);
    res.json(messageJSON);
  }).catch(next);
}

module.exports = { handleRes };