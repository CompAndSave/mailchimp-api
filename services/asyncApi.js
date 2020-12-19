const aws = require("aws-sdk");
const { ImportData } = require('../classes/Main');
const serverConfig = require('../server-config.json');

// message param should be stringified
//
async function sendSNS(message) {
  console.log("publish message now");
  
  let sns = new aws.SNS();
  let error, result = await (new Promise((resolve, reject) => {
    sns.publish({
      Message: message, 
      Subject: "SNS message from MailChimp-api at Lambda",
      TopicArn: "arn:aws:sns:us-west-2:982834960524:mailchimp-reporting-api-import-result"
    }, (err, data) => {
      if (err) { reject(err); }       // an error occurred
      else { resolve(data); }         // successful response
    });
  })).catch(err => error = err);

  if (error) { return Promise.reject(error); }
  else { return Promise.resolve(result); }
}

// import mailchimp and google analytics data route
//
async function worker(records) {

  // Received the requests in bulk, process and send out SNS individually
  //
  let jobs = [];
  records.forEach(record => {
    jobs.push({
      id: record.messageId,
      requestBody: JSON.parse(record.body)
    });
  });

  // For import async api call, we have limit only 1 api call can be invoked every time
  //
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

  let req = jobs[0].requestBody;
  let error, result = await importData.import(req.site, req.campaignId, req.mode, req.manual, req.startTime, req.count).catch(err => error = err);

  let response = {
    id: jobs[0].id,
    httpStatus: error ? 400 : 200,
    request: jobs[0],
    response: typeof error === "undefined" ? { result: result } : { message: error }
  }

  response = JSON.stringify(response)
  console.log(response);

  return Promise.resolve(await sendSNS(response));
}

module.exports = { sendSNS, worker };