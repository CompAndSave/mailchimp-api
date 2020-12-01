const { google } = require('googleapis');
const path = require('path');
const MongoDB = require("../mongoDB/MongoDB");
const serverConfig = require('../../server-config');

class GoogleAnalytic {
  constructor () {
    this.keyFile = path.join(__dirname, `../../${serverConfig.GoogleKeyFilePath}`);
    this.gaCampaignReport = new MongoDB(process.env.GA_DB_REPORT_DATA);
    this.viewId = serverConfig.GAViewIds;
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

  async importData(importArr) {
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

    return Promise.resolve(await this.gaCampaignReport.allBulkUnOrdered(replaceOneArr));
  }

  // Fetch report data from Google Analytic based on the MailChimp campaign at db
  // Multiple sites are supported
  //
  // params:
  //  - site
  //  - mcData (MailChimp campaign data)
  //
  async fetchGAData(site, mcData) {
    let importData = [], variateData = [];
    mcData.forEach(doc => {
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
    let docs = [...mcData.filter(doc => typeof doc.google_analytics !== "undefined"), ...variateData];
  
    for (let i = 0; i < docs.length; ++i) {
      let result = await this.getGAData(site, {
        startDate: serverConfig.GADataStartDate,
        endDate: "today",
        metrics: "ga:transactions,ga:transactionsPerSession,ga:transactionRevenue,ga:sessions",
        dimensions: "ga:campaign",
        filters: `ga:campaign==${docs[i].google_analytics}`
      });
  
      let isNoData = false;
      if (!result.data.rows || result.data.rows.length === 0 || result.data.rows[0].length === 0) { isNoData = true; }

      let data = {
        _id: docs[i].google_analytics,
        mc_id: docs[i]._id,
        type: docs[i].type,
        site: site,
        year: docs[i].year,
        quarter: docs[i].quarter,
        month: docs[i].month,
        promo_num: docs[i].promo_num,
        segment: docs[i].segment,
        transaction: !isNoData ? Number(result.data.rows[0][1]) : 0,
        ecomm_conversion_rate: !isNoData ? Number(result.data.rows[0][2]) : 0,
        revenue: !isNoData ? Number(result.data.rows[0][3]) : 0,
        sessions: !isNoData ? Number(result.data.rows[0][4]) : 0
      };

      if (docs[i].type === "variate-child") { data.mc_parent_id = docs[i].parent_id; }
      importData.push(data);
    }

    return Promise.resolve(importData);
  }

  async getAllReportData(projection, sort, pagination) {
    return await this.gaCampaignReport.getAllData(projection, sort, pagination);
  }
}

module.exports = GoogleAnalytic;