// initialize map

var map = L.map('map',{minZoom: 2}).setView([40.7142700, -74.0059700], 14);

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);


var hash = new L.Hash(map);
var areaSelect = L.areaSelect({width:200, height:250});
areaSelect.on("change", function() {
var bounds = this.getBounds();

$("#startLat").val(bounds.getNorthEast().lat.toFixed(4))
$("#startLon").val(bounds.getNorthEast().lng.toFixed(4))
$("#endLat").val(bounds.getSouthWest().lat.toFixed(4))
$("#endLon").val(bounds.getSouthWest().lng.toFixed(4))

    //$("#startLat").val(bounds.getSouthWest().lat + ", " + bounds.getSouthWest().lng);
    //$("#result .ne").val(bounds.getNorthEast().lat + ", " + bounds.getNorthEast().lng);
});
areaSelect.addTo(map);

$("#remove").click(function() {
    areaSelect.remove();
});
