const aws = require("aws-sdk");
const { timer }= require('cas-common-lib');

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
      requestBody: record.body
    });
  });

  await timer.timeout(2000); // timeout 2s

  let response = {
    id: jobs[0].id,
    httpStatus: 200,
    request: JSON.stringify(jobs[0]),
    data: {
      success: true,
      message: "Good result"
    }
  }

  response = JSON.stringify(response)
  console.log(response);

  return Promise.resolve(await sendSNS(response));
}

module.exports = { sendSNS, worker };