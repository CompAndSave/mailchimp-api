const MailChimpImport = require('mailchimp-import');
const GoogleAnalytic = require('../googleAnalytic/GoogleAnalytic');

class ImportData {
  constructor(mcAudienceIds, mcUserName, mcApiKey, mcDbCampaignData, mcDbReportData, mcApiUrl, siteList, defaultStartTime) {
    this.siteList = siteList;
    this.defaultStartTime = defaultStartTime;
    this.ga = new GoogleAnalytic();
    this.mc = new MailChimpImport(mcAudienceIds, mcUserName, mcApiKey, mcDbCampaignData, mcDbReportData, mcApiUrl);
  }

  isValidSite(site) { return this.siteList.filter(key => key === site).length > 0; }

  async import(site, campaignId, mode, manual, startTime, count) {
    if (!this.isValidSite(site)) { return Promise.reject(`invalid-site-${site}`); }

    let mcCampaignResult, mcReportResult, gaReportResult, invalidCampaign;
    if (typeof campaignId === "string") {
      mcReportResult = this.mc.importData("campaignReport", await this.mc.fetchReportData(undefined, undefined, campaignId));
      gaReportResult = this.ga.importData(await this.ga.fetchGAData("cas", await this.mc.getCampaignDbData({ _id: campaignId }, { type: 1, year: 1, quarter: 1, month: 1, promo_num: 1, segment: 1, google_analytics: 1, send_time: 1, variate_settings: 1 })));
      [mcReportResult, gaReportResult] = await Promise.all([mcReportResult, gaReportResult]);
    }
    else {
      startTime = typeof startTime === "undefined" ? this.defaultStartTime : startTime;
      if (typeof startTime !== "string" || !startTime.match(/^[\d]{4}-[\d]{2}-[\d]{2}$/)) {
        return Promise.reject(`invalid-startTime-must-be-formatted-YYYY-MM-DD-${startTime}`);
      }
  
      if (mode === "full" || (mode === "manual" && manual === "mc-campaign")) {
        count = typeof count !== "undefined" ? Number(count) : undefined;
        if (typeof count !== "undefined" && (!Number.isInteger(count) || count < 1)) { return Promise.reject(`invalid-count-${count}`); }
    
        let result = await this.mc.fetchCampaignData(site, startTime, count);
        mcCampaignResult = await this.mc.importData("campaignData", result.campaignData);
        invalidCampaign = result.invalidCampaign;

        console.log("mc-campaign import is done");
      }
  
      if (mode === "full" || mode === "quick" || (mode === "manual" && manual === "mc-report")) {
        mcReportResult = this.mc.importData("campaignReport", await this.mc.fetchReportData(site, startTime));

        console.log("mc-report import is done");
      }
  
      if (mode === "full" || mode === "quick" || (mode === "manual" && manual === "ga-report")) {
        let year = Number(startTime.substring(0, 4)), month = Number(startTime.substring(5, 7));

        gaReportResult = this.ga.importData(await this.ga.fetchGAData(site, await this.mc.getCampaignDbData(
          { list_id: this.mc.audienceId[site], $or: [{ year: { $gt: year }}, { year: { $gte: year }, month: { $gte: month }}]},
          { type: 1, year: 1, quarter: 1, month: 1, promo_num: 1, segment: 1, google_analytics: 1, send_time: 1, variate_settings: 1 })));

        console.log("ga-report import is done");
      }
  
      [mcReportResult, gaReportResult] = await Promise.all([mcReportResult, gaReportResult]);
    }
  
    if (!mcCampaignResult && !mcReportResult && !gaReportResult && !invalidCampaign) {
      return Promise.reject("no-import-is-made-check-if-input-is-valid");
    }
  
    return Promise.resolve({
      mcCampaignResult: mcCampaignResult,
      mcReportResult: mcReportResult,
      gaReportResult: gaReportResult,
      invalidCampaign: invalidCampaign
    });
  }
}

module.exports = ImportData;