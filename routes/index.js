var express = require('express');
var router = express.Router();
const asyncHandler = require('express-async-handler');
const { MailChimp, GoogleAnalytic } = require('../classes/Main');
const resHandler = require('../services/resHandler');

// GET /
router.get('/', asyncHandler(async (req, res, next) => {
  let ga = new GoogleAnalytic();
  let result = await ga.getGAData("cas", {
    startDate: "2020-11-01",
    endDate: "today",
    metrics: "ga:transactions,ga:transactionsPerSession,ga:transactionRevenue",
    dimensions: "ga:campaign",
    filters: "ga:campaign==0956a861a1-2020_nov3_nopid_once_twice"
  });

  console.log(result.data);


  // let data = await ga.getReportData();
  // console.log(data);

  await resHandler.handleRes(req, res, next, 200, "done");
}));

// POST /import-campaign-report
// body params: site
//
router.post('/import-campaign-report', asyncHandler(async (req, res, next) => {
  let reportData = [], mailchimp = new MailChimp();
  let docs = await mailchimp.getAllCampaignDatabySite(req.body.site, { _id: 1 });

  for (let i = 0; i < docs.length; ++i) {
    let result = (await mailchimp.getReportData(docs[i]._id)).data;

    delete result.bounces.syntax_errors;
    delete result.opens.opens_total;
    delete result.opens.last_open;
    delete result.clicks.clicks_total;
    delete result.clicks.unique_clicks;
    delete result.clicks.last_click;
  
    reportData.push({
      _id: result.id,
      emails_sent: result.emails_sent,
      abuse_reports: result.abuse_reports,
      unsubscribed: result.unsubscribed,
      bounces: result.bounces,
      opens: result.opens,
      clicks: result.clicks
    });
  }

  await resHandler.handleRes(req, res, next, 200, {
    result: await mailchimp.importData("campaignReport", reportData)
  });
}));

// POST /import-campaign-data
// body params: site, startTime
//
router.post('/import-campaign-data', asyncHandler(async (req, res, next) => {
  // Set request timeout as 10 mins
  // The default timeout for nodejs is 2mins and it is not long enough for this request to be done
  // Browser will automatically make another request after timeout and it will cause the script run again asynchronously
  //
  req.setTimeout(600000);

  let mailchimp = new MailChimp();
  let data = await mailchimp.getCampaignData(req.body.site, 300, req.body.startTime, "send_time");
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
        content: (await mailchimp.getCampaignContentData(campaigns[i].id)).data.html
      });
    }
    else if (campaigns[i].type === "variate") {
      let variateContents = [], contents = (await mailchimp.getCampaignContentData(campaigns[i].id)).data.variate_contents;
      contents.forEach(element => variateContents.push(element.html));

      campaignData.push({
        _id: campaigns[i].id,
        list_id: process.env.CAS_AUDIENCE_LIST_ID,
        title: campaigns[i].settings.title,
        type: campaigns[i].type,
        google_analytics: campaigns[i].tracking.google_analytics,
        variate_settings: campaigns[i].variate_settings,
        variate_contents: variateContents
      });
    }
    else {
      invalidCampaign.push({
        id: campaigns[i].id,
        type: campaigns[i].type
      });
    }
  }

  await resHandler.handleRes(req, res, next, 200, {
    result: await mailchimp.importData("campaignData", campaignData),
    invalidCampaign: invalidCampaign
  });
}));

module.exports = router;