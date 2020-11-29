const axios = require('axios');
const MongoDB = require("../mongoDB/MongoDB");

class MailChimp {
  constructor () {
    this.campaignData = new MongoDB("campaignData");
    this.campaignReport = new MongoDB("campaignReport");
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

  async getAllCampaignDbDatabySite(site, projection, sort, pagination) {
    return Promise.resolve((await this.campaignData.getData("campaignData", { list_id: this.audienceId[site] }, false, projection, sort, pagination, false)));
  }

  async getCampaignDbData(query, projection, sort, pagination) {
    return Promise.resolve((await this.campaignData.getData("campaignData", query, false, projection, sort, pagination, false)));
  }
}

module.exports = MailChimp;