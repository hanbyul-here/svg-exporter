"use strict";

require("babel-polyfill");

var express = require('express');
var router = express.Router();
var fs = require('fs');
var jsdom = require('jsdom');

var d3 = require('d3');
var fetch = require('node-fetch');


//key  vector-tiles-xaDJOzg
var key = 'vector-tiles-xaDJOzg';

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

  if(req.body.startLat > req.body.endLat) {
    startLat = parseFloat(req.body.startLat);
    endLat = parseFloat(req.body.endLat);
  } else {
    startLat = parseFloat(req.body.endLat);
    endLat = parseFloat(req.body.startLat);
  }

  if(Math.abs(req.body.startLon) > Math.abs(req.body.endLon)) {
    startLon = parseFloat(req.body.startLon);
    endLon = parseFloat(req.body.endLon);
  } else {
    startLon = parseFloat(req.body.endLon);
    endLon = parseFloat(req.body.startLon);
  }

  // -74.0059700, 40.7142700
  // 74.0059700 W, 40.7142700 N

  var zoom = 15;

  var tileWidth = 100;

  var requestStartLon = long2tile(startLon,  zoom);
  var requestStartLat = lat2tile(startLat, zoom);

  var requestEndLon = long2tile(endLon, zoom);
  var requestEndLat = lat2tile(endLat, zoom);

  //"boundaries, buildings, earth, landuse, places, pois, roads, transit, water"
  // need uis for datakind, zoom
  var dataKind = "boundaries,earth,landuse,places,roads,transit,water"

  var dKinds = dataKind.split(',');

  var subJsons = [];

  for (var i = 0; i < dKinds.length; i++) {
    subJsons.push([])
  }


  var tilesToFetch = [];

  var latArr = [];
  var lonArr = [];

  for(let i = requestStartLon; i <= requestEndLon; i++) lonArr.push(i);
  for(let j = requestStartLat; j <= requestEndLat; j++) latArr.push(j);

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
    lon: tile2Lon(requestStartLon, zoom),
    lat: tile2Lat(requestStartLat, zoom),
    zoom: zoom
  };

  var outputLocation = 'svgmap'+ tilesToFetch[0][0].lon +'-'+tilesToFetch[0][0].lat +'-'+ centerLatLon.zoom +'.svg';

  var data;


  var allGeojsonPromise = new Promise(function(resolve, reject) {

    var responseGeojsons = [];

    var totalCallNum = tilesToFetch.length * tilesToFetch[0].length;

    var xarr = []
    var yarr = []

    for(let i = 0; i<tilesToFetch.length; i++) xarr.push(i);
    for(let j = 0; j<tilesToFetch[0].length; j++) yarr.push(j);

    for(let x of xarr) {
      for(let y of yarr) {
        var baseurl = "http://vector.mapzen.com/osm/"+dataKind+"/"+zoom+"/"+tilesToFetch[x][y].lon + "/" + tilesToFetch[x][y].lat + ".json?api_key="+key;
        fetch(baseurl)
        .then(function(res) {
          return res.json();
        })
        .then(function(json) {
          responseGeojsons.push({
            horIndex: x,
            verIndex: y,
            geodata: json
          });

          for(var key in json) {
            for(var featureName in dKinds) {
              if( key === dKinds[featureName]) {
                subJsons[featureName].push(json[key]);
              }
            }
          }

          if(responseGeojsons.length == totalCallNum) {
            responseGeojsons = subJsons;
            resolve(responseGeojsons);
          }
        })
        .catch(function(err) {
          console.log('error!')
          console.log(err)
        });
      }
    }
  })



  allGeojsonPromise
  .then(
    function(geojsons) {
    //break down geojsons into the categories


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


        var i,j;


        for(i = 0; i< geojsons.length; i++) {
          data = geojsons[i];

          /*var defs = svg.append('defs')
                    .append('clipPath')
                    .attr('id','tile-boundary-hor-'+data.horIndex+'-ver-'+data.verIndex)
                    .append('rect')
                    .attr('x',data.verIndex*tileWidth)
                    .attr('y',data.horIndex*tileWidth)
                    .attr('width',tileWidth)
                    .attr('height',tileWidth)*/

          var g = svg.append('g');
          for(var k = 0; k < data.length; k++) {
            for(var j = 0; j< data[k].features.length; j++) {
                var geoFeature = data[k].features[j];
                var previewPath = d3.geo.path().projection(previewProjection);
                var previewFeature = previewPath(geoFeature);

                if(previewFeature !== undefined) {
                  if(previewFeature.indexOf('a') > 0) ;
                  else {
                    g.append('path')
                      .attr('d', previewFeature)
                      .attr('fill','none')
                      .attr('stroke','black')
                  }
                }
            }
          }
                   // .attr('clip-path','url(#tile-boundary-hor-'+data.horIndex+'-ver-'+data.verIndex+')');
          /*for(var obj in data.geodata) {
            for(j = 0; j< data.geodata[obj].features.length; j++) {

              var geoFeature = data.geodata[obj].features[j];
              var previewPath = d3.geo.path().projection(previewProjection);
              var previewFeature = previewPath(geoFeature);

              if(previewFeature !== undefined) {
                if(previewFeature.indexOf('a') > 0) ;
                else {
                  g.append('path')
                    .attr('d', previewFeature)
                    .attr('fill','none')
                    .attr('stroke','black')
                }
              }
            }
          }
        }*/
      }

       fs.writeFile(outputLocation, window.d3.select('.container').html(),(err)=> {
          if(err) throw err;
          console.log('yess svg is there')
          process.exit()
       })
       return svg;
      }
    })
  })
  .then(function(svg) {
    console.log('process done, waiting for a svg file to be written');
    res.send(requestStartLon + ' ' + requestStartLat + 'process is done, waiting for a file to be written');
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