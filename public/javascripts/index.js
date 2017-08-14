// initialize map

L.Mapzen.apiKey = 'search-waNZobx';
var map = L.Mapzen.map('map',{
  worldcopyjump: true,
  scrollZoom: false,
  minZoom: 2})
.setView([40.7142700, -74.0059700], 14);


L.Mapzen.hash({
  map: map
})

L.Mapzen.geocoder().addTo(map);

var areaSelect = L.areaSelect({width:200, height:250});

areaSelect.on("change", function() {
  var bounds = this.getBounds();

  $("#startLat").val(bounds.getNorthEast().lat.toFixed(4));
  $("#startLon").val(bounds.getNorthEast().lng.toFixed(4));
  $("#endLat").val(bounds.getSouthWest().lat.toFixed(4));
  $("#endLon").val(bounds.getSouthWest().lng.toFixed(4));
});

areaSelect.addTo(map);