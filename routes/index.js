"use strict";

require("babel-polyfill");

var express = require('express');
var router = express.Router();
var fs = require('fs');
var jsdom = require('jsdom');

var d3 = require('d3');
var fetch = require('node-fetch');
var XMLHttpRequest = require('xhr2')

var config;
// suse key saved in config file if there is a config file in same directory
if (fs.existsSync('./config.js')) {
    var config = require('./config.js')
}


var Promise = require('promise/lib/es6-extensions');


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: "Let's make map" });
});


router.get('/request-map', function(req, res, next) {
  res.redirect('/', { title: "Let's make map" });
});


router.post('/request-map', function(req, res, next) {
  var startLat, endLat, startLon, endLon;

  // -74.0059700, 40.7142700
  // 74.0059700 W, 40.7142700 N
console.log(req.body);
  var zoom = parseInt(req.body.zoomLevel);

  var lat1 = lat2tile(parseFloat(req.body.startLat), zoom)
  var lat2 = lat2tile(parseFloat(req.body.endLat), zoom)

  var lon1 = long2tile(parseFloat(req.body.startLon), zoom)
  var lon2 = long2tile(parseFloat(req.body.endLon), zoom)

  if(lat1 > lat2) {
    startLat = lat2;
    endLat = lat1;
  } else {
    startLat = lat1;
    endLat = lat2;
  }

  if(lon1 > lon2) {
    startLon = lon2;
    endLon = lon1;
  } else {
    startLon = lon1;
    endLon = lon2;
  }


  var tileWidth = 100;

  //"boundaries, buildings, earth, landuse, places, pois, roads, transit, water"
  // need uis for datakind, zoom
 // var dataKind = "boundaries,earth,landuse,places,roads,water"
  // only dominant kinds from osm will be categorized


  //var dKinds = dataKind.split(',');
  var reformedJson = {};
  var subJsons = [];


  var dKinds = [];
  if(req.body.boundaries) dKinds.push('boundaries');
  if(req.body.earth) dKinds.push('earth');
  if(req.body.landuse) dKinds.push('landuse');
  if(req.body.places) dKinds.push('places');
  if(req.body.roads) dKinds.push('roads');
  if(req.body.water) dKinds.push('water');

  var dataKind = dKinds.join(',');

  for (var i = 0; i < dKinds.length; i++) {
    subJsons.push([])
    // this is sublayer for each data layer
    // should add more meaningful layers for each
    if(dKinds[i] === 'roads')
      reformedJson[dKinds[i]] = {
        major_road: {
          features: []
        },
        minor_road: {
          features: []
        },
        highway: {
          features:[]
        },
        etc: {
          features: []
        }
      }
    else
      reformedJson[dKinds[i]] = {
        etc: {
          features: []
        }
      }
  }

  var tilesToFetch = [];

  var latArr = [];
  var lonArr = [];

  var key = req.body.apikey || config.key;

  for(let i = startLon; i <= endLon; i++) lonArr.push(i);
  for(let j = startLat; j <= endLat; j++) latArr.push(j);
  for(let _lat of latArr) {
    var coords = [];
    for(let _lon of lonArr) {
      coords.push({
        lat: _lat,
        lon: _lon
      })
    }
    tilesToFetch.push(coords);
  }

  var centerLatLon = {
    lon: tile2Lon(startLon, zoom),
    lat: tile2Lat(startLat, zoom),
    zoom: zoom
  };

  var qps = 1000; // let's make only 1000 calls per sec
  var delayTime = 1000;


  var outputLocation = 'svgmap'+ tilesToFetch[0][0].lon +'-'+tilesToFetch[0][0].lat +'-'+ centerLatLon.zoom +'.svg';

  var data;

  var getGeojsonPromise = function (x, y) {
    var geoJsonPromise = new Promise(function(resolve, reject) {
      var baseurl = "http://vector.mapzen.com/osm/"+dataKind+"/"+zoom+"/"+tilesToFetch[x][y].lon + "/" + tilesToFetch[x][y].lat + ".json?api_key="+key;
      var timeout = Math.floor((x*y + y) / qps ) * delayTime;
      var request = new XMLHttpRequest();
      setTimeout(function () {
        request.open('GET', baseurl, true);
        request.onload = function() {
          if (request.status >= 200 && request.status < 400) {
            // Success!
            var data = JSON.parse(request.responseText);
            resolve(data);
          } else {
            // We reached our target server, but it returned an error
            reject();
            console.log('Server returend error')

          }
        };

        request.onerror = function() {
          // There was a connection error of some sort
          console.log('there was problem making call');
        };

        request.send();

      }, timeout);
    })

    return geoJsonPromise;
  }

  var promiseArrs = [];

  var xarr = []
  var yarr = []

  for(let i = 0; i<tilesToFetch.length; i++) xarr.push(i);
  for(let j = 0; j<tilesToFetch[0].length; j++) yarr.push(j);

  for(let x of xarr) {
    for(let y of yarr) {
      promiseArrs.push(getGeojsonPromise(x,y))
    }
  }



  Promise.all(promiseArrs)
  .then(function (result) {
    for (let response in result) {
      let responseResult = result[response]
      for (let dataFeature in responseResult) {
        // dataFeature here has all names
        for (let i = 0; i < responseResult[dataFeature].features.length; i++) {
          var feature = responseResult[dataFeature].features[i];
          var dataKindTitle = feature.properties.kind;
           if(reformedJson[dataFeature].hasOwnProperty(dataKindTitle)) {
             reformedJson[dataFeature][dataKindTitle].features.push(feature);
           }
           else {
             reformedJson[dataFeature]['etc'].features.push(feature)
           }
        }
      }
    }
    return reformedJson;
  //resolve(reformedJson)
  }, function (reason) {
    console.log(reason)
  }).then(function (reResult) {


    //d3 needs query selector from dom
    jsdom.env({

      html:'',
      features:{ QuerySelector:true }, //you need query selector for D3 to work
      done:function(errors, window) {
        window.d3 = d3.select(window.document);

        var svg = window.d3.select('body')
              .append('div').attr('class','container') //make a container div to ease the saving process
              .append('svg')
              .attr({
                xmlns: 'http://www.w3.org/2000/svg',
                width: tileWidth * tilesToFetch[0].length,
                height: tileWidth* tilesToFetch.length
              })

        var previewProjection = d3.geo.mercator()
                        .center([centerLatLon.lon, centerLatLon.lat])
                        //this are carved based on zoom 16, fit into 100px * 100px rect
                        .scale(600000* tileWidth/57.5 * Math.pow(2,(centerLatLon.zoom-16)))
                        .precision(.0)
                        . translate([0, 0])

        var previewPath = d3.geo.path().projection(previewProjection);

        for (let dataK in reformedJson) {
          let oneDataKind = reformedJson[dataK]
          let g = svg.append('g')
          g.attr('id',dataK)

          for(let subKinds in oneDataKind) {
            let tempSubK = oneDataKind[subKinds]
            let subG = g.append('g')
            subG.attr('id',subKinds)
            for(let f in tempSubK.features) {
              let geoFeature = tempSubK.features[f]
              let previewFeature = previewPath(geoFeature);


              if(previewFeature && previewFeature.indexOf('a') > 0) ;
              else {
                subG.append('path')
                  .attr('d', previewFeature)
                  .attr('fill','none')
                  .attr('stroke','black')
              }
            }
          }
        }
      fs.writeFile(outputLocation, window.d3.select('.container').html(),(err)=> {
          if(err) throw err;
          console.log('yess svg is there')
          res.send(startLon + ' ' + startLat + 'process is done, waiting for a file to be written');
       })
      //jsdom done function done
      }
    });
  })
  .catch(
    function(err) {
      console.log(err)
      res.send('error: ' + err);
  });


});

////here all maps spells are!
//convert lat/lon to mercator style number or reverse.
function long2tile(lon,zoom) {
  return (Math.floor((lon+180)/360*Math.pow(2,zoom)));
}
function lat2tile(lat,zoom)  {
  return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)));
}

//shold check it will work
function tile2Lon(tileLon, zoom) {
  return (tileLon*360/Math.pow(2,zoom)-180).toFixed(10);
}

function tile2Lat(tileLat, zoom) {
  return ((360/Math.PI) * Math.atan(Math.pow( Math.E, (Math.PI - 2*Math.PI*tileLat/(Math.pow(2,zoom)))))-90).toFixed(10);
}

module.exports = router;