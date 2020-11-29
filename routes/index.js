var express = require('express');
var router = express.Router();
const asyncHandler = require('express-async-handler');
const { MailChimp, GoogleAnalytic } = require('../classes/Main');
const resHandler = require('../services/resHandler');

function decodeGaKey(gaKey) {
  let regex = new RegExp(`^([\\d]{4})_([\\w]{3})(\\d)_(.*)$`);
  let match = gaKey.match(regex);
  let result = {};

  result.year = Number(match[1]);
  result.month = match[2];
  result.promo_num = Number(match[3]);
  result.segment = match[4];

  switch (result.month) {
    case "jan":
      result.month = 1;
      result.quarter = 1;
      break;
    case "feb":
      result.month = 2;
      result.quarter = 1;
      break;
    case "mar":
      result.month = 3;
      result.quarter = 1;
      break;
    case "apr":
      result.month = 4;
      result.quarter = 2;
      break;
    case "may":
      result.month = 5;
      result.quarter = 2;
      break;
    case "jun":
      result.month = 6;
      result.quarter = 2;
      break;
    case "jul":
      result.month = 7;
      result.quarter = 3;
      break;
    case "aug":
      result.month = 8;
      result.quarter = 3;
      break;
    case "sep":
      result.month = 9;
      result.quarter = 3;
      break;
    case "oct":
      result.month = 10;
      result.quarter = 4;
      break;
    case "nov":
      result.month = 11;
      result.quarter = 4;
      break;
    case "dec":
      result.month = 12;
      result.quarter = 4;
      break;
    default: throw new Error(`invalid-month-${result.month}`);
  }

  return result;
}

// variateParams is an object like following
// {
//   type: "variate-parent",
//   child_ids: ["123546asd", "789486asd"]
// }
//
// {
//   type: "variate-child",
//   parent_id: "ajkajs123"
// }
//
function formatCampaignReportData(campaignData, reportData, variateParams) {
  delete reportData.bounces.syntax_errors;
  delete reportData.opens.opens_total;
  delete reportData.opens.last_open;
  delete reportData.clicks.clicks_total;
  delete reportData.clicks.unique_clicks;
  delete reportData.clicks.last_click;

  let res = {
    _id: reportData.id,
    type: variateParams ? variateParams.type : campaignData.type,
    year: campaignData.year,
    quarter: campaignData.quarter,
    month: campaignData.month,
    promo_num: campaignData.promo_num,
    segment: campaignData.segment,
    emails_sent: reportData.emails_sent,
    abuse_reports: reportData.abuse_reports,
    unsubscribed: reportData.unsubscribed,
    bounces: reportData.bounces,
    opens: reportData.opens,
    clicks: reportData.clicks
  };

  if (variateParams && variateParams.child_ids) { res.child_ids = variateParams.child_ids; }
  else if (variateParams && variateParams.parent_id) { res.parent_id = variateParams.parent_id; }

  return res;
}

router.get('/', asyncHandler(async (req, res, next) => {
  res.json("invalid-endpoint");
}));

// POST /import-ga-data
// body params: site
//
router.post('/import-ga-data', asyncHandler(async (req, res, next) => {
  // Set request timeout as 10 mins
  // The default timeout for nodejs is 2mins and it is not long enough for this request to be done
  // Browser will automatically make another request after timeout and it will cause the script run again asynchronously
  //
  req.setTimeout(1200000);

  let importData = [], variateData = [], mailchimp = new MailChimp(), ga = new GoogleAnalytic();
  let docs = await mailchimp.getAllCampaignDbDatabySite(req.body.site, { type: 1, year: 1, quarter: 1, month: 1, promo_num: 1, segment: 1, google_analytics: 1, variate_settings: 1 });
  
  docs.forEach(doc => {
    if (doc.type === "variate") {
      let combinations = doc.variate_settings.combinations;
      for (let i = 0; i < combinations.length; ++i) {
        variateData.push({
          _id: combinations[i].id,
          type: "variate-child",
          parent_id: doc._id,
          google_analytics: `${combinations[i].id}-${doc.google_analytics}`,
          year: doc.year,
          quarter: doc.quarter,
          month: doc.month,
          promo_num: doc.promo_num,
          segment: doc.segment
        });
      }

      delete doc.google_analytics;
    }
  });
  docs = [...docs.filter(doc => typeof doc.google_analytics !== "undefined"), ...variateData];

  for (let i = 0; i < docs.length; ++i) {
    let result = await ga.getGAData(req.body.site, {
      startDate: "2020-01-01",
      endDate: "today",
      metrics: "ga:transactions,ga:transactionsPerSession,ga:transactionRevenue,ga:sessions",
      dimensions: "ga:campaign",
      filters: `ga:campaign==${docs[i].google_analytics}`
    });

    if (result.data.rows.length === 0 || result.data.rows[0].length === 0) {
      console.log(result.data);
    }
    else {
      let data = {
        _id: result.data.rows[0][0],
        mc_id: docs[i]._id,
        type: docs[i].type,
        site: req.body.site,
        year: docs[i].year,
        quarter: docs[i].quarter,
        month: docs[i].month,
        promo_num: docs[i].promo_num,
        segment: docs[i].segment,
        transaction: Number(result.data.rows[0][1]),
        ecomm_conversion_rate: Number(result.data.rows[0][2]),
        revenue: Number(result.data.rows[0][3]),
        sessions: Number(result.data.rows[0][4])
      };

      if (docs[i].type === "variate-child") { data.mc_parent_id = docs[i].parent_id; }
      importData.push(data);
    }
  }

  await resHandler.handleRes(req, res, next, 200, {
    result: await ga.importData(importData)
  });
}));

// POST /import-campaign-report
// body params: site
//
router.post('/import-campaign-report', asyncHandler(async (req, res, next) => {
  // Set request timeout as 10 mins
  // The default timeout for nodejs is 2mins and it is not long enough for this request to be done
  // Browser will automatically make another request after timeout and it will cause the script run again asynchronously
  //
  req.setTimeout(600000);

  let reportData = [], mailchimp = new MailChimp();
  let docs = await mailchimp.getAllCampaignDbDatabySite(req.body.site, { _id: 1, type: 1, variate_settings: 1, year: 1, quarter: 1, month: 1, promo_num: 1, segment: 1 });

  for (let i = 0; i < docs.length; ++i) {
    let result = (await mailchimp.getReportData(docs[i]._id)).data;

    if (docs[i].type === "variate") {
      let childIds = [];
      docs[i].variate_settings.combinations.forEach(item => childIds.push(item.id));
      reportData.push(formatCampaignReportData(docs[i], result, {
        type: "variate-parent",
        child_ids: childIds
      }));

      for (let j = 0; j < childIds.length; ++j) {
        reportData.push(formatCampaignReportData(docs[i], (await mailchimp.getReportData(childIds[j])).data, {
          type: "variate-child",
          parent_id: docs[i]._id
        }));
      }
    }
    else {
      reportData.push(formatCampaignReportData(docs[i], result));
    }
  }

  await resHandler.handleRes(req, res, next, 200, {
    result: await mailchimp.importData("campaignReport", reportData)
  });
}));

// POST /import-campaign-data
// body params: site (e.g., "cas"), startTime (e.g., "2020-01-01")
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
      let decodedGaKey = decodeGaKey(campaigns[i].tracking.google_analytics);

      campaignData.push({
        _id: campaigns[i].id,
        list_id: process.env.CAS_AUDIENCE_LIST_ID,
        title: campaigns[i].settings.title,
        type: campaigns[i].type,
        year: decodedGaKey.year,
        quarter: decodedGaKey.quarter,
        month: decodedGaKey.month,
        promo_num: decodedGaKey.promo_num,
        segment: decodedGaKey.segment,
        subject_line: campaigns[i].settings.subject_line,
        preview_text: campaigns[i].settings.preview_text,
        send_time: campaigns[i].send_time,
        google_analytics: `${campaigns[i].id}-${campaigns[i].tracking.google_analytics}`,
        content: (await mailchimp.getCampaignContentData(campaigns[i].id)).data.html
      });
    }
    else if (campaigns[i].type === "variate") {
      let decodedGaKey = decodeGaKey(campaigns[i].tracking.google_analytics);
      let variateContents = [], contents = (await mailchimp.getCampaignContentData(campaigns[i].id)).data.variate_contents;
      contents.forEach(element => variateContents.push(element.html));

      campaignData.push({
        _id: campaigns[i].id,
        list_id: process.env.CAS_AUDIENCE_LIST_ID,
        title: campaigns[i].settings.title,
        type: campaigns[i].type,
        year: decodedGaKey.year,
        quarter: decodedGaKey.quarter,
        month: decodedGaKey.month,
        promo_num: decodedGaKey.promo_num,
        segment: decodedGaKey.segment,
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