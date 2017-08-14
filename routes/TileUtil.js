import {lat2tile, lon2tile, tile2Lon, tile2Lat} from './MapSpells';
import DataLayer from './DataLayer';

var getTileSpec = function (_lat1, _lat2, _lon1, _lon2, _zoom) {
  var _startTile = {};
  var _endTile = {};

  var _startCoords = {};
  var _endCoords = {};

  var lat1 = lat2tile(parseFloat(_lat1), _zoom);
  var lat2 = lat2tile(parseFloat(_lat2), _zoom);

  var lon1 = lon2tile(parseFloat(_lon1), _zoom);
  var lon2 = lon2tile(parseFloat(_lon2), _zoom);

  if(lat1 > lat2) {
    _startTile.lat = lat2;
    _endTile.lat = lat1;
  } else {
    _startTile.lat = lat1;
    _endTile.lat = lat2;
  }

  if(lon1 > lon2) {
    _startTile.lon = lon2;
    _endTile.lon = lon1;
  } else {
    _startTile.lon = lon1;
    _endTile.lon = lon2;
  }

  _startCoords.lat = tile2Lat(_startTile.lat, _zoom);
  _startCoords.lon = tile2Lon(_startTile.lon, _zoom);

  _endCoords.lat = tile2Lat(_endTile.lat, _zoom);
  _endCoords.lon = tile2Lat(_endTile.lon, _zoom);

  return {
    startCoords: _startCoords,
    endCoords: _endCoords,
    startTile: _startTile,
    endTile: _endTile,
    zoom: _zoom
  }
}


var getTileNumberToFetch = function (startTile, endTile) {
  const tilesToFetch = [];
  for(let j = startTile.lat; j <= endTile.lat; j++) {
    const coords = [];
    for(let i = startTile.lon; i <= endTile.lon; i++) {
      coords.push({
        lat: j,
        lon: i
      });
    }
    tilesToFetch.push(coords);
  }
  return tilesToFetch;
}

var setupJson = function (dKinds) {
  var formattedJson = {};
  var dataKind = dKinds.join(',');

  for (var i = 0; i < dKinds.length; i++) {
    // this is sublayer for each data layer
    if (DataLayer[dKinds[i]]) formattedJson[dKinds[i]] = DataLayer[dKinds[i]];
    else formattedJson[dKinds[i]]  = DataLayer['etc'];
  }
  return formattedJson;
}


var getURL = function (x, y, zoom, key) {
  var xc = (x < 0)? 0: x;
  var yc = (y < 0)? 0: y;
  return "https://tile.mapzen.com/mapzen/vector/v1/all/"+zoom+"/"+x+ "/" +y + ".json?api_key="+key;
}

module.exports = { getTileSpec, getTileNumberToFetch, setupJson, getURL };