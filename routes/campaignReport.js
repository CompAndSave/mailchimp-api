var express = require('express');
var router = express.Router();
const asyncHandler = require('express-async-handler');
const { MailChimp, GoogleAnalytic } = require('../classes/Main');
const resHandler = require('../services/resHandler');

function createDataReturn(data) {
  let emails_sent = 0, totalOpen = 0, totalClick = 0, totalBounces = 0, totalSpam = 0, totalUnsub = 0;

  data.forEach(item => {
    emails_sent += item.emails_sent;
    totalOpen += item.opens.unique_opens;
    totalClick += item.clicks.unique_subscriber_clicks;
    totalBounces += item.bounces.hard_bounces + item.bounces.soft_bounces;
    totalSpam += item.abuse_reports;
    totalUnsub += item.unsubscribed;
  });

  return emails_sent !== 0 ? {
    emails_sent: emails_sent,
    open_rate: Math.round((totalOpen / emails_sent) * 10000) / 100,
    click_rate: Math.round((totalClick / emails_sent) * 10000) / 100,
    deliverability_rate: Math.round((emails_sent - totalBounces) / emails_sent * 10000) / 100,
    spam_rate: Math.round((totalSpam / emails_sent) * 10000) / 100,
    unsub_rate: Math.round((totalUnsub / emails_sent) * 10000) / 100,
    bounces_rate: Math.round((totalBounces / emails_sent) * 10000) / 100
  } : undefined;
}

// Get /campaign-report
// body params:
//  - year
//  - quarter
//  - month
//  - promoNum
//  - groupBy (monthly, quarterly, yearly, campaign, segment) - If not specify, return total amount
//  - showVariate (boolean, only available when groupBy is campaign or segment) - Default is false
//
router.get('/', asyncHandler(async (req, res, next) => {
  let year = req.body.year ? Number(req.body.year) : undefined;
  let quarter = req.body.quarter ? Number(req.body.quarter) : undefined;
  let month = req.body.month ? Number(req.body.month) : undefined;
  let promoNum = req.body.promoNum ? Number(req.body.promoNum) : undefined;
  let groupBy = req.body.groupBy;
  let showVariate = req.body.showVariate || req.body.showVariate === "true" ? true : false;

  if (typeof year !== "undefined" && (isNaN(year) || !Number.isInteger(year))) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-year-${req.body.year}` }); }
  if (typeof quarter !== "undefined" && (isNaN(quarter) || !Number.isInteger(quarter)) || quarter < 1 || quarter > 4) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-quarter-${req.body.quarter}` }); }
  if (typeof month !== "undefined" && (isNaN(month) || !Number.isInteger(month)) || month < 1 || month > 12) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-month-${req.body.month}` }); }
  if (typeof promoNum !== "undefined" && (isNaN(promoNum) || !Number.isInteger(promoNum))) { return await resHandler.handleRes(req, res, next, 400, { message: `invalid-promoNum-${req.body.promoNum}` }); }
  if (typeof groupBy !== "undefined" && groupBy !== "monthly" && groupBy !== "quarterly" && groupBy !== "yearly" && groupBy !== "campaign" && groupBy !== "segment") {
    return await resHandler.handleRes(req, res, next, 400, { message: `invalid-groupBy-${groupBy}` });
  }

  let mc = new MailChimp(), query = {};
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

  let response = [];
  switch (groupBy) {
    case "yearly":
      yearSet.forEach(year => {
        let reportData = createDataReturn(mcData.filter(element => element.year === year));
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
          let reportData = createDataReturn(mcData.filter(element => (element.quarter === quarter && element.year === year)));
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
            let reportData = createDataReturn(mcData.filter(element => (element.month === month && element.quarter === quarter && element.year === year)));
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
              let reportData = createDataReturn(mcData.filter(element => (element.promo_num === promo_num && element.month === month && element.quarter === quarter && element.year === year)));
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
                let reportData = createDataReturn(mcData.filter(element => (element.segment === segment && element.promo_num === promo_num && element.month === month && element.quarter === quarter && element.year === year)));
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
      response.push(createDataReturn(mcData));
  }

  res.json({ result: response });
}));

module.exports = router;