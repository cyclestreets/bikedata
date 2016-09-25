// Bike data application code
bikedata = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _settings = {};
	var _map = null;
	
	
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
			_map = L.map('map').setView([51.505, -0.09], 13);
			
			// Add the tile layer
			var tileUrl = 'https://tile.cyclestreets.net/opencyclemap/{z}/{x}/{y}.png';
			L.tileLayer(tileUrl, {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; <a href="https://www.thunderforest.com/">Thunderforest</a>'
			}).addTo(_map);
			
			// Get the data on initial load
			bikedata.getData ();
			
			// Register to refresh data on map move
			_map.on ('moveend', function (e) {
				bikedata.getData ();
			});
		},
		
		
		// Function to load the tabs
		loadTabs: function ()
		{
			$('nav').tabs();
		},
		
		
		// Function to manipulate the map based on form interactions
		getData: function ()
		{
			// Start API data parameters
			var apiData = {};
			
			// Get the bbox
			apiData.bbox = _map.getBounds().toBBoxString();
			
			// Add the key
			apiData.key = 'c047ed46f7b50b18';
			
			// Fetch data
			$.ajax({
				url: 'https://api.cyclestreets.net/v2/collisions.locations',
				dataType: 'json',
				crossDomain: true,	// Needed for IE<=9; see: http://stackoverflow.com/a/12644252/180733
				data: apiData,
				error: function (jqXHR, error, exception) {
					// #!# Need proper handling
					alert('Could not get data');
					console.log(error);
				},
				success: function (data, textStatus, jqXHR) {
					return bikedata.showCurrentData(data);
				}
			});
		},
		
		
		// Function to manipulate the map based on form interactions
		formInteraction: function ()
		{
			// Re-fetch data when form is changed
			$('form :input').change(function() {
				bikedata.getData ();
			});
		},
		

		// Function to show the data
		showCurrentData: function (data)
		{
			L.geoJson(data).addTo(_map);
		}
	}
} (jQuery));
