// initialize map

var map = L.map('map').setView([40.7142700, -74.0059700], 14);

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);


var areaSelect = L.areaSelect({width:200, height:250});
areaSelect.on("change", function() {
    var bounds = this.getBounds();

    $("#startLat").val(bounds.getNorthEast().lat)
    $("#startLon").val(bounds.getNorthEast().lng)
    $("#endLat").val(bounds.getSouthWest().lat)
    $("#endLon").val(bounds.getSouthWest().lng)

    //$("#startLat").val(bounds.getSouthWest().lat + ", " + bounds.getSouthWest().lng);
    //$("#result .ne").val(bounds.getNorthEast().lat + ", " + bounds.getNorthEast().lng);
});
areaSelect.addTo(map);

$("#remove").click(function() {
    areaSelect.remove();
});
