var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var qs = require('querystring');
var nodemailer = require('nodemailer');
var schedule = require('node-schedule');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

var historyPrice = {};
var priceField = 'lowest_price';

setInterval(getMarketData, 15 * 60 * 1000);

//timer handler
function getMarketData(regular) {
  var nameArr = [
    'MLG Columbus 2016 Challengers (Holo-Foil)',
    'Cologne 2016 Challengers (Holo-Foil)'
  ];
  
  var todayTs = Date.parse((new Date()).toDateString());

  var data = {
    currency: 23,
    appid: 730,
    market_hash_name: ''
  }

  var paramArr = nameArr.map(v => Object.assign({}, data, {market_hash_name: v}));
  
  var url = 'http://steamcommunity.com/market/priceoverview/';
  var urlArr = paramArr.map(v => `${url}?${qs.stringify(v)}`);

  var reqPromiseArr = urlArr.map(function(v){
    return new Promise(function(resolve, reject){
      var req = http.get(v, function(res){
        var result = '';
        res.on('data', function(chunk){
          result += chunk;
        });
        res.on('end', function(){
          // console.log(`result ${result} for ${v}`);
          resolve(JSON.parse(result));
        });
      });
      req.on('error', function(e) {
        reject(e.message);
      });
    });
  });

  Promise.all(reqPromiseArr).then(function(resultArr){
    if (!historyPrice[todayTs]) {
      historyPrice[todayTs] = resultArr;
    }
    var basePrice = historyPrice[todayTs];
    needReport = resultArr.some(function(v, i){
      let delta = Math.abs(v[priceField] - basePrice[i][priceField]);
      return delta / basePrice[i][priceField] >= 0.25;
    });
    if (needReport) {
      sendMail(dealWithMailData(basePrice, resultArr, nameArr));
    }
    if (regular) {
      sendMail(dealWithMailData(basePrice, resultArr, nameArr, true));
    }
    console.log(resultArr);
  })
  .catch(function(err){
    console.log(err);
  });
};

function dealWithMailData(base, current, nameArr, regular) {
  var subject = 'Prices seesaw wildly!!!!!!';
  if (regular) {
    subject = 'Today Price';
  }
  for (let i = 0, len = current.length; i < len; i++) {
    base[i].name = nameArr[i];
    current[i].name = nameArr[i];
  }
  return {
    'subject': subject,
    'history': base,
    'current': current
  };
}

function sendMail(data, subject) {
  // var smtpServer = 'smtp.qq.com:465';
  var transporter = nodemailer.createTransport({
    service: 'QQ',
    auth: {
      user: 'fr0m@qq.com',
      pass: 'fr0m2252117'
    }
  });

  var mailOptions = {
    from: 'fr0m@qq.com',
    to: 'fr0m@qq.com',
    subject: data.subject,
    // text: '',
    html: genMailHtml(data)
  };

  transporter.sendMail(mailOptions, function(error, info){
    if(error){
      return console.log(error);
    }
    console.log('Message sent: ' + info.response);
  });
}

function genMailHtml(data) {
  return data['current'].reduce(function(p, c, i){
    let curTemp = genMailHtmlTemp(c, 'current');
    let hisTemp = genMailHtmlTemp(data['history'][i], 'history');
    p += (curTemp + hisTemp);
    return p;
  }, '');
}

function genMailHtmlTemp(data, type) {
  let template = `<div><h3>${data.name}</h3><h4 style="color: #ccc">${type}</h4><div>${data[priceField]}</div></div>`
  return template;
}

function scheduleMail() {
  var rule = new schedule.RecurrenceRule();
  rule.hour = 17;
  rule.minute = 30;
  var j = schedule.scheduleJob(rule, function(){
    getMarketData(true);
  });
}

scheduleMail();

// getMarketData(true);

module.exports = app;
