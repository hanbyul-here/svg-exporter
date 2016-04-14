"use strict";

require("babel-polyfill");

var express = require('express');
var router = express.Router();
var XMLHttpRequest = require('xhr2');
var fs = require('fs');
var jsdom = require('jsdom');

var mergeGeojson = require('geojson-merge');

var d3 = require('d3');
var fetch = require('node-fetch');
//var reproject = require('reproject');
//var proj4 = require('proj4');

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


function fetchTheTile(baseurl) {
  var geojson;
  fetch(baseurl)
    .then(function(res) {
      return res.json();
    })
    .then(function(json) {
      geojson = json;
    })
    .catch(function(err) {
      console.log('error!')
      console.log(err)
      return 'a';
    });

  return geojson;
}

router.post('/request-map', function(req, res, next) {
  //console.log(req.body.lon);
  // -74.0059700, 40.7142700
  // 74.0059700 W, 40.7142700 N

  var outputLocation = 'test.svg';

  var requestLon = long2tile(-74.0059700,  16);
  var requestLat = lat2tile(40.7142700 , 16);


  var centerLatLon = {
    lon: tile2Lon(requestLon, 16),
    lat: tile2Lat(requestLat, 16),
    zoom: 16
  }

  var tilesToFetch = [
    [{lon: 19295, lat: 24639}, {lon: 19296, lat: 24639}, {lon: 19297, lat: 24639}],
    [{lon: 19295, lat: 24640}, {lon: 19296, lat: 24640}, {lon: 19297, lat: 24640}],
    [{lon: 19295, lat: 24641}, {lon: 19296, lat: 24641}, {lon: 19297, lat: 24641}]
  ]


  //var baseurl = "http://vector.mapzen.com/osm/all/16/"+requestLon + "/" + requestLat + ".json?api_key="+key;

  var data;
  var svg;

  var tileWidth = 100;

  var wNum = 1;
  var hNum = 1;


  var allGeojsonPromise = new Promise(function(resolve, reject) {

    var i,j;
    var responseGeojsons = [];

    var totalCallNum = tilesToFetch.length * tilesToFetch[0].length;

    var xarr = []
    var yarr = []

    for(let i = 0; i<tilesToFetch.length; i++) xarr.push(i);
    for(let j = 0; j<tilesToFetch[0].length; j++) yarr.push(j);

    for(let x of xarr) {
      for(let y of yarr) {
        var baseurl = "http://vector.mapzen.com/osm/all/16/"+tilesToFetch[x][y].lon + "/" + tilesToFetch[x][y].lat + ".json?api_key="+key;
        fetch(baseurl)
        .then(function(res) {
          return res.json();
        })
        .then(function(json) {
          console.log('?')
          responseGeojsons.push({
            horIndex: x,
            verIndex: y,
            geodata: json
          });

          if(responseGeojsons.length == totalCallNum) resolve(responseGeojsons);
        })
        .catch(function(err) {
          console.log('error!')
          console.log(err)
        });
      }
    }
  })

    // for(i = 0; i< tilesToFetch.length; i++) {
    //   for(j = 0; j< tilesToFetch[i].length; j++) {
    //     var baseurl = "http://vector.mapzen.com/osm/all/16/"+tilesToFetch[i][j].lon + "/" + tilesToFetch[i][j].lat + ".json?api_key="+key;
    //     fetch(baseurl)
    //     .then(function(res) {
    //       return res.json();
    //     })
    //     .then(function(json) {

    //       responseGeojsons.push({
    //         horIndex: 0,
    //         verIndex: 0,
    //         geodata: json
    //       });

    //       if(responseGeojsons.length == totalCallNum) resolve(responseGeojsons);
    //     })
    //     .catch(function(err) {
    //       console.log('error!')
    //       console.log(err)
    //     });
    //   }
    // }


  allGeojsonPromise
  .then(
    function(geojsons) {
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
                width: tileWidth * tilesToFetch.length,
                height: tileWidth* tilesToFetch[0].length
              })


        var previewProjection = d3.geo.mercator()
                        .center([centerLatLon.lon, centerLatLon.lat])
                        //this are carved based on zoom 16, fit into 100px * 100px rect
                        .scale(600000* 100/57 * Math.pow(2,(centerLatLon.zoom-16)))
                        .precision(.0)
                        . translate([0, 0])




        var i,j;


        for(i = 0; i< geojsons.length; i++) {
          data = geojsons[i];

          var defs = svg.append('defs')
                    .append('clipPath')
                    .attr('id','tile-boundary-hor-'+data.horIndex+'-ver-'+data.verIndex)
                    .append('rect')
                    .attr('x',data.verIndex*tileWidth)
                    .attr('y',data.horIndex*tileWidth)
                    .attr('width',tileWidth)
                    .attr('height',tileWidth)

          var g = svg.append('g')
                  .attr('clip-path','url(#tile-boundary-hor-'+data.horIndex+'-ver-'+data.verIndex+')');
          for(var obj in data.geodata) {
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
        }

        //write out the children of the container div
        fs.writeFileSync(outputLocation, window.d3.select('.container').html()) //using sync to keep the code simple
        return svg;
      }
    })
  })
  .then(function(svg) {
    res.send(svg + ' ' + requestLon + ' ' + requestLat  );
  })
  .catch(
    function(err) {
      console.log(err)
      res.send('error: ' + err);
  });




  // responseGeojsons.push(fetchTheTile(baseurl));
  // console.log(responseGeojsons)
  // fetch(baseurl)
  //   .then(function(res) {
  //     return res.json();
  //   })
  //   .then(function(json) {
  //     responseGeojsons.push(json)
  //   })
  //   .catch(function(err) {
  //     console.log('error!')
  //     console.log(err)
  //   });


  // var request = new XMLHttpRequest();
  // request.open('GET', baseurl, true);

  // request.onload = function() {

  //   if (request.status >= 200 && request.status < 400) {
  //     data = JSON.parse(request.response);
  //     responseGeojsons.push(data);
  //     conosle.log('success');
  //   } else {
  //     console.log('arg you fail! so much!')
  //   }
  // }




    //d3 needs query selector from dom
    jsdom.env({

      html:'',
      features:{ QuerySelector:true }, //you need query selector for D3 to work
      done:function(errors, window) {

        // var request = new XMLHttpRequest();
        // request.open('GET', baseurl, true);

        // request.onload = function() {

        //   if (request.status >= 200 && request.status < 400) {
          // request went through, success!


            //data = JSON.parse(request.response);


            /****************************************************
            window.d3 = d3.select(window.document); //get d3 into the domz

            svg = window.d3.select('body')
              .append('div').attr('class','container') //make a container div to ease the saving process
              .append('svg')
              .attr({
                xmlns: 'http://www.w3.org/2000/svg',
                width: tileWidth,
                height: tileWidth
                })
            // offer clipping path for each tile, without this, there is overwrapping part.
            //this should be optional

            var defs = svg.append('defs');

            defs.append('clipPath')
              .attr('id','tile-boundary')
              .append('rect')
              .attr('x',0)
              .attr('y',0)
              .attr('width',tileWidth)
              .attr('height',tileWidth)

            var g = svg.append('g');
            g.attr('clip-path','url(#tile-boundary)');

            for(var obj in data) {
              var j;
              for(j = 0; j< data[obj].features.length; j++) {
                var geoFeature = data[obj].features[j];
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

          //write out the children of the container div
          fs.writeFileSync(outputLocation, window.d3.select('.container').html()) //using sync to keep the code simple

          *****************************************************/
        //   res.send( svg + ' '+ requestLon + ' ' + requestLat  );
        //   res.end();
        // } else {
        //   // We reached our target server, but it returned an error
        //   console.log("well, your request didn't go through");
        // }
      //request onload over
      //}

    // request.onerror = function() {
    //   // There was a connection error of some sort
    // };
    // request.send();

    //done function
    }
  //jsdom parameter over
  });

});


function fetchTheTile() {

}

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