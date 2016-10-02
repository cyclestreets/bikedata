// Bike data application code
bikedata = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _settings = {};
	var _map = null;
	var _currentDataLayer = {};
	var _parameters = {};
	
	// Layer definitions
	var _layers = {
		
		'collisions': {
			'apiCall': '/v2/collisions.locations',
			'parameterNamespace': 'field:',		// See: https://www.cyclestreets.net/api/v2/collisions.locations/
			'iconField': 'severity',
			'icons': {
				'slight':  'images/icons/icon_collision_slight.svg',
				'serious': 'images/icons/icon_collision_serious.svg',
				'fatal':   'images/icons/icon_collision_fatal.svg',
			}
		},
		
		'photomap': {
			'apiCall': '/v2/photomap.locations',
			'apiFixedParameters': {
				'fields': 'id,caption,hasPhoto,thumbnailUrl,username,licenseName,iconUrl',
				'limit': 150,
				'thumbnailsize': 200,
				'suppressplaceholders': '1',
			},
			'iconField': 'iconUrl'
			// icons specified in the field value
		}
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
			
			// Load the tabs and determine the enabled layers
			var enabledLayers = bikedata.loadTabs ();
			
			// Load the data, and add map interactions and form interactions
			for (var index in enabledLayers) {
				bikedata.enableLayer (enabledLayers[index]);
			};
			
			// Toggle map sections on/off when checkboxes changed
			$('nav #selector input').change (function() {
				var layerId = this.id.replace('show_', '')
				if (this.checked) {
					bikedata.enableLayer (layerId);
				} else {
					bikedata.removeLayer (layerId);
				}
			});
			
		},
		
		
		// Function to load the tabs
		loadTabs: function ()
		{
			// Enable tabbing of main menu
			$('nav').tabs();
			
			// Toggle checked sections as selected
			$('nav #selector input').change (function() {
				$(this).parent('li').toggleClass('selected', this.checked);
			});
			
			// Allow double-clicking of each menu item (surrounding each checkbox) as implicit selection of its checkbox
			$('nav #selector li a').dblclick(function() {
				$(this).parent().find('input').click();
			});
			
			// Create a list of the enabled layers
			var enabledLayers = [];
			$('nav #selector input:checked').map (function () {
				enabledLayers.push (this.id.replace('show_', ''));
			});
			
			// Return the enabled layers list
			return enabledLayers;
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
			
			// Add geocoder control
			bikedata.geocoder ();
			
			// Add drawing support
			bikedata.drawing ('#geometry', true, '');
			
			// Add hash support
			// #!# Note that this causes a map move, causing a second data request
			new L.Hash (_map);
		},
		
		
		// Wrapper function to add a geocoder control
		geocoder: function ()
		{
			// Attach the autocomplete library behaviour to the location control
			autocomplete.addTo ("input[name='location']", {
				sourceUrl: _settings.apiBaseUrl + '/v2/geocoder' + '?key=' + _settings.apiKey + '&bounded=1&bbox=' + _settings.autocompleteBbox,
				select: function (event, ui) {
					var result = ui.item;
					var geojsonItemLayer = L.geoJson(result.feature);
					_map.fitBounds(geojsonItemLayer.getBounds ());
					event.preventDefault();
				}
			});
		},
		
		
		// Function to enable a data layer
		enableLayer: function (layerId)
		{
			// Get the form parameters on load
			_parameters[layerId] = bikedata.parseFormValues (layerId);
			
			// Fetch the data
			bikedata.getData (layerId, _parameters[layerId]);
			
			// Register to refresh data on map move
			_map.on ('moveend', function (e) {
				bikedata.getData (layerId, _parameters[layerId]);
			});
			
			// Reload the data, using a rescan of the form parameters when any change is made
			$('form #sections :input').change (function() {
				_parameters[layerId] = bikedata.parseFormValues (layerId);
				bikedata.getData (layerId, _parameters[layerId]);
			});
		},
		
		
		// Function to parse the form values, returning the minimal required set of key/value pairs
		parseFormValues: function (layerId)
		{
			// Start a list of parameters that have a value
			var parameters = {};
			
			// Define the delimiter used for combining groups
			var delimiter = ',';	// Should match the delimiter defined by the API
			
			// Loop through list of inputs (e.g. checkboxes, select, etc.) for the selected layer
			$('form#data #' + layerId + ' :input').each(function() {
				
				// Determine the input type
				var tagName = this.tagName.toLowerCase();	// Examples: 'input', 'select'
				var type = $(this).prop('type');			// Examples: 'text', 'checkbox', 'select-one'
				
				// Obtain the element name
				var name = $(this).attr('name');
				
				// For checkboxes, degroup them by creating/adding a value that is checked, split by the delimiter
				if (tagName == 'input' && type == 'checkbox') {
					if (this.checked) {
						name = name.replace(/\[\]$/g, ''); // Get name of this checkbox, stripping any trailing grouping indicator '[]' (e.g. values for 'foo[]' are registered to 'foo')
						var value = $(this).val();
						if (parameters[name]) {
							parameters[name] += delimiter + value; // Add value
						} else {
							parameters[name] = value; // Set value
						}
					}
					return;	// Continue to next input
				}
				
				// For all other input types, if there is a value, register it
				var value = $(this).val();
				if (value.length > 0) {
					parameters[name] = value;	// Set value
					return;	// Continue to next input
				}
			});
			
			// If the layer requires that query fields are prefixed with a namespace, prefix each fieldname
			if (_layers[layerId]['parameterNamespace']) {
				var parametersNamespaced = {};
				$.each(parameters, function (field, value) {
					var field = _layers[layerId]['parameterNamespace'] + field;
					parametersNamespaced[field] = value;
				});
				parameters = parametersNamespaced;
			}
			
			// Return the parameters
			return parameters;
		},
		
		
		// Function to manipulate the map based on form interactions
		getData: function (layerId, parameters)
		{
			// Start API data parameters
			var apiData = {};
			
			// Add the key
			apiData.key = _settings.apiKey;
			
			// Add fixed parameters if present
			if (_layers[layerId]['apiFixedParameters']) {
				$.each(_layers[layerId]['apiFixedParameters'], function (field, value) {
					apiData[field] = value;
				});
			}
			
			// Get the bbox, and reduce the co-ordinate accuracy to avoid over-long URLs
			apiData.bbox = _map.getBounds().toBBoxString();
			apiData.bbox = bikedata.reduceBboxAccuracy (apiData.bbox);
			
			// Add in the parameters from the form
			$.each(parameters, function (field, value) {
				apiData[field] = value;
			});
			
			// Fetch data
			$.ajax({
				url: _settings.apiBaseUrl + _layers[layerId]['apiCall'],
				dataType: 'json',
				crossDomain: true,	// Needed for IE<=9; see: http://stackoverflow.com/a/12644252/180733
				data: apiData,
				error: function (jqXHR, error, exception) {
					var data = $.parseJSON(jqXHR.responseText);
					alert('Error: ' + data.error);
				},
				success: function (data, textStatus, jqXHR) {
					
					// Show API-level error if one occured
					// #!# This is done here because the API still returns Status code 200
					if (data.error) {
						alert('Error from ' + layerId + ' layer: ' + data.error);
						return {};
					}
					
					// Otherwise return the data
					return bikedata.showCurrentData(layerId, data);
				}
			});
		},
		
		
		// Function to reduce co-ordinate accuracy of a bbox string
		reduceBboxAccuracy: function (bbox)
		{
			// Split by comma
			var coordinates = bbox.split(',');
			
			// Reduce accuracy of each coordinate
			coordinates = bikedata.reduceCoordinateAccuracy (coordinates);
			
			// Recombine
			bbox = coordinates.join(',');
			
			// Return the string
			return bbox;
		},
		
		
		// Function to reduce co-ordinate accuracy to avoid pointlessly long URLs
		reduceCoordinateAccuracy: function (coordinates)
		{
			// Set 0.1m accuracy; see: https://en.wikipedia.org/wiki/Decimal_degrees
			var accuracy = 6;
			
			// Reduce each value
			for (var i=0; i < coordinates.length; i++) {
				coordinates[i] = parseFloat(coordinates[i]).toFixed(accuracy);
			}
			
			// Return the modified set
			return coordinates;
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
				var value = feature.properties[key];
				if (typeof value == 'string') {
					value = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
				}
				html += '<tr><td>' + key + ':</td><td><strong>' + value + '</strong></td></tr>';
			}
			html += '</table>';
			
			// Return the content
			return html;
		},
		
		
		// Function to show the data for a layer
		showCurrentData: function (layerId, data)
		{
			// If this layer already exists, remove it so that it can be redrawn
			bikedata.removeLayer (layerId);
			
			// Determine the field in the feature.properties data that specifies the icon to use
			var field = _layers[layerId]['iconField'];
			
			// Define the data layer
			_currentDataLayer[layerId] = L.geoJson(data, {
				
				// Set icon type
				pointToLayer: function (feature, latlng) {
					
					// Determine whether to use local icons, or an icon field in the data
					if (_layers[layerId]['icons']) {
						var iconUrl = _layers[layerId]['icons'][feature.properties[field]];
					} else {
						var iconUrl = feature.properties[field];
					}
					
					var icon = L.marker (latlng, {
						// Icon properties as per: http://leafletjs.com/reference.html#icon
						icon: L.icon({
							iconUrl: iconUrl,
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
			_currentDataLayer[layerId].addTo(_map);
		},
		
		
		// Function to remove a layer
		removeLayer: function (layerId)
		{
			// Remove the layer, checking first to ensure it exists
			if (_currentDataLayer[layerId]) {
				_map.removeLayer (_currentDataLayer[layerId]);
			}
		},
		
		
		// Drawing functionality, wrapping Leaflet.draw
		drawing: function (targetField, fragmentOnly, defaultValueString)
		{
			// Options for polygon drawing
			var polygon_options = {
				showArea: false,
				shapeOptions: {
					stroke: true,
					color: 'blue',
					weight: 4,
					opacity: 0.5,
					fill: true,
					fillColor: null, //same as color by default
					fillOpacity: 0.2,
					clickable: true
				}
			}
			
			// Create a map drawing layer
			var drawnItems = new L.FeatureGroup();
			
			// Add default value if supplied; currently only polygon type supplied
			if (defaultValueString) {
				
				// Convert the string to an array of L.latLng(lat,lon) values
				var polygonPoints = JSON.parse(defaultValueString);
				if (polygonPoints) {
					defaultPolygon = new Array();
					for (var i = 0; i < polygonPoints.length; i++) {
						point = polygonPoints[i];
						defaultPolygon.push (L.latLng(point[1], point[0]));
					}
				}
				
				// Create the polygon and style it
				var defaultPolygonFeature = L.polygon(defaultPolygon, polygon_options.shapeOptions);
				
				// Create the layer and add the polygon to the layer
				var defaultLayer = new L.layerGroup();
				defaultLayer.addLayer(defaultPolygonFeature);
				
				// Add the layer to the drawing canvas
				drawnItems.addLayer(defaultLayer);
			}
			
			// Add the drawing layer to the map
			_map.addLayer(drawnItems);
			
			// Enable the polygon drawing when the button is clicked
			var drawControl = new L.Draw.Polygon(_map, polygon_options);
			$('.draw.area').click(function() {
				drawControl.enable();
				
				// Allow only a single polygon at present
				// #!# Remove this when the server-side allows multiple polygons
				drawnItems.clearLayers();
			});
			
			// Handle created polygons
			_map.on('draw:created', function (e) {
				var type = e.layerType,
				layer = e.layer;
				drawnItems.addLayer(layer);
				
				// Convert to GeoJSON value
				var geojsonValue = drawnItems.toGeoJSON();
				
				// Reduce coordinate accuracy to 6dp (c. 1m) to avoid over-long URLs
				// #!# Ideally this would be native within Leaflet.draw: https://github.com/Leaflet/Leaflet.draw/issues/581
				var coordinates = geojsonValue.features[0].geometry.coordinates[0];
				var accuracy = 6;	// Decimal points; gives 0.1m accuracy; see: https://en.wikipedia.org/wiki/Decimal_degrees
				for (var i=0; i < coordinates.length; i++) {
					for (var j=0; j < coordinates[i].length; j++) {
						coordinates[i][j] = +coordinates[i][j].toFixed(accuracy);
					}
				}
				geojsonValue.features[0].geometry.coordinates[0] = coordinates;
				
				// If required, send only the coordinates fragment
				if (fragmentOnly) {
					geojsonValue = coordinates;
				}
				
				// Send to receiving input form
				$(targetField).val(JSON.stringify(geojsonValue));
			});
			
			// Cancel button clears drawn polygon and clears the form value
			$('.edit-clear').click(function() {
				drawnItems.clearLayers();
				$(targetField).val('');
			});
			
			// Undo button
			$('.edit-undo').click(function() {
				drawnItems.revertLayers();
			});
		}
	}
	
} (jQuery));
