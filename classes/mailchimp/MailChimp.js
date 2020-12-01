const axios = require('axios');
const MongoDB = require("../mongoDB/MongoDB");

// decode google_analytic field to get the year, quarter, month, promoNum (campaign) and segment data
// e.g., 2020_jan2_sku_most  - Year: 2020, Month: 1, Quarter: 1, promoNum: 2, segment: sku_most
//
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

class MailChimp {
  constructor () {
    this.campaignData = new MongoDB(process.env.MC_DB_CAMPAIGN_DATA);
    this.campaignReport = new MongoDB(process.env.MC_DB_REPORT_DATA);
    this.audienceId = {
      cas: process.env.CAS_AUDIENCE_LIST_ID,
      ci: process.env.CI_AUDIENCE_LIST_ID,
      ti: process.env.TI_AUDIENCE_LIST_ID
    };
    this.header = {
      auth: {
        username: process.env.MC_USERNAME,
        password: process.env.MC_API_KEY
      }
    };
  }

  // Methods to fetch data from MailChimp
  // ------------------------ Start ---------------------------------- //
  //
  async getCampaignData(site, count, sinceSendTime, sortField) {
    return Promise.resolve((await axios.get(`${process.env.MC_API_URL}campaigns?&count=${count}&since_send_time=${sinceSendTime}&list_id=${this.audienceId[site]}&sort_field=${sortField}`, this.header)).data);
  }

  async getCampaignContentData(campaignId) {
    return Promise.resolve((await axios.get(`${process.env.MC_API_URL}campaigns/${campaignId}/content`, this.header)));
  }

  async getReportData(campaignId) {
    return Promise.resolve((await axios.get(`${process.env.MC_API_URL}reports/${campaignId}`, {
      ...this.header,
      campaign_id: campaignId
    })));
  }

  // type param: either "campaignData" or "campaignReport"
  //
  async importData(type, importArr) {
    let replaceOneArr = [];
    importArr.forEach(element => {
      replaceOneArr.push({
        replaceOne: {
          filter: { _id: element._id },
          replacement: element,
          upsert: true
        }
      });
    });

    return type === "campaignData" ? Promise.resolve(await this.campaignData.allBulkUnOrdered(replaceOneArr)) :
           type === "campaignReport" ? Promise.resolve(await this.campaignReport.allBulkUnOrdered(replaceOneArr)) :
           Promise.reject(`invalid-type-${type}`);
  }

  // Fetch on regular and variate campaign type from MailChimp
  // Campaign type other than regular and variate will be filtered out and return at invalidCampaign
  // Multiple sites are supported
  //
  // params:
  //  - site
  //  - startTime (start from when campaign sent date) - E.g., 2020-01-01
  //  - count (no. of campaigns data to be fetched) - default: 300
  //  - sort (sort by field) - default: "send_time"
  //
  async fetchCampaignData (site, startTime, count = 300, sort = "send_time") {
    let data = await this.getCampaignData(site, count, startTime, sort);
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
          content: (await this.getCampaignContentData(campaigns[i].id)).data.html
        });
      }
      else if (campaigns[i].type === "variate") {
        let decodedGaKey = decodeGaKey(campaigns[i].tracking.google_analytics);
        let variateContents = [], contents = (await this.getCampaignContentData(campaigns[i].id)).data.variate_contents;
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

    return Promise.resolve({
      campaignData: campaignData,
      invalidCampaign: invalidCampaign
    });
  }
  // ------------------------ End ---------------------------------- //


  // Methods to get and write data to MongoDB which stores MailChimp campaign data
  // ------------------------ Start ---------------------------------- //
  //
  async getAllCampaignDbDatabySite(site, projection, sort, pagination) {
    return Promise.resolve((await this.campaignData.getData("campaignData", { list_id: this.audienceId[site] }, false, projection, sort, pagination, false)));
  }

  async getCampaignDbData(query, projection, sort, pagination) {
    return Promise.resolve((await this.campaignData.getData("campaignData", query, false, projection, sort, pagination, false)));
  }

  async getReportDbData(query, projection, sort, pagination) {
    return Promise.resolve((await this.campaignReport.getData("campaignReport", query, false, projection, sort, pagination, false)));
  }
  // ------------------------ End ---------------------------------- //
}

module.exports = MailChimp;