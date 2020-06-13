//Node JS Modules 
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const jwt = require('jsonwebtoken');
const https = require('https');
const express = require('express');
const engines = require('consolidate');
var pako = require('pako');

//Build Express App template webpage
const app = express();
app.engine('hbs', engines.handlebars);
app.set('views', './views')
app.set('view engine', 'hbs')

//Renders webpage
app.get('/app', (request, response) => {

    //Initialize firebase firestore db 
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();

    //route to db data
    var collections = db.collection("APIAccessData");

    //Returns data for a given date
    function getDataFromDate(date) {
        return collections.doc(date).get()
    }

    //Sets data for a given date 
    function setDataFromDate(date, appDownloads) {
        collections.doc(date).set({
            downloads: appDownloads
        });
    }

    //Credentials needed to connect to API
    let issuerId = "found-in-appstore-connect";
    let apiKeyId = "found-from-private-key-file";
    //Either route will work for private key
    //let privateKey = fs.readFileSync(`./Apple_Key/AuthKey_${apiKeyId}.p8`);
    let privateKey = 'copy and paste p8 key as plain text. Include the begin and end lines, along with \n between each line'

    //Expires date, set 20m into future
    let now = Math.round((new Date()).getTime() / 1000) + 1199;

    //Setup for token
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

    //Options for what data to have returned
    var getOptionsYear = function (year) {
        //YYYY 
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
            //YYYY-MM-DD 
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



    var units = 0;
    //Tables to format dates properly
    var months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    var days = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31']

    var datetime = new Date();
    datetime.setDate(datetime.getDate() - 1);
    datetime.setHours(datetime.getHours() - 6);
    let year = datetime.getUTCFullYear();
    let month = datetime.getUTCMonth();
    let day = datetime.getUTCDate();

    let date = `${year} - ${months[month]} - ${days[day - 1]}`;

    const current = new Date();
    console.log(`Current date: ${current.getUTCFullYear()}-${current.getUTCMonth()}-${current.getUTCDate()}-H${current.getUTCHours()} Request date: ${date} - H${datetime.getUTCHours()}`);

    //Checks database for a given date
    getDataFromDate(date)
        .then(doc => {

            if (!doc.exists) {
                console.log('Date not found in database');
                //Date not found in database
                //External request to apple API 
                var req = https.request(getOptionsDaily(year, months[month], days[day - 1]), (res) => {
                    var pti = [0, 0, 0, 0, 0, 0, 0, 0];

                    console.log('Status: ' + res.statusCode + '\n');

                    res.on('data', (chunk) => {

                        if (res.statusCode === 200) {

                            var dataFromFile = pako.inflate(chunk, { to: 'string' })
                                //1: app downloads, 3: redownloads, 8: app updates 
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
                        }
                        else {
                            response.render('apps', { _year: year, _month: months[month], _day: days[day - 1], text: res.statusMessage, generatedFrom: "Failed to connect to App Store Connect API. Please refresh, or try again later." });
                            console.log(`Status Message: ${res.statusMessage} \n`);
                            console.log(`Request Date: Y:${year} M:${months[month]} D:${days[day - 1]} H:${datetime.getHours()}`);
                            console.log(`Expires: ${now}`);
                            console.log(`Headers: ${JSON.stringify(res.headers)}\n`);
                        }
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
//Google Cloud Functions
exports.app = functions.https.onRequest(app);


/*
 * Following lines are redacted for privacy and security

let issuerId = "found-in-appstore-connect";
let apiKeyId = "found-from-private-key-file";
//Either route will work for private key
let privateKey = fs.readFileSync(`./Apple_Key/AuthKey_${apiKeyId}.p8`);
let privateKey = 'copy and paste p8 key as plain text. Include the begin and end lines, along with \n between each line'

*/