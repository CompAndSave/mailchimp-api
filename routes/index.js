var express = require('express');
var router = express.Router();
const asyncHandler = require('express-async-handler');
const { ImportData } = require('../classes/Main');
const resHandler = require('../services/resHandler');
const serverConfig = require('../server-config.json');

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

  let importData = new ImportData(
    serverConfig.MCAudienceIds,
    process.env.MC_USERNAME,
    process.env.MC_API_KEY,
    process.env.MC_DB_CAMPAIGN_DATA,
    process.env.MC_DB_REPORT_DATA,
    process.env.MC_API_URL,
    serverConfig.SiteKey,
    serverConfig.DefaultStartTime
  );

  let error, result = await importData.import(req.body.site, req.body.campaignId, req.body.mode, req.body.manual, req.body.startTime, req.body.count).catch(err => error = err);
  if (error) { return await resHandler.handleRes(req, res, next, 400, { message: error }); }

  const endTime = new Date();
  console.log(`Time Used: ${endTime - startTime} ms`);

  await resHandler.handleRes(req, res, next, 200, { result: result });
}));

module.exports = router;