// Bike data application code
bikedata = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _settings = {};
	
	
	return {
		
	// Public functions
		
		// Main function
		initialise: function (settings)
		{
			// Obtain the settings
			_settings = settings;
			
			// Create the map
			bikedata.createMap ();
			
			// Load the tabs
			bikedata.loadTabs ();
			
			// Add map interactions from the form
			bikedata.formInteraction ();
		},
		
		
		// Create the map
		createMap: function ()
		{
			// create a map in the "map" div, set the view to a given place and zoom
			var map = L.map('map').setView([51.505, -0.09], 13);
			
			// add an OpenStreetMap tile layer
			var tileUrl = 'https://tile.cyclestreets.net/opencyclemap/{z}/{x}/{y}.png';
			L.tileLayer(tileUrl, {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; <a href="https://www.thunderforest.com/">Thunderforest</a>'
			}).addTo(map);
			
			// add a marker in the given location, attach some popup content to it and open the popup
			L.marker([51.5, -0.09]).addTo(map)
			    .bindPopup('A pretty CSS3 popup.<br />Easily customizable.')
			    .openPopup();
			
		},
		
		
		// Function to load the tabs
		loadTabs: function ()
		{
			$('nav').tabs();
		},
		
		
		// Function to manipulate the map based on form interactions
		formInteraction: function ()
		{
			$('form :input').change(function() {
				alert('Form changed!');
			});
		}
	}
} (jQuery));
