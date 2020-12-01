var express = require('express');
var router = express.Router();
const asyncHandler = require('express-async-handler');
const MailChimpImport = require('mailchimp-import');
const { GoogleAnalytic } = require('../classes/Main');
const resHandler = require('../services/resHandler');
const serverConfig = require('../server-config.json');

function checkSiteKey(site) {
  return serverConfig.SiteKey.filter(key => key === site).length > 0;
}

// POST /import
// Do a complete import for MailChimp campaign data, MailChimp report data and Google Analytics report data
// MailChimp campaign data will be imported first and then async import on MailChimp report data and Google Analytics report data based on the imported campaign data
//
// body params: site
//
router.post('/import', asyncHandler(async (req, res, next) => {
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

  let importData = [], variateData = [], ga = new GoogleAnalytic();
  let mailchimp = new MailChimpImport(
    serverConfig.MCAudienceIds,
    process.env.MC_USERNAME,
    process.env.MC_API_KEY,
    process.env.MC_DB_CAMPAIGN_DATA,
    process.env.MC_DB_REPORT_DATA,
    process.env.MC_API_URL
  );
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

  let site = req.body.site;
  if (!checkSiteKey(site)) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-site-${site}` }); }

  let mc = new MailChimpImport(
    serverConfig.MCAudienceIds,
    process.env.MC_USERNAME,
    process.env.MC_API_KEY,
    process.env.MC_DB_CAMPAIGN_DATA,
    process.env.MC_DB_REPORT_DATA,
    process.env.MC_API_URL
  );
  let result = await mc.fetchReportData(site);

  await resHandler.handleRes(req, res, next, 200, { result: await mc.importData("campaignReport", result) });
}));


// POST /import-campaign-data
// body params:
//  - site (e.g., "cas")
//  - startTime (e.g., "2020-01-01")
//  - count (postive integer)
//
router.post('/import-campaign-data', asyncHandler(async (req, res, next) => {

  // Set request timeout as 10 mins
  // The default timeout for nodejs is 2mins and it is not long enough for this request to be done
  // Browser will automatically make another request after timeout and it will cause the script run again asynchronously
  //
  req.setTimeout(600000);

  let site = req.body.site, startTime = req.body.startTime, count = typeof req.body.count !== "undefined" ? Number(req.body.count) : undefined;
  if (!checkSiteKey(site)) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-site-${site}` }); }
  if (isNaN(Date.parse(startTime))) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-startTime-${startTime}` }); }
  if (typeof count !== "undefined" && (!Number.isInteger(count) || count < 1)) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-count-${req.body.count}` }); }

  let mc = new MailChimpImport(
    serverConfig.MCAudienceIds,
    process.env.MC_USERNAME,
    process.env.MC_API_KEY,
    process.env.MC_DB_CAMPAIGN_DATA,
    process.env.MC_DB_REPORT_DATA,
    process.env.MC_API_URL
  );
  let result = await mc.fetchCampaignData(site, startTime, count);
  
  await resHandler.handleRes(req, res, next, 200, {
    result: await mc.importData("campaignData", result.campaignData),
    invalidCampaign: result.invalidCampaign
  });
}));

module.exports = router;