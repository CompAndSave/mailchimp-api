var express = require('express');
var router = express.Router();
const asyncHandler = require('express-async-handler');
const MailChimpImport = require('mailchimp-import');
const { GoogleAnalytic } = require('../classes/Main');
const resHandler = require('../services/resHandler');
const serverConfig = require('../server-config.json');

function createDataReturn(data, gaData, showVariate, childId) {
  let emails_sent = 0, totalOpen = 0, totalClick = 0, totalBounces = 0, totalSpam = 0, totalUnsub = 0, totalTrans = 0, totalRev = 0, totalSession = 0, childIds;

  data.forEach(item => {
    if ((childId && item._id === childId) || (!childId && item.type !== "variate-child")) {
      emails_sent += item.emails_sent;
      totalOpen += item.opens.unique_opens;
      totalClick += item.clicks.unique_subscriber_clicks;
      totalBounces += item.bounces.hard_bounces + item.bounces.soft_bounces;
      totalSpam += item.abuse_reports;
      totalUnsub += item.unsubscribed;
  
      let matchedGaData = [];
      if (item.type === "variate-parent") {
        item.child_ids.forEach(child => matchedGaData.push(gaData.filter(ga => ga.mc_id === child)[0]));
        if (showVariate) { childIds = item.child_ids; }
      }
      else { matchedGaData = gaData.filter(ga => ga.mc_id === item._id); }
  
      matchedGaData.forEach(element => {
        totalTrans += element.transaction;
        totalRev += element.revenue;
        totalSession += element.sessions;
      });
    }
  });

  let result = emails_sent !== 0 ? {
    emails_sent: emails_sent,
    open_rate: Math.round((totalOpen / emails_sent) * 10000) / 100,
    click_rate: Math.round((totalClick / emails_sent) * 10000) / 100,
    deliverability_rate: Math.round((emails_sent - totalBounces) / emails_sent * 10000) / 100,
    spam_rate: Math.round((totalSpam / emails_sent) * 10000) / 100,
    unsub_rate: Math.round((totalUnsub / emails_sent) * 10000) / 100,
    bounces_rate: Math.round((totalBounces / emails_sent) * 10000) / 100,
    transaction: totalTrans,
    ecomm_conversion_rate: Math.round((totalTrans / totalSession) * 10000) / 100,
    revenue: Math.round(totalRev * 100) / 100,
    rpe: Math.round((totalRev / emails_sent) * 100) / 100
  } : undefined;

  if (showVariate && childIds) {
    let combinations = [];
    childIds.forEach(child => combinations.push(createDataReturn(data, gaData, false, child)));
    result.combinations = combinations;
  }

  return result;
}

// Get /campaign-report
// body params:
//  - site (required)
//  - year
//  - quarter
//  - month
//  - promoNum
//  - groupBy (monthly, quarterly, yearly, campaign, segment) - If not specify, return total amount
//  - showVariate (boolean, only available when groupBy is segment) - Default is false
//
router.get('/', asyncHandler(async (req, res, next) => {
  let site = req.body.site;
  if (serverConfig.SiteKey.filter(siteKey => siteKey === site).length !== 1) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-site-${site}` });}

  let year = req.body.year ? Number(req.body.year) : undefined;
  let quarter = req.body.quarter ? Number(req.body.quarter) : undefined;
  let month = req.body.month ? Number(req.body.month) : undefined;
  let promoNum = req.body.promoNum ? Number(req.body.promoNum) : undefined;
  let groupBy = typeof req.body.groupBy === "string" ? req.body.groupBy.toLowerCase() : req.body.groupBy;
  let showVariate = groupBy === "segment" && (req.body.showVariate || req.body.showVariate === "true") ? true : false;

  if (typeof year !== "undefined" && (isNaN(year) || !Number.isInteger(year))) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-year-${req.body.year}` }); }
  if (typeof quarter !== "undefined" && (isNaN(quarter) || !Number.isInteger(quarter)) || quarter < 1 || quarter > 4) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-quarter-${req.body.quarter}` }); }
  if (typeof month !== "undefined" && (isNaN(month) || !Number.isInteger(month)) || month < 1 || month > 12) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-month-${req.body.month}` }); }
  if (typeof promoNum !== "undefined" && (isNaN(promoNum) || !Number.isInteger(promoNum))) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-promoNum-${req.body.promoNum}` }); }
  if (typeof groupBy !== "undefined" && groupBy !== "monthly" && groupBy !== "quarterly" && groupBy !== "yearly" && groupBy !== "campaign" && groupBy !== "segment") {
    return await resHandler.handleRes(req, res, next, 400, { message: `invalid-groupBy-${groupBy}` });
  }

  let query = { site: site }, mc = new MailChimpImport(
    serverConfig.MCAudienceIds,
    process.env.MC_USERNAME,
    process.env.MC_API_KEY,
    process.env.MC_DB_CAMPAIGN_DATA,
    process.env.MC_DB_REPORT_DATA,
    process.env.MC_API_URL
  );
  if (year) { query.year = year; }
  if (quarter) { query.quarter = quarter; }
  if (month) { query.month = month; }
  if (promoNum) { query.promo_num = promoNum; }

  let mcData = await mc.getReportDbData(query);
  let yearSet = new Set(), quarterSet = new Set(), monthSet = new Set(), promoNumSet = new Set(), segmentSet = new Set();
  mcData.forEach(item => {
    yearSet.add(item.year);
    quarterSet.add(item.quarter);
    monthSet.add(item.month);
    promoNumSet.add(item.promo_num);
    segmentSet.add(item.segment);
  });

  let ga = new GoogleAnalytic();
  let gaData = await ga.getAllReportData();
  let response = [];
  switch (groupBy) {
    case "yearly":
      yearSet.forEach(year => {
        let reportData = createDataReturn(mcData.filter(element => element.year === year), gaData, showVariate);
        if (typeof reportData !== "undefined") {
          response.push({
            year: year,
            ...reportData
          });
        }
      });
      break;
    case "quarterly":
      yearSet.forEach(year => {
        quarterSet.forEach(quarter => {
          let reportData = createDataReturn(mcData.filter(element => (element.quarter === quarter && element.year === year)), gaData, showVariate);
          if (typeof reportData !== "undefined") {
            response.push({
              year: year,
              quarter: quarter,
              ...reportData
            });
          }
        });
      });
      break;
    case "monthly":
      yearSet.forEach(year => {
        quarterSet.forEach(quarter => {
          monthSet.forEach(month => {
            let reportData = createDataReturn(mcData.filter(element => (element.month === month && element.quarter === quarter && element.year === year)), gaData, showVariate);
            if (typeof reportData !== "undefined") {
              response.push({
                year: year,
                quarter: quarter,
                month: month,
                ...reportData
              });
            }
          });
        });
      });
      break;
    case "campaign":
      yearSet.forEach(year => {
        quarterSet.forEach(quarter => {
          monthSet.forEach(month => {
            promoNumSet.forEach(promo_num => {
              let reportData = createDataReturn(mcData.filter(element => (element.promo_num === promo_num && element.month === month && element.quarter === quarter && element.year === year)), gaData, showVariate);
              if (typeof reportData !== "undefined") {
                response.push({
                  year: year,
                  quarter: quarter,
                  month: month,
                  promo_num: promo_num,
                  ...reportData
                });
              }
            });
          });
        });
      });
      break;
    case "segment":
      yearSet.forEach(year => {
        quarterSet.forEach(quarter => {
          monthSet.forEach(month => {
            promoNumSet.forEach(promo_num => {
              segmentSet.forEach(segment => {
                let reportData = createDataReturn(mcData.filter(element => (element.segment === segment && element.promo_num === promo_num && element.month === month && element.quarter === quarter && element.year === year)), gaData, showVariate);
                if (typeof reportData !== "undefined") {
                  response.push({
                    year: year,
                    quarter: quarter,
                    month: month,
                    promo_num: promo_num,
                    segment: segment,
                    ...reportData
                  });
                }
              });
            });
          });
        });
      });
      break;
    default:
      response.push(createDataReturn(mcData, gaData, showVariate));
  }

  await resHandler.handleRes(req, res, next, 200, { site: site, result: response });
}));

// Get /campaign-report/summary
// Return the no. of campaign counts for all report data
//
router.get('/summary', asyncHandler(async (req, res, next) => {
  let site = req.body.site;
  if (serverConfig.SiteKey.filter(siteKey => siteKey === site).length !== 1) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-site-${site}` });}

  let mc = new MailChimpImport(
    serverConfig.MCAudienceIds,
    process.env.MC_USERNAME,
    process.env.MC_API_KEY,
    process.env.MC_DB_CAMPAIGN_DATA,
    process.env.MC_DB_REPORT_DATA,
    process.env.MC_API_URL
  );

  let mcData = await mc.getAllCampaignDbDatabySite(site, { type: 1, year: 1, quarter: 1, month: 1, promo_num: 1, segment: 1, variate_settings: 1 });
  let result = {};

  let yearSet = new Set();
  mcData.forEach(item => yearSet.add(item.year));

  yearSet.forEach(year => {
    result[year] = ((year) => {
      let quarterSet = new Set();
      let data = mcData.filter(data => data.year === year), result = {};
      data.forEach(item => quarterSet.add(item.quarter));
      quarterSet.forEach(quarter => {
        result[quarter] = ((quarter) => {
          let monthSet = new Set();
          let data = mcData.filter(data => data.year === year && data.quarter === quarter), result = {};
          data.forEach(item => monthSet.add(item.month));
          monthSet.forEach(month => {
            result[month] = ((month) => {
              let promoNumSet = new Set();
              let data = mcData.filter(data => data.year === year && data.quarter === quarter && data.month === month), result = {};
              data.forEach(item => promoNumSet.add(item.promo_num));
              promoNumSet.forEach(promo_num => {
                result[promo_num] = ((promo_num) => {
                  let segment = []
                  let data = mcData.filter(data => data.year === year && data.quarter === quarter && data.month === month && data.promo_num === promo_num);
                  data.forEach(item => segment.push({ id: item._id, segment: item.segment }));
                  return Array.from(segment);
                })(promo_num);
              });
              return result;
            })(month);
          })
          return result;
        })(quarter);
      });
      return result;
    })(year);
  });

  await resHandler.handleRes(req, res, next, 200, { site: site, result: result });
}));

module.exports = router;