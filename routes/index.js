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
// Import for MailChimp campaign data, MailChimp report data and Google Analytics report data
// MailChimp campaign data will be imported first and then async import on MailChimp report data and Google Analytics report data based on the imported campaign data
//
// body params:
//  - site (e.g., "cas") - required
//  - mode (full - import all data; quick - import MC and GA report data only; manual - select the particular data to import)
//  - manual (required when manual mode is used. Accepted value: mc-campaign, mc-report, ga-report)
//  - startTime (Must be formatted as YYYY-MM-DD, e.g., "2020-01-01")
//  - count (postive integer to include all campaigns at MailChimp, if count is less than the total no. of campaign at MailChimp, incomplete import will occur) (full mode only)
//  - campaignId (only import report data for a particular MC campaign id. If it is used, all other parameters will be ignored)
//
router.post('/import', asyncHandler(async (req, res, next) => {

  // Set request timeout as 15 mins (Lambda max timeout is 15 mins)
  // The default timeout for nodejs is 2mins and it is not long enough for this request to be done
  // Browser will automatically make another request after timeout and it will cause the script run again asynchronously
  //
  req.setTimeout(900000);

  const startTime = new Date();
  let site = req.body.site;
  if (!checkSiteKey(site)) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-site-${site}` }); }

  let ga = new GoogleAnalytic(), mc = new MailChimpImport(
    serverConfig.MCAudienceIds,
    process.env.MC_USERNAME,
    process.env.MC_API_KEY,
    process.env.MC_DB_CAMPAIGN_DATA,
    process.env.MC_DB_REPORT_DATA,
    process.env.MC_API_URL
  );

  let mcCampaignResult, mcReportResult, gaReportResult, invalidCampaign, error;
  if (typeof req.body.campaignId === "string") {
    mcReportResult = mc.importData("campaignReport", await mc.fetchReportData(undefined, undefined, req.body.campaignId)).catch(err => error = err);
    gaReportResult = ga.importData(await ga.fetchGAData("cas", await mc.getCampaignDbData({ _id: req.body.campaignId }, { type: 1, year: 1, quarter: 1, month: 1, promo_num: 1, segment: 1, google_analytics: 1, send_time: 1, variate_settings: 1 }))).catch(err => error = err);
    [mcReportResult, gaReportResult] = await Promise.all([mcReportResult, gaReportResult]);
    if (error) { return await resHandler.handleRes(req, res, next, 400, { message: error }); }
  }
  else {
    let mode = req.body.mode, manual = req.body.manual, startTime = typeof req.body.startTime === "undefined" ? serverConfig.DefaultStartTime : req.body.startTime;
    if (typeof startTime !== "string" || !startTime.match(/^[\d]{4}-[\d]{2}-[\d]{2}$/)) {
      return await resHandler.handleRes(req, res, next, 400, { message: `invalid-startTime-must-be-formatted-YYYY-MM-DD-${startTime}` });
    }

    if (mode === "full" || (mode === "manual" && manual === "mc-campaign")) {
      let count = typeof req.body.count !== "undefined" ? Number(req.body.count) : undefined;
      if (typeof count !== "undefined" && (!Number.isInteger(count) || count < 1)) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-count-${req.body.count}` }); }
  
      let result = await mc.fetchCampaignData(site, startTime, count);
      mcCampaignResult = await mc.importData("campaignData", result.campaignData);
      invalidCampaign = result.invalidCampaign;
    }

    if (mode === "full" || mode === "quick" || (mode === "manual" && manual === "mc-report")) {
      mcReportResult = mc.importData("campaignReport", await mc.fetchReportData(site, startTime)).catch(err => error = err);
    }

    if (mode === "full" || mode === "quick" || (mode === "manual" && manual === "ga-report")) {
      gaReportResult = ga.importData(await ga.fetchGAData(site, await mc.getCampaignDbData(
        { year: { $gte: Number(startTime.substring(0, 4)) }, month: { $gte: Number(startTime.substring(5, 7)) }},
        { type: 1, year: 1, quarter: 1, month: 1, promo_num: 1, segment: 1, google_analytics: 1, send_time: 1, variate_settings: 1 }))).catch(err => error = err);
    }

    [mcReportResult, gaReportResult] = await Promise.all([mcReportResult, gaReportResult]);
    if (error) { return await resHandler.handleRes(req, res, next, 400, { message: error }, error); }
  }

  if (!mcCampaignResult && !mcReportResult && !gaReportResult && !invalidCampaign) {
    return await resHandler.handleRes(req, res, next, 400, { message: "no-import-is-made-check-if-input-is-valid" });
  }

  const endTime = new Date();
  console.log(`Time Used: ${endTime - startTime} ms`);

  await resHandler.handleRes(req, res, next, 200, {
    result: {
      mcCampaignResult: mcCampaignResult,
      mcReportResult: mcReportResult,
      gaReportResult: gaReportResult,
      invalidCampaign: invalidCampaign
    }
  });
}));

module.exports = router;