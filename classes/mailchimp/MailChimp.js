const MongoDB = require("../mongoDB/MongoDB");

class MailChimp {
  constructor () {
    this.listData = new MongoDB("listData");
    this.campaignData = new MongoDB("campaignData");
    this.campaignReport = new MongoDB("campaignReport");
  }

  async getListData() {
    return await this.listData.getAllData();
  }
}

module.exports = MailChimp;