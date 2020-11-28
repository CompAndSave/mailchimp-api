var express = require('express');
var router = express.Router();
const asyncHandler = require('express-async-handler');
const { timer } = require('cas-common-lib');
const { MailChimp } = require('../classes/Main');
const resHandler = require('../services/resHandler');

// GET /
router.get('/', asyncHandler(async (req, res, next) => {
  // Set request timeout as 10 mins
  // The default timeout for nodejs is 2mins and it is not long enough for this request to be done
  // Browser will automatically make another request after timeout and it will cause the script run again asynchronously
  //
  req.setTimeout(600000);

  const startTime = new Date();

  let mailchimp = new MailChimp();
  let data = await mailchimp.getCampaignData("cas", 300, "2020-01-01 00:00:00", "send_time");
  let campaigns = data.campaigns;

  let campaignData = [], invalidCampaign = [];
  for (let i = 0; i < campaigns.length; ++i) {
    if (campaigns[i].type === "regular") {
      campaignData.push({
        _id: campaigns[i].id,
        list_id: process.env.CAS_AUDIENCE_LIST_ID,
        title: campaigns[i].settings.title,
        type: campaigns[i].type,
        subject_line: campaigns[i].settings.subject_line,
        preview_text: campaigns[i].settings.preview_text,
        send_time: campaigns[i].send_time,
        google_analytics: `${campaigns[i].id}-${campaigns[i].tracking.google_analytics}`,
        content: (await mailchimp.getCampaignContentData(campaigns[i].id)).data.plain_text
      });
      await timer.timeout(1000);
    }
    else if (campaigns[i].type === "variate") {
      campaignData.push({
        _id: campaigns[i].id,
        list_id: process.env.CAS_AUDIENCE_LIST_ID,
        title: campaigns[i].settings.title,
        type: campaigns[i].type,
        google_analytics: campaigns[i].tracking.google_analytics,
        variate_settings: campaigns[i].variate_settings,
        variate_contents: (await mailchimp.getCampaignContentData(campaigns[i].id)).data.variate_contents
      });
      await timer.timeout(1000);
    }
    else {
      invalidCampaign.push({
        id: campaigns[i].id,
        type: campaigns[i].type
      });
    }
  }

  const endTime = new Date();
  let usedTime = endTime - startTime;

  console.log(campaignData.length);
  console.log(`${usedTime} ms is used`);

  if (invalidCampaign.length > 0) {
    console.log("Here is the list of campaign with invalid campaign type");
    console.log(invalidCampaign);
  }

  res.json(await mailchimp.insertCampaignData(campaignData));

  // await resHandler.handleRes(req, res, next, 200, "done");
}));

module.exports = router;