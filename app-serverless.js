const serverless = require('serverless-http');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
require('dotenv').config({ path: path.join(__dirname, '.env')});
require('./initialize-serverless');

var indexRouter = require('./routes/index');
var campaignReportRouter = require('./routes/campaignReport');

var app = express();

const helmet = require('helmet');
app.use(helmet());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// To fix the Error: request entity too large
// https://stackoverflow.com/questions/19917401/error-request-entity-too-large
// 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/campaign-report', campaignReportRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({ status_message:err.message });
  //res.render('error');
});

module.exports.handler = serverless(app);