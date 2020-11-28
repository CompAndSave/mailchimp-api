const axios = require('axios');
const MongoDB = require("../mongoDB/MongoDB");

class MailChimp {
  constructor () {
    this.listData = new MongoDB("listData");
    this.campaignData = new MongoDB("campaignData");
    this.campaignReport = new MongoDB("campaignReport");
    this.audienceId = {
      cas: process.env.CAS_AUDIENCE_LIST_ID,
      ci: process.env.CI_AUDIENCE_LIST_ID,
      ti: process.env.TI_AUDIENCE_LIST_ID
    };
    this.auth = {
      auth: {
        username: process.env.MC_USERNAME,
        password: process.env.MC_API_KEY
      }
    };
  }

  async getCampaignData(site, count, sinceSendTime, sortField) {
    return Promise.resolve((await axios.get(`${process.env.MC_API_URL}campaigns?&count=${count}&since_send_time=${sinceSendTime}&list_id=${this.audienceId[site]}&sort_field=${sortField}`, this.auth)).data);
  }

  async getCampaignContentData(campaignId) {
    return Promise.resolve((await axios.get(`${process.env.MC_API_URL}campaigns/${campaignId}/content`, this.auth)));
  }

  async getListData() {
    return await this.listData.getAllData();
  }

  async insertCampaignData(insertArr) {
    return await this.campaignData.insertBulkUnOrdered(insertArr);
  }
}

module.exports = MailChimp;