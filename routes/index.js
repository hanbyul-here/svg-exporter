'use strict';

import { Router } from 'express';

import fs from 'fs';
import jsdom from 'jsdom';

import d3 from 'd3';
import XMLHttpRequest from 'xhr2';

import { getTileSpec, getTileNumberToFetch, setupJson, getURL } from './TileUtil';

const router = Router();

// use key saved in config file if there is a config file in same directory
if (fs.existsSync( __dirname + '/config.js')) {
  var config = require('./config.js');
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: "Let's make map" });
});


router.get('/request-map', function(req, res, next) {
  res.redirect('/', { title: "Let's make map" });
});

router.post('/request-map', function(req, res, next) {

  var requestedTileSpec = getTileSpec(req.body.startLat, req.body.endLat, req.body.startLon, req.body.endLon, req.body.zoomLevel);

  const conf = {
    key: req.body.apikey || config.key,
    inkscape: req.body.inkscape || false,
    delayTime: config.delay || 200,
    tileWidth: config.tileWidth || 100,
    outputLocation: 'svgmap'
  }

  res.send(requestedTileSpec.startTile.lat + ' ' + requestedTileSpec.startTile.lon + 'request submitted, waiting for a file to be written')

  const layers = ['boundaries','earth', 'landuse', 'places', 'roads', 'water'];
  let dKinds = [];
  for (let item of layers) {
    if (req.body[item]) dKinds.push(item);
  }

  const tilesToFetch = getTileNumberToFetch(requestedTileSpec.startTile, requestedTileSpec.endTile);
  console.log('Number of tiles to fetch : ' + tilesToFetch[0].length * tilesToFetch.length);

  const getTiles = function () {
    console.log('1.Started Fetching Tiles');
    var jsonArray = [];

    let tileUrlsToFetch = [];
    for (let i = tilesToFetch.length-1; i >= 0; i--) {
      for (let j = tilesToFetch[0].length-1; j >= 0; j--) {
        tileUrlsToFetch.push(getURL(tilesToFetch[i][j].lon, tilesToFetch[i][j].lat, requestedTileSpec.zoom, conf.key));
      }
    }

    const getEachTile = (url) =>
      new Promise((resolve, reject) => {
        console.log(url);
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.onload = () => resolve(JSON.parse(xhr.responseText));
        xhr.onerror = () => reject(xhr.statusText);
        xhr.send();
      });

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms, 'dumb'));


  return tileUrlsToFetch.reduce(function(promise, item, index, array) {
      return promise.then(values => {
        // Second promise was just to delay
        return Promise.all([getEachTile(item), delay(conf.delayTime)]).then((values)=> {
          jsonArray.push(values[0]);
          return jsonArray;
        });
      })
    }, Promise.resolve())
  }


function bakeJson(resultArray) {
  console.log('2. Resorting json');
  return new Promise( function(resolve, reject,) {
    var geojsonToReform = setupJson(dKinds);
    // response geojson array
    for (let result of resultArray) {
      // inside of one object
      for (let response in result) {
        // if the property is one of dataKinds that user selected
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
      resolve(geojsonToReform);
    })
  }





  function writeSVGFile(reformedJson) {
    console.log('3. Baking json to svg');
    return new Promise( function(resolve, reject,) {
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
                  width: conf.tileWidth * tilesToFetch[0].length,
                  height: conf.tileWidth* tilesToFetch.length
                })

          var previewProjection = d3.geo.mercator()
                          .center([requestedTileSpec.startCoords.lon, requestedTileSpec.startCoords.lat])
                          //this are carved based on zoom 16, fit into 100px * 100px rect
                          .scale(600000* conf.tileWidth/57.5 * Math.pow(2,(requestedTileSpec.zoom-16)))
                          .precision(.0)
                          . translate([0, 0])

          var previewPath = d3.geo.path().projection(previewProjection);

          for (let dataK in reformedJson) {
            let oneDataKind = reformedJson[dataK];
            let g = svg.append('g')
            g.attr('id',dataK)

            for(let subKinds in oneDataKind) {
              let tempSubK = oneDataKind[subKinds]
              let subG = g.append('g');
              if (conf.inkscape) {
                subG.attr('id',subKinds)
                    .attr(":inkscape:groupmode","layer")
                    .attr(':inkscape:label', dataK+subKinds+'layer');
              }

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
          var outputLocation = 'svgmap'+ requestedTileSpec.startTile.lat +'-'+requestedTileSpec.startTile.lon +'-'+requestedTileSpec.zoom +'.svg';
          fs.writeFile(outputLocation, window.d3.select('.container').html(),(err)=> {
            if(err) throw err;
            console.log('yess svg is there')
            resolve();
          })

        //jsdom done function done
        }
      })
    });
  }


  getTiles()
  .then((result) => bakeJson(result))
  .then((result) => writeSVGFile(result))
  .then(() => res.write(requestedTileSpec.startTile.lat + ' ' + requestedTileSpec.startTile.lon + 'SVG is there'))

});

module.exports = router;