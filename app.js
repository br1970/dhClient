//-----------------------------------------------------------------------------
// Name:       dhClient Service                                   
//                                                                              
// Purpose:    Microservice                                                     
//                                                                              
// Interfaces: MongoDB database                                                 
//                                                                              
// Author:     Sal Carceller                                                    
//                                                                              
//-----------------------------------------------------------------------------
var http         = require('http');
var url          = require('url');
var express      = require('express');
var bodyParser   = require('body-parser');
var request      = require('request');
var mongoClient  = require('mongodb').MongoClient;
var helper       = require('./dhCommon/helpers'); // include helper functions from helpers.js

//-----------------------------------------------------------------------------
// Set up express                                    
var app = express();
var server = http.createServer(app);
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json()); // for parsing application/json
//-----------------------------------------------------------------------------

// what host and port should we listen on?
//var _host = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';  // host to listen on
var _port = 8082; // port to listen on

//-----------------------------------------------------------------------------
// return code definitions, used in json responses {"RC": _rcOK}  
var _rcOK      = 0;
var _rcWarning = 1;
var _rcError   = 2;
var _rcUnknown = 99;
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Example dhClient (Customer) json record
//-----------------------------------------------------------------------------
/*
{
  // Auto generated fields, when creating a record do not pass these in 
  "_id": "mongo generated",
  "clientId": "auto generated", 

  // required fields
  "clientName": 
  {
    "clientFN": "Richard",
    "clientLN": "Hendrix"
  },
  "clientInfo": 
  {
    "address": "101 Valley Steet",
    "city": "Glendale",
    "state": "California",
    "zip": "91201",
    "phone": "555-676-8907",
    "email": "jh@music.com"
  },

  // optional fields
  "agentId": 1000,
  "suggestedProperties": 
  [
    {
      "propertyId": 2000,
      "propertyState": 0,
      "askingPrice": 320000,
      "rating": 0,
      "comments": 
      [
        {
          "comment": "This is a beautiful home"
        }
      ]
    }
  ],
  "minAskingPrice": 200000,
  "maxAskingPrice": 400000
}
*/

//-----------------------------------------------------------------------------
// Main code body
//-----------------------------------------------------------------------------
console.log("DreamHome.dhClient service ==> Begin Execution.");

// wait for DB module to fully initialize and connect to the backend DB
// we don't want to start the node.js server listening till we know we are fully connected to the DB
helper.dbInit( function(err)
{
  if(!err)
  { // DB connections have been established. 
    console.log('  ... application has successfully connected to the DB');
  }
  else
  { // OH no! something has gone wrong building DB connections!
    // we still proceed and start the server listening
    // but we mark the server as having a severe DB connection error!
    console.log('  ... WARNING: application failed to connect with the backend DB!');
  }

  // Start the node.js server listening
  // even if the backend DB connection fails we still want to service requests
  app.listen(_port);

  console.log('  ... application now listening on port ' + _port);
});


//-----------------------------------------------------------------------------
// fetch/get a client/customer record by clientId (cid)
//-----------------------------------------------------------------------------
app.get('/client/:cid', function(req, res) 
{
  var retjson = {"RC":_rcOK};       // assume a good json response
  var statusCode = 200;             // assume valid http response code=200 (OK, good response)

  // get the clientId (cid) parm that came in on the request
  // it comes in as a string and MUST be converted to a base10 integer
  var cid = parseInt(req.params.cid, 10);

  var cref = helper.crefClient();   // obtain the dhClient collection handle/refrence
  var dbQuery = {'clientId':cid};   // setup the query for locating the client record by cid

//console.log('  ... dbQuery ('+JSON.stringify(dbQuery)+')');

  // fetch the record from the collection based on the query desired.
  cref.findOne( dbQuery, function(err, dbData)
  {
    // test for error and be sure we found the data record
    if(!err && dbData)
    {
//console.log('GET /client/:'+cid+' dbData('+JSON.stringify(dbData)+')');
      // set the return json as the record found
      retjson = dbData;
    }
    else
    { // query failed
      // log an error msg
      console.error('GET /client/:'+cid+' failed to get/read client record ('+cid+') from DB!');

      retjson = {};
      retjson.RC = _rcError;
      retjson.error = "Client record("+cid+") not found!";
    
      // set http status code
      statusCode = 404;   // 404 not found
    }

    // send the http response message
    helper.httpJsonResponse(res,statusCode,retjson);
  });
  
  return;
});

//-----------------------------------------------------------------------------
// functions to get/fetch records from the collections
//-----------------------------------------------------------------------------
app.get('/clients', function (req, res) 
{
//  console.log("app.get(./clients function has been called.");

  var cref = helper.crefClient();
  var dbQuery = {};               // query used for looking up records in the collection

  // fetch records from the collection based on the query desired.
  cref.find(dbQuery).toArray( function(err, items) 
  {
    if(!err)
    {
      // send the http response message
      var retjson = {"RC":_rcOK};      // assume a good json response
      var statusCode = 200;            // assume valid http response code=200 (OK, good response)

      retjson.items = items;

      // send the http response message
      helper.httpJsonResponse(res,statusCode,retjson);
    }
  });

  return;
});

//-----------------------------------------------------------------------------
// Delete a client customer record
//-----------------------------------------------------------------------------
app.delete('/client/:cid', function(req, res) 
{
  var retjson = {"RC":_rcOK};       // assume a good json response
  var statusCode = 200;             // assume valid http response code=200 (OK, good response)

  // get the clientId (cid) parm that came in on the request
  // it comes in as a string and MUST be converted to a base10 integer
  var cid = parseInt(req.params.cid, 10);

  var cref = helper.crefClient();   // obtain the dhClient collection handle/refrence
  var dbQuery = {'clientId':cid};   // setup the query for locating the client record by cid

//console.log('  ... dbQuery ('+JSON.stringify(dbQuery)+')');

  // send the http response message
  retjson.success = "Delete client record("+cid+").";
  res.status(statusCode).json(retjson);
  res.end;

  return;
});

//-----------------------------------------------------------------------------
// Create a new client customer record
//-----------------------------------------------------------------------------
app.post('/client', function (req, res) 
{
  var retjson = {"RC":_rcOK};      // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)
  var clientRecord = req.body;     // get the request body json data

  // add the client record to the DB
  _addClientRecord( clientRecord, function(result)
  {
     // send the http response message
     retjson.data = result; // put the record added in the reply
     retjson.success = "Created a new client record.";
     res.status(statusCode).json(retjson);
     res.end;
  });

  return;
});

//-----------------------------------------------------------------------------
// Update a client customer record
//-----------------------------------------------------------------------------
app.put('/client', function (req, res) 
{
  var retjson = {"RC":_rcOK};      // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)
  var clientRecord = req.body;     // get the request body json data

  _updateClientRecord( clientRecord, function()
  {
    // send the http response message
    retjson.success = "Update a client record!";
    res.status(statusCode).json(retjson);
    res.end;
  });

  return;
});

//-----------------------------------------------------------------------------
// Patch a client customer record
//-----------------------------------------------------------------------------
app.patch('/client', function (req, res) 
{
  var retjson = {"RC":_rcOK};      // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)
  var clientRecord = req.body;     // get the request body json data

  _updateClientRecord( clientRecord, function()
  {
    // send the http response message
    retjson.success = "Patch a client record!";
    res.status(statusCode).json(retjson);
    res.end;
  });

  return;
});

//-----------------------------------------------------------------------------
// Simple echo get method, used to sanity test service
//-----------------------------------------------------------------------------
app.get('/echo', function (req, res) 
{
//  console.log("app.get(./echo function has been called.");

  var retjson = {"RC":_rcOK};      // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)

  // send the http response message
  retjson.success = "Echo from DreamHome.dhClient service!";
  res.status(statusCode).json(retjson);
  res.end;

  return;
});


//-----------------------------------------------------------------------------
// Private function start here
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// adds a new client record to mongodb
//-----------------------------------------------------------------------------
function _addClientRecord(jsonRecord,callback)
{
console.log("DEBUG1 - " + JSON.stringify(jsonRecord) );

  // get refrence handle to the Client collection
  var cref = helper.crefClient();

  // create and add the first client record to the Client collection.
  // generate a unique Client Id key for this real-estate client record
  helper.genClientId(
  function(err, pkId)
  {
    // add the unique clientId to the record
    jsonRecord.clientId = pkId;
console.log("DEBUG2 - " + JSON.stringify(jsonRecord) );

    if(!err)
    { // pkId generated 
      // add the record to the DB clientCollection
      cref.insertOne( jsonRecord, {w:1, j:true},
      function(err,result)
      { 
        if(!err)
        {
console.log("Client record "+pkId+" added to Client collection.");
          //result.pkId = pkId; // return the primary key for the record created
          callback(jsonRecord);
        }
      });
    }
  });

  return;
}

//-----------------------------------------------------------------------------
// updates an existing client record in mongodb
//-----------------------------------------------------------------------------
function _updateClientRecord(clientRecord,callback)
{
console.log("DEBUG1 - " + JSON.stringify(clientRecord) );

  callback();

  return;
}

//-----------------------------------------------------------------------------
// reads the request body data
//-----------------------------------------------------------------------------
function _getReqBody(req,callback)
{
console.log("DEBUG1.1");
  var body = [];
  req.on('data', function(chunk) 
  {
console.log("DEBUG1.2");
    body.push(chunk);
  }).on('end', function() 
  {
console.log("DEBUG1.3");
    body = Buffer.concat(body).toString();
    callback(body);
  });
}

