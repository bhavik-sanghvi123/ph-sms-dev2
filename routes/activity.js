'use strict';
var util = require('util');

// Deps
const Path = require('path');
const JWT = require(Path.join(__dirname, '..', 'lib', 'jwtDecoder.js'));
var util = require('util');
var http = require('https');
const superagent = require('superagent');

exports.logExecuteData = [];

function logData(req) {
    exports.logExecuteData.push({
        body: req.body,
        headers: req.headers,
        trailers: req.trailers,
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query,
        route: req.route,
        cookies: req.cookies,
        ip: req.ip,
        path: req.path,
        host: req.host,
        fresh: req.fresh,
        stale: req.stale,
        protocol: req.protocol,
        secure: req.secure,
        originalUrl: req.originalUrl
    });
    console.log("body: " + util.inspect(req.body));
    console.log("headers: " + req.headers);
    console.log("trailers: " + req.trailers);
    console.log("method: " + req.method);
    console.log("url: " + req.url);
    console.log("params: " + util.inspect(req.params));
    console.log("query: " + util.inspect(req.query));
    console.log("route: " + req.route);
    console.log("cookies: " + req.cookies);
    console.log("ip: " + req.ip);
    console.log("path: " + req.path);
    console.log("host: " + req.host);
    console.log("fresh: " + req.fresh);
    console.log("stale: " + req.stale);
    console.log("protocol: " + req.protocol);
    console.log("secure: " + req.secure);
    console.log("originalUrl: " + req.originalUrl);
}

/*
 * POST Handler for / route of Activity (this is the edit route).
 */
exports.edit = function (req, res) {
    // Data from the req and put it in an array accessible to the main app.
    //console.log( req.body );
    logData(req);
    res.send(200, 'Edit');
};

/*
 * POST Handler for /save/ route of Activity.
 */
exports.save = function (req, res) {
    // Data from the req and put it in an array accessible to the main app.
    //console.log( req.body );

    logData(req);
    res.send(200, 'Save');
};

/*
 * POST Handler for /execute/ route of Activity.
 */
exports.execute = function (req, res) {
    console.log("===EXECUTE HAS BEEN RUN===");

    JWT(req.body, process.env.jwtSecret, (err, decoded) => {

        // verification error -> unauthorized request
        if (err) {
            console.error(err);
            return res.status(401).end();
        }

        if (decoded && decoded.inArguments && decoded.inArguments.length > 0) {
            console.log('##### decoded ####=>', decoded);
            
            // decoded in arguments
            var decodedArgs = decoded.inArguments[0];
            
            let campaignLookup = decodedArgs.campaignName; //This is the campaign name that will find the ID in service cloud
            
            // This function here is used for universal access token
            // Super Agent post to submit 
            //If the smsBoolean == false it means that it DID NOT OPT OUT of SMS.
            // if (decodedArgs.smsBoolean == 'False') {
                let singleQuoteRegex = /'/g;
                
                var axios = require('axios');
                axios.post(
					'https://api.m360.com.ph/v3/api/globelabs/mt/LT1vnjB3yE',{
					//'https://api.m360.com.ph/v3/api/globelabs/mt/LT1vnjB3yE?access_token=EVcvVeC_ONoyUqRoigWMxkWKzjntsMQCsYtpFSUVyYc'
					//(Roger comment it) 'https://devapi.globelabs.com.ph/smsmessaging/v1/outbound/9645/requests', { // Retrieving of token
                    app_id: 'xGLehBnX4XH9diM5ddcXAeH4EG46heBX',
                    app_secret: '789583e726278e5a2a1a77e4fabb510f617e749075a80a57ec78f872b7255445',
                    passphrase: 'LT1vnjB3yE',
                    message: decodedArgs.textMessage,
                    address: decodedArgs.phoneNumber 
                })
                .then(function (response) {
                    console.log('res body >>', response);
                    sendingToSFDC('Completed', campaignLookup, decodedArgs.contactID, decodedArgs.shortMsg.replace(singleQuoteRegex, '&#39;') );
                }).catch(function (error) {
                    console.log('error msg from supergent post >> ', error);
                    console.log('error response from supergent post >> ', error.response);
                    sendingToSFDC('Failed', campaignLookup, decodedArgs.contactID, decodedArgs.shortMsg.replace(singleQuoteRegex, '&#39;') );
                });
            // }
        
            logData(req);
            res.status(200).send('Execute');
        } else {
            console.error('inArguments invalid.');
            return res.status(400).end();
        }
    });
};


// sendingToSFDC('Completed','PH5.2 – Lapsed User Promo 3 – Similac', '0030k00000oQzQiAAK');
// statusOfMsg = Completed || Failed
function sendingToSFDC (statusOfMsg, campaignName, contactID, messageName) { //Function to connect to postgres Heroku Connect
    const { Pool } = require('pg');
    //const connectionString = 'postgres://u13p9h7t4po321:p9ae154ede820b08f344d2e54167df6a1d38f501fcd36c85bdbf6349a9ecbb4f2@ec2-52-197-48-67.ap-northeast-1.compute.amazonaws.com:5432/dadpcdirgrberd';
    const connectionString = 'postgres://uv3bf39oboo6i:p17596604ecf6ea97e986f03bcb98f289de47a34cecc556e3703f27c088838798@ec2-52-197-48-67.ap-northeast-1.compute.amazonaws.com:5432/dadpcdirgrberd';
    const pool = new Pool({
        connectionString: connectionString
    });

    // INSERT INTO Customer (FirstName, LastName) VALUES ('Anita', 'Coats')
    //(Roger comment) let queryCampaignID = `SELECT sfid, name FROM salesforcetest.Campaign WHERE Name = '${campaignName}'`;
    let queryCampaignID = `SELECT sfid, name FROM salesforcetest_iics.Campaign WHERE Name = '${campaignName}'`;

    pool.query(queryCampaignID, (err, res) => {
        if (res.rows[0]) {
            console.log('ID of the result >>> ',res.rows[0].sfid);
            console.log('Name of the result >>> ',res.rows[0].name);
            let campaignID = res.rows[0].sfid;

            //(Roger comment) let insertMobileSend = `INSERT INTO salesforcetest.et4ae5__SMSDefinition__c (et4ae5__Campaign__c, et4ae5__contact__c, et4ae5__SendStatus__c, et4ae5__Campaigns__c, et4ae5__smsName__c) VALUES ('${campaignID}', '${contactID}', '${statusOfMsg}', '${campaignName}', '${messageName}') `;
            let insertMobileSend = `INSERT INTO salesforcetest_iics.et4ae5__SMSDefinition__c (et4ae5__Campaign__c, et4ae5__contact__c, et4ae5__SendStatus__c, et4ae5__Campaigns__c, et4ae5__smsName__c) VALUES ('${campaignID}', '${contactID}', '${statusOfMsg}', '${campaignName}', '${messageName}') `;
            pool.query(insertMobileSend, (err, res) => {
                console.log(err, res);
                pool.end();
            });
        }
    });
}

/*
 * POST Handler for /publish/ route of Activity.
 */
exports.publish = function (req, res) {
    
    // Data from the req and put it in an array accessible to the main app.
    //console.log( req.body );
    logData(req);
    res.status(200).send('Publish');
};

/*
 * POST Handler for /validate/ route of Activity.
 */
exports.validate = function (req, res) {
    // Data from the req and put it in an array accessible to the main app.
    //console.log( req.body );
    logData(req);
    res.status(200).send('Validate');
};

/*
 * POST Handler for /Stop/ route of Activity.
 */
exports.stop = function (req, res) {
    // Data from the req and put it in an array accessible to the main app.
    //console.log( req.body );
    logData(req);
    res.status(200).send('Stop');
};

/*
 * GET Handler for requesting the template type.
 */
exports.requestTemplate = function (req, res) {
    const tokenURL = 'https://mcrcd9q885yh55z97cmhf8r1hy80.auth.marketingcloudapis.com/v1/requestToken';
    // const queryURL = 'https://mcrcd9q885yh55z97cmhf8r1hy80.rest.marketingcloudapis.com/asset/v1/content/categories';
    const queryURL = 'https://mcrcd9q885yh55z97cmhf8r1hy80.rest.marketingcloudapis.com/asset/v1/content/assets?$pageSize=2500&$page=1&$orderBy=name';
    
    var axios = require('axios');
    axios.post(tokenURL, { // Retrieving of token
        grant_type: 'client_credentials',
        client_id: 'xbv8eehpk7nks62jbcqj6ebs',//'y6xffr6xu7ycdbsi1laoms2a',
        client_secret: '7Tcy9fkZHZrtkEd3V53W1DPq'//''oKkyc5gP26ibpgO7P8h0r8YC
    })
    .then(function (response) {
        let accessToken = response.data['access_token']; // After getting token, parse it through to grab the individual categories

        axios.get(queryURL, { //Query of Individual items
            headers: { Authorization: `Bearer ${accessToken}` } 
        }).then((response) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(response.data, null, 3));
        }).catch(function (error) {
            console.log(error);
        });

    }).catch(function (error) {
        console.log(error);
    });
};
