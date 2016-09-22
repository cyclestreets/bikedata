
// create a map in the "map" div, set the view to a given place and zoom
var map = L.map('map').setView([51.505, -0.09], 13);

// add an OpenStreetMap tile layer
var tileUrl = 'http://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png';
L.tileLayer(tileUrl, {
	attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// add a marker in the given location, attach some popup content to it and open the popup
L.marker([51.5, -0.09]).addTo(map)
    .bindPopup('A pretty CSS3 popup. <br> Easily customizable.')
    .openPopup();


// add a marker in the given location, attach some popup content to it and open the popup
L.marker([51.52, -0.092]).addTo(map)
    .bindPopup('A pretty CSS3 popup. <br> Easily customizable.')
    .openPopup();

// add a marker in the given location, attach some popup content to it and open the popup
L.marker([51.51, -0.125]).addTo(map)
    .bindPopup('A pretty CSS3 popup. <br> Easily customizable.')
    .openPopup();

