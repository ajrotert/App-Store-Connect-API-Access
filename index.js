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

admin.initializeApp({
    //credential: admin.credential.applicationDefault()
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
//document: date the data was collected. YYYY - MM - DD
var collections = db.collection("APIAccessData");

function getDataFromDate(date) {
    return collections.doc(date).get()
}
function setDataFromDate(date, appDownloads) {
    collections.doc(date).set({
        downloads: appDownloads
    });
}

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
var getOptionsDaily = function (year, month, day) {
    var options19 = {
        host: "api.appstoreconnect.apple.com",
        //path: '/v1/apps/1515131292' 
        path: `/v1/salesReports?filter[frequency]=DAILY&filter[reportDate]=${year}-${month}-${day}&filter[reportSubType]=SUMMARY&filter[reportType]=SALES&filter[vendorNumber]=88221566&filter[version]=1_0`,
        method: 'GET',
        headers: {
            'Accept': 'application/a-gzip, application/json',
            'Authorization': 'Bearer ' + token
        }
    };
    return options19;
};

app.get('/app', (request, response) => {

    //1: app downloads, 3: redownloads, 8: app updates
    var units = 0;
    var months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    var days = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31']

    var datetime = new Date();
    datetime.setDate(datetime.getDate() - 1);
    datetime.setHours(datetime.getHours() - 14);
    let year = datetime.getFullYear();
    let month = datetime.getMonth();
    let day = datetime.getDate();

    let date = `${year} - ${months[month]} - ${days[day - 1]}`;
    console.log(date);

    getDataFromDate(date)
        .then(doc => {

            if (!doc.exists) {
                console.log('Date not found in database');
                //Date not found in database
                var req = https.request(getOptionsDaily(year, months[month], days[day - 1]), (res) => {
                    var pti = [0, 0, 0, 0, 0, 0, 0, 0];

                    console.log('Status: ' + res.statusCode + '\n');
                    console.log('Status: ' + res.statusMessage + '\n');
                    console.log('Headers: ' + JSON.stringify(res.headers) + '\n');
                    res.on('data', (chunk) => {

                        var dataFromFile = pako.inflate(chunk, { to: 'string' })

                        dataFromFile = dataFromFile.trim();
                        var dataFromFileArray = dataFromFile.split('\n');
                        var i;
                        for (i = 1; i < dataFromFileArray.length; i++) {
                            var lineDataFromFileArray = dataFromFileArray[i].split('\t');
                            try {
                                pti[parseInt(lineDataFromFileArray[6])] += parseInt(lineDataFromFileArray[7]);
                            }
                            catch (err) {
                                console.log(`Cannot parse type: ${lineDataFromFileArray[6]} Error: ${err}`);
                            }
                        }
                        console.log(`Total Units: ${pti[1]}`);
                        units += pti[1];
                        setDataFromDate(date, units);

                        response.render('apps', { _year: year, _month: months[month], _day: days[day - 1], text: units, generatedFrom: "App Store Connect API" });
                    });

                });
                req.on('error', (e) => {
                    console.log(`error: ${e.message}`);
                });
                req.end();
            }
            else {
                console.log('Document data found in database:', doc.data().downloads);
                //Found in database
                response.render('apps', { _year: year, _month: months[month], _day: days[day - 1], text: doc.data().downloads, generatedFrom: "Firebase Cloud Firestore Database" });
            }
            return;
        })
        .catch((err) => {
            console.log('Error getting documents', err);
        });


});

exports.app = functions.https.onRequest(app);


