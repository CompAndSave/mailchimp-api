var express = require('express');
var router = express.Router();
const asyncHandler = require('express-async-handler');
const axios = require('axios');
const { MailChimp } = require('../classes/Main');
const resHandler = require('../services/resHandler');

// GET /
router.get('/', asyncHandler(async (req, res, next) => {
  let result = await axios.get(`${process.env.MC_API_URL}campaigns?&count=100&since_send_time=2020-01-01 00:00:00&list_id=ff7c1a4442&sort_field=send_time`, {
    auth: {
      username: process.env.MC_USERNAME,
      password: process.env.MC_API_KEY
    }
  }).catch(err => console.log(err));

  // console.log(result.data);
  let mailchimp = new MailChimp();
  let data = await mailchimp.getListData();
  console.log(data);

  await resHandler.handleRes(req, res, next, 200, "done");
}));

module.exports = router;