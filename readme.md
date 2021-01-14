# API service for reporting via MailChimp and Google Analytics
### Features:
 - Aggregate the campaign data, e.g., open / click rate, from MailChimp with the revenue data from Google Analytics.
 - Multiple audience lists supported.
 - Offline data for quick access.
 - Import data from MailChimp or Google Analytics in different ways.
 - Flexible reporting data endpoint.
 - Hosted and serverless application supported.
 - Authentication via AWS Cognito Authorization Code (refresh session token supported) or Implicit Grant
 - Sample files and documentation to CI/CD deployment (serverless) at AWS included

### Minimum Requirement:
- Node v12.16.x
- MongoDB v4.2.x

### Optional:
- [Report Client](https://github.com/lubu12/reporting-client). It works seamlessly with this API service app in both hosted and serverless settings

### Hosted Setup

#### Before start:
- Install all dependencies `npm i`

#### Run the app
- `npm start`

#### Development
Use `nodemon` - https://www.npmjs.com/package/nodemon
```
npm i nodemon -g
nodemon
```

#### Production
Use `pm2` - https://www.npmjs.com/package/pm2
```
npm i pm2 -g
pm2 start ./bin/www
```
OR
```
pm2 start ecosystem.config.js
```
Ref: https://pm2.keymetrics.io/docs/usage/application-declaration/

### Serverless CI/CD Setup
Serverless will use the file `app-serverless.js` and `initialize-serverless.js`. It won't generate the log file. Instead, the error will be displayed at console and streamed to AWS CloudWatch.

Our serverless application is deployed via [Serverless](https://www.serverless.com/). Sample configuration can be found at `sample-serverless.yml`.  The configuration is based on AWS.  Since API Gateway is having maximum timeout of 29 seconds, the POST request for data import won't be enough for synchronous call. Asynchronous api configuration is needed.

POST endpoint is added at API Gateway which is integrated with SQS. After the request is received at API Gateway, it will be added to SQS queue which is having Lambda trigger set up.  Acknowledgement response will be sent back to client. POST request will be forwarded to MailChimp API service at Lambda for processing.  After the request is done processing, it will send a message to SNS which is subscribed by the client (Lambda). Client will consume the SNS message and show the result to user.

Our serverless application is deployed via [Serverless](https://www.serverless.com/). Sample configuration can be found at `sample-serverless.yml`.  The configuration is based on AWS, and it uses AWS API Gateway (API endpoint managment), Lambda (serverless), Congito (API endpoint authentication), CloudFormation (stack), SNS, SQS (async call management) and S3 (artifact).  We use HTTP API instead of REST API for better performance and lower cost.

Sample CI/CD configuration file and references are included for setting up better development environment. We are using AWS CodePipeline, CodeBuild, CodeCommit, SNS, Serverless and GitHub.

#### CI/CD Pipeline Structure:
Sources are from GitHub (public) and CodeCommit (private).  Environment variable file and `serverless.yml` are stored at CodeCommit. `.env` and `serverless.yml` are needed to be copied to primary source which is fetched from GitHub before generating the build artifact.  Commands can be found at `sample-buildspec.yml`.

Below is a sample `.env` file.
```
NODE_ENV = development
SANDBOX = true
CONN_STRING = CONNECTION_STRING_TO_PRODUCTION_MONGODB
SANDBOX_CONN_STRING = CONNECTION_STRING_TO_SANDBOX_MONGODB
MC_API_URL = https://us2.api.mailchimp.com/3.0/
MC_USERNAME = YOUR_MC_USERNAME
MC_API_KEY = YOUR_MC_API_KEY
MC_DB_CAMPAIGN_DATA = MAILCHIMP_CAMPAIGN_DATA_COLLECTION_NAME
MC_DB_REPORT_DATA = MAILCHIMP_CAMPAIGN_REPORT_COLLECTION_NAME
GA_DB_REPORT_DATA = GOOGLE_ANALYTICS_CAMPAIGN_REPORT_COLLECTION_NAME
CAS_MC_AUDIENCE_ID = FIRST_MAILCHIMP_AUDIENCE_ID
CI_MC_AUDIENCE_ID = SECOND_MAILCHIMP_AUDIENCE_ID
TI_MC_AUDIENCE_ID = THIRD_MAILCHIMP_AUDIENCE_ID
CAS_GA_VIEW_ID = FIRST_GOOGLE_ANALYTICS_VIEW_ID
CI_GA_VIEW_ID = SECOND_GOOGLE_ANALYTICS_VIEW_ID
TI_GA_VIEW_ID = THIRD_GOOGLE_ANALYTICS_VIEW_ID
SNS_TOPIC_ARN = YOUR_SNS_TOPIC_ARN
SNS_SUBJECT = YOUR_SNS_SUBJECT
```

#### AWS Cognito Setup References:
- https://medium.com/@janitha000/authentication-using-amazon-cognito-and-nodejs-c4485679eed8
- https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html
- https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html

#### Serverless Setup References:
- https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml/
- https://www.serverless.com/blog/serverless-express-rest-api
- https://www.serverless.com/blog/serverless-api-gateway-domain
- https://www.serverless.com/framework/docs/providers/aws/events/apigateway/#http-endpoints-with-custom-authorizers
- https://www.serverless.com/blog/aws-http-api-support
- https://www.serverless.com/blog/serverless-express-apis-aws-lambda-http-api
- https://www.serverless.com/framework/docs/providers/aws/guide/packaging/
- https://www.jeremydaly.com/serverless-consumers-with-lambda-and-sqs-triggers/
- https://codeburst.io/100-serverless-asynchronous-api-with-apig-sqs-and-lambda-2506a039b4d

#### CI/CD with Serverless References:
- https://medium.com/quantica/setup-ci-cd-pipeline-with-aws-lambda-and-serverless-framework-f624773f355e
- https://medium.com/quantica/setup-ci-cd-pipeline-with-aws-lambda-and-the-serverless-framework-313a5d3b6001
- https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html#build-spec-ref-example

#### Image for API Gateway with SQS integration configuration
![API Gateway with SQS](https://github.com/lubu12/mailchipm-api/blob/develop/images/apig-sqs-integration.png?raw=true)