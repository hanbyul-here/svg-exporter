"use strict";

require("babel-polyfill");

var express = require('express');
var router = express.Router();
var fs = require('fs');
var jsdom = require('jsdom');

var d3 = require('d3');
var XMLHttpRequest = require('xhr2')

// use key saved in config file if there is a config file in same directory
if (fs.existsSync( __dirname + '/config.js')) {
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

function setupJson(dKinds) {
  var formattedJson = {};
  var dataKind = dKinds.join(',');

  for (var i = 0; i < dKinds.length; i++) {
    // this is sublayer for each data layer
    // should add more meaningful layers for each
    if(dKinds[i] === 'roads') {
      formattedJson[dKinds[i]] = {
        major_road: {
          features: []
        },
        minor_road: {
          features: []
        },
        highway: {
          features:[]
        },
        aerialway: {
          features: []
        },
        rail: {
          features:[]
        },
        path: {
          features:[]
        },
        ferry: {
          features:[]
        },
        etc: {
          features: []
        }
      }
    } else if (dKinds[i] === 'boundaries') {
      formattedJson[dKinds[i]] = {
        country: {
          features: []
        },
        county: {
          features: []
        },
        disputed: {
          features: []
        },
        indefinite: {
          features: []
        },
        interminate: {
          features: []
        },
        lease_limit: {
          features: []
        },
        line_of_control: {
          features: []
        },
        locality: {
          features: []
        },
        microregion: {
          features: []
        },
        map_unit: {
          features: []
        },
        region: {
          features: []
        },
        etc: {
          features: []
        }
      }
    } else if (dKinds[i] === 'water') {
      formattedJson[dKinds[i]] = {
        basin: {
          features: []
        },
        bay: {
          features: []
        },
        dock: {
          features: []
        },
        lake: {
          features: []
        },
        ocean: {
          features: []
        },
        river: {
          features: []
        },
        riverbank: {
          features: []
        },
        swimming_pool: {
          features: []
        },
        etc: {
          features: []
        }
      }
    }
    else
      formattedJson[dKinds[i]] = {
        etc: {
          features: []
        }
      }
  }
  return formattedJson;
}


function getTilesToFetch(startLat, endLat, startLon, endLon) {
  const tilesToFetch = [];
  // for(let i = startLon; i <= endLon; i++) lonArr.push(i);
  for(let j = startLat; j <= endLat; j++) {
    const coords = [];
    for(let i = startLon; i <= endLon; i++) {
      coords.push({
        lat: j,
        lon: i
      });
    }
    tilesToFetch.push(coords);
  }
  return tilesToFetch;
}

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

  // "boundaries, buildings, earth, landuse, places, pois, roads, transit, water"
  // need uis for datakind, zoom

  var dKinds = [];
  if(req.body.boundaries) dKinds.push('boundaries');
  if(req.body.earth) dKinds.push('earth');
  if(req.body.landuse) dKinds.push('landuse');
  if(req.body.places) dKinds.push('places');
  if(req.body.roads) dKinds.push('roads');
  if(req.body.water) dKinds.push('water');

  var tilesToFetch = getTilesToFetch(startLat, endLat, startLon, endLon);

  var key = req.body.apikey || config.key;

  var delayTime = 1000;

  var outputLocation = 'svgmap'+ tilesToFetch[0][0].lon +'-'+tilesToFetch[0][0].lat +'-'+zoom +'.svg';

  var data;

  var xCount = tilesToFetch.length-1;//latArr.length - 1;
  var yCount = tilesToFetch[0].length-1;//lonArr.length - 1;
  var originalYCount = yCount;


  function getURL(x, y) {
    var xc = x;
    var yc = y;
    if (x < 0) xc = 0;
    if (y < 0) yc = 0;

    return "https://tile.mapzen.com/mapzen/vector/v1/all/"+zoom+"/"+tilesToFetch[xc][yc].lon + "/" + tilesToFetch[xc][yc].lat + ".json?api_key="+key;
  }

  var jsonArray = [];

  function makeCall() {
    var request = new XMLHttpRequest();
    var url = getURL(xCount, yCount);
    console.log(url);
    request.open('GET', url, true);

    request.onload = function() {
      if (request.status >= 200 && request.status < 400) {
        // Success!
        var data = JSON.parse(request.responseText);
        jsonArray.push(data);

        if (xCount > 0) {
          if (yCount > 0) {
            yCount--;
          } else {
            xCount--;
            yCount = originalYCount;
          }
          setTimeout(makeCall, delayTime);
        } else {
          if (xCount === 0) {
            if (yCount > 0) {
              yCount--;
              setTimeout(makeCall, delayTime);
            } else {
              bakeJson(jsonArray);
            }
          }
        }
      } else {
        console.log('We reached our target server, but it returned an error')
      }
    };

    request.onerror = function() {
      console.log('There was a connection error of some sort');
      // There was a connection error of some sort
    };
    request.send();
  }


function bakeJson(resultArray) {
  var geojsonToReform = setupJson(dKinds);
  // response geojson array
  for (let result of resultArray) {
    // inside of one object
    for (let response in result) {
      // if tthe property is one of dataKinds that user selected
      if (dKinds.indexOf(response) > -1) {
        let responseResult = result[response];
          for (let feature of responseResult.features) {
            var dataKindTitle = feature.properties.kind;
            if(geojsonToReform[response].hasOwnProperty(dataKindTitle)) {
              geojsonToReform[response][dataKindTitle].features.push(feature);
            } else {
              geojsonToReform[response]['etc'].features.push(feature)
            }
          }
        }
      }
    }
    writeSVGFile(geojsonToReform);
  }

  function writeSVGFile(reformedJson) {
    //d3 needs query selector from dom
    jsdom.env({
      html: '',
      features: { QuerySelector: true }, //you need query selector for D3 to work
      done: function(errors, window) {
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
                        .center([tile2Lon(startLon, zoom), tile2Lat(startLat, zoom)])
                        //this are carved based on zoom 16, fit into 100px * 100px rect
                        .scale(600000* tileWidth/57.5 * Math.pow(2,(zoom-16)))
                        .precision(.0)
                        . translate([0, 0])

        var previewPath = d3.geo.path().projection(previewProjection);

        for (let dataK in reformedJson) {
          let oneDataKind = reformedJson[dataK];
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
        })

      //jsdom done function done
      }
    })
  }

  // render response page first
  res.send(startLon + ' ' + startLat + 'request submitted, waiting for a file to be written');
  makeCall();
});


// here all maps spells are!
// convert lat/lon to mercator style number or reverse.
function long2tile(lon,zoom) {
  return (Math.floor((lon+180)/360*Math.pow(2,zoom)));
}
function lat2tile(lat,zoom)  {
  return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)));
}

function tile2Lon(tileLon, zoom) {
  return (tileLon*360/Math.pow(2,zoom)-180).toFixed(10);
}

function tile2Lat(tileLat, zoom) {
  return ((360/Math.PI) * Math.atan(Math.pow( Math.E, (Math.PI - 2*Math.PI*tileLat/(Math.pow(2,zoom)))))-90).toFixed(10);
}

module.exports = router;