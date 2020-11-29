const { google } = require('googleapis');
const path = require('path');
const MongoDB = require("../mongoDB/MongoDB");
const serverConfig = require('../../server-config');

class GoogleAnalytic {
  constructor () {
    this.keyFile = path.join(__dirname, `../../${serverConfig.GoogleKeyFilePath}`);
    this.campaignReport = new MongoDB("campaignReport");
    this.viewId = {
      cas: process.env.CAS_GA_VIEW_ID,
      ci: process.env.CI_GA_VIEW_ID,
      ti: process.env.TI_GA_VIEW_ID
    }
  }

  async connect() {
    const auth = new google.auth.GoogleAuth({
      keyFile: this.keyFile,
      scopes: serverConfig.GoogleAPIScope
    });
    this.client = await auth.getClient();
  }

  async getGAData(site, params) {
    if (!this.client) { await this.connect(); }

    return Promise.resolve(await google.analytics('v3').data.ga.get({
      "auth": this.client,
      "ids": "ga:" + this.viewId[site],
      "start-date": params.startDate,
      "end-date": params.endDate,
      "metrics": params.metrics,
      "dimensions": params.dimensions,
      "filters": params.filters
    }));
  }

  async getReportData() {
    return await this.campaignReport.getAllData();
  }
}

module.exports = GoogleAnalytic;