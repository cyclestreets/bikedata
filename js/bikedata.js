// Bike data application code
bikedata = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _settings = {};
	var _map = null;
	
	// Icons
	var _icons = {
		'slight': 'images/icons/icon_collision_slight.svg',
		'serious': 'images/icons/icon_collision_serious.svg',
		'fatal': 'images/icons/icon_collision_fatal.svg',
	};
	
	
	return {
		
	// Public functions
		
		// Main function
		initialise: function (config)
		{
			// Obtain the configuration and allocate as settings
			_settings = config;
			
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
			L.tileLayer(_settings.tileUrl, {
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
		formInteraction: function ()
		{
			// Re-fetch data when form is changed
			$('form :input').change(function() {
				bikedata.getData ();
			});
		},
		

		// Function to manipulate the map based on form interactions
		getData: function ()
		{
			// Start API data parameters
			var apiData = {};
			
			// Get the bbox
			apiData.bbox = _map.getBounds().toBBoxString();
			
			// Add the key
			apiData.key = _settings.apiKey;
			
			// Fetch data
			$.ajax({
				url: config.apiBaseUrl + '/v2/collisions.locations',
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
		
		
		// Function to construct the popup content
		popupHtml: function (feature)
		{
			// Construct the HTML
			var html = '<table>';
			for (var key in feature.properties) {
				if (feature.properties[key] === null) {
					feature.properties[key] = '[null]';
				}
				var value = feature.properties[key].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
				html += '<tr><td>' + key + ':</td><td><strong>' + value + '</strong></td></tr>';
			}
			html += '</table>';
			
			// Return the content
			return html;
		},
		
		
		// Function to show the data
		showCurrentData: function (data)
		{
			// Define the data layer
			var dataLayer = L.geoJson(data, {
				
				// Set icon type
				pointToLayer: function (feature, latlng) {
					var icon = L.marker (latlng, {
						// Icon properties as per: http://leafletjs.com/reference.html#icon
						icon: L.icon({
							iconUrl: _icons[feature.properties.severity],
							iconSize: [38, 95],
						})
					});
					return icon;
				},
				
				// Set popup
				onEachFeature: function (feature, layer) {
					var popupContent = bikedata.popupHtml (feature);
					layer.bindPopup(popupContent);
				}
			});
			
			// Add to the map
			dataLayer.addTo(_map);
		}
	}
} (jQuery));
