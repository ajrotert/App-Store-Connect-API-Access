const functions = require('firebase-functions');
const jwt = require('jsonwebtoken');
const https = require('https');
const express = require('express');
const engines = require('consolidate');
var pako = require('pako');

const app = express();
app.engine('hbs', engines.handlebars);
app.set('views', './views')
app.set('view engine', 'hbs')

let issuerId = "found-in-appstore-connect";
let apiKeyId = "found-from-private-key-file";
//let privateKey = fs.readFileSync(`./Apple_Key/AuthKey_${apiKeyId}.p8`); 
let privateKey = 'copy and paste p8 key as plain text. Include the begin and end lines, along with \n between each line'

let now = Math.round((new Date()).getTime() / 1000) + 1199;
let payload = {
    "iss": issuerId,
    "exp": now,
    "aud": "appstoreconnect-v1"
};
let signOptions = {
    "algorithm": "ES256",
    header: {
        "alg": "ES256",
        "kid": apiKeyId,
        "typ": "JWT"
    }
};

let token = jwt.sign(payload, privateKey, signOptions);
var getOptionsYear = function (year) {
    var options19 = {
        host: "api.appstoreconnect.apple.com",
        //path: '/v1/apps/1515131292'
        path: `/v1/salesReports?filter[frequency]=YEARLY&filter[reportDate]=${year}&filter[reportSubType]=SUMMARY&filter[reportType]=SALES&filter[vendorNumber]=88221566&filter[version]=1_0`,
        method: 'GET',
        headers: {
            'Accept': 'application/a-gzip, application/json',
            'Authorization': 'Bearer ' + token
        }
    };
    return options19;
};

var getOptionsMonth = function (year, month) {
    //YYYY-MM 
    var options20 = {
        host: "api.appstoreconnect.apple.com",
        path: `/v1/salesReports?filter[frequency]=MONTHLY&filter[reportDate]=${year}-${month}&filter[reportSubType]=SUMMARY&filter[reportType]=SALES&filter[vendorNumber]=88221566&filter[version]=1_0`,
        method: 'GET',
        headers: {
            'Accept': 'application/a-gzip, application/json',
            'Authorization': 'Bearer ' + token
        }
    };
    return options20;
};

app.get('/app', (request, response) => {

    //1: app downloads, 3: redownloads, 8: app updates
    var units = 0;
    var dates = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    var req = https.request(getOptionsYear(2019), (res) => {
        var pti = [0, 0, 0, 0, 0, 0, 0, 0];
        res.on('data', function (chunk) {

            var dataFromFile = pako.inflate(chunk, { to: 'string' })
            dataFromFile = dataFromFile.trim();
            var dataFromFileArray = dataFromFile.split('\n');
            var i;
            for (i = 1; i < dataFromFileArray.length; i++) {
                var lineDataFromFileArray = dataFromFileArray[i].split('\t');
                pti[parseInt(lineDataFromFileArray[6])] += parseInt(lineDataFromFileArray[7])
            }
            console.log(`Total Units for 2019: ${pti[1]}`);
            units += pti[1];
            response.render('apps', { text: units });
        });

    });
    req.on('error', (e) => {
        console.log(`error: ${e.message}`);
    });
    req.end();

});

exports.app = functions.https.onRequest(app);
