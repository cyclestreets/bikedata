// Bike data application code

/*jslint browser: true, white: true, single: true, for: true */
/*global $, jQuery, L, autocomplete, Cookies, vex, GeoJSON, alert, console, window */

var bikedata = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _settings = {};
	var _map = null;
	var _layers = {};	// Layer status registry
	var _currentDataLayer = {};
	var _parameters = {};
	var _xhrRequests = {};
	var _requestCache = {};
	
	// Default layers enabled
	var _defaultLayers = ['collisions', 'photomap'];
	
	// Layer definitions
	var _layerConfig = {
		
		'collisions': {
			'apiCall': '/v2/collisions.locations',
			'apiFixedParameters': {
				'jitter': '1',
				'datetime': 'friendly'
			},
			'parameterNamespace': 'field:',		// See: https://www.cyclestreets.net/api/v2/collisions.locations/
			'sendZoom': true,	// Needed for jitter support
			'iconField': 'severity',
			'icons': {
				'slight':  '/images/icons/icon_collision_slight.svg',
				'serious': '/images/icons/icon_collision_serious.svg',
				'fatal':   '/images/icons/icon_collision_fatal.svg'
			},
			'popupHtml':
				  '<p><a href="{properties.url}"><img src="images/icons/bullet_go.png" /> <strong>View full, detailed report</a></strong></p>'
				+ '<p>Reference: <strong>{properties.id}</strong></p>'
				+ '<p>'
				+ 'Date and time: <strong>{properties.datetime}</strong><br />'
				+ 'Severity: <strong>{properties.severity}</strong><br />'
				+ 'Casualties: <strong>{properties.casualties}</strong><br />'
				+ 'No. of Casualties: <strong>{properties.Number_of_Casualties}</strong><br />'
				+ 'No. of Vehicles: <strong>{properties.Number_of_Vehicles}</strong>'
				+ '</p>'
		},
		
		'planningapplications': {
			'apiCall': 'http://www.planit.org.uk/api/applics/geojson',
			'apiFixedParameters': {
				'pg_sz': 100,
				'limit': 100
			},
			'apiKey': false,
			'iconUrl': '/images/icons/signs_neutral.svg',
			'popupHtml':
				  '<p><strong>{properties.description}</strong></p>'
				+ '<p>{properties.address}</p>'
				+ '<p>Reference: <a href="{properties.url}">{properties.uid}</a><br />'
				+ 'Local Authority: {properties.authority_name}<br />'
				+ 'Date: {properties.start_date}</p>'
				+ '<p><a href="{properties.url}"><img src="images/icons/bullet_go.png" /> <strong>View full details</a></strong></p>'
		},
		
		'triplengths': {
			'apiCall': '/v2/usage.journeylengths',
			'polygonStyle' : 'grid',
			'popupHtml':
				  '<p>Average distance: <strong>{properties.distance}km</strong>'
		},
		
		// https://data.police.uk/docs/method/crime-street/
		// https://data.police.uk/api/crimes-street/bicycle-theft?poly=52.199295,0.124497:52.214312,0.124497:52.214312,0.1503753:52.1992,0.15037:52.19929,0.1244&date=2016-07
		'cycletheft': {
			'apiCall': 'https://data.police.uk/api/crimes-street/bicycle-theft',
			'retrievalStrategy': 'polygon',
			'flatJson': ['location.latitude', 'location.longitude'],
			'apiKey': false,
			'apiBoundaryField': 'poly',
			'apiBoundaryFormat': 'latlon-comma-colons',
			'iconUrl': '/images/icons/icon_enforcement_bad.svg',
			'popupHtml':
				  '<p>Crime no.: <strong>{properties.persistent_id}</strong></p>'
				+ '<p>'
				+ 'Date: <strong>{properties.month}</strong><br />'
				+ 'Location: <strong>{properties.location.street.name}</strong><br />'
				+ 'Outcome: <strong>{properties.outcome_status.category}</strong><br />'
				+ '</p>'
				+ '<p>Note: The location given in the police data is <a href="https://data.police.uk/about/#location-anonymisation" target="_blank" title="See more details [link opens in a new window]">approximate</a>, for anonymity reasons.</p>'
		},
		
		// https://www.cyclescape.org/api
		'issues': {
			'apiCall': 'https://www.cyclescape.org/api/issues',
			'apiKey': false,
			'apiFixedParameters': {
				'page': 1,
				'per_page': 100
			},
			'iconUrl': '/images/icons/icon_other_neutral.svg',
			'popupHtml':
				  '<p><strong>{properties.title}</strong></p>'
				+ '<p>{properties.description}</p>'
				+ '<p><a href="{properties.cyclescape_url}">Full details</a></p>'
		},
		
		'photomap': {
			'apiCall': '/v2/photomap.locations',
			'apiFixedParameters': {
				'fields': 'id,caption,hasPhoto,thumbnailUrl,username,licenseName,iconUrl',
				'limit': 150,
				'thumbnailsize': 300,
				'datetime': 'friendly'
			},
			'iconField': 'iconUrl'
			// icons specified in the field value
		},
		
		// https://www.cyclescape.org/api
		'groups': {
			'apiCall': 'https://www.cyclescape.org/api/groups.json',
			'apiKey': false,
			'polygonStyle' : 'green',
			'popupHtml':
				  '<p><strong>{properties.title}</strong></p>'
				+ '<p>{properties.description}</p>'
				+ '<p><a href="{properties.url}">Cyclescape group</a></p>'
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
			
			// Get the query string parameters
			var urlParameters = bikedata.getUrlParameters ();
			
			// Determine layers to use
			var initialLayers = urlParameters.sections || _defaultLayers;
			
			// If cookie state is provided, use that to select the sections
			var state = Cookies.getJSON('state');
			if (state) {
				initialLayers = [];
				$.each (state, function (layerId, parameters) {
					if (_layerConfig[layerId]) {
						initialLayers.push (layerId);
					}
				});
			}
			
			// Load the tabs
			bikedata.loadTabs (initialLayers);
			
			// Populate dynamic form controls
			bikedata.populateDynamicFormControls ();
			
			// Show first-run welcome message if the user is new to the site
			bikedata.welcomeFirstRun ();
			
			// Determine the enabled layers
			bikedata.determineLayerStatus ();
			
			// Load the data, and add map interactions and form interactions
			$.each (_layers, function (layerId, layerEnabled) {
				if (layerEnabled) {
					bikedata.enableLayer (layerId);
				}
			});
			
			// Toggle map data layers on/off when checkboxes changed
			$('nav #selector input').change (function() {
				var layerId = this.id.replace('show_', '');
				if (this.checked) {
					_layers[layerId] = true;
					bikedata.enableLayer (layerId);
				} else {
					_layers[layerId] = false;
					if (_xhrRequests[layerId]) {
						_xhrRequests[layerId].abort();
					}
					bikedata.removeLayer (layerId, false);
					bikedata.setStateCookie ();	// Update to catch deletion of cache entry
				}
			});
		},
		
		
		// Function to parse the URL
		getUrlParameters: function ()
		{
			// Start a list of parameters
			var urlParameters = {};
			
			// Split by slash; see: http://stackoverflow.com/a/8086637
			var pathComponents = window.location.pathname.split('/').slice(1);
			
			// End if none
			if (!pathComponents) {return {};}
			
			// Obtain the section
			var section = pathComponents[0];
			if (_layerConfig[section]) {
				urlParameters.sections = [];
				urlParameters.sections.push (section);
			}
			
			// Return the parameters
			return urlParameters;
		},
		
		
		// Function to load the tabs
		loadTabs: function (defaultLayers)
		{
			// Set each default layer and add background
			$.each (defaultLayers, function (index, layerId) {
				
				// Add background highlight to this tab
				$('nav li.' + layerId).addClass('selected');
				
				// Enable tab
				$('nav li.' + layerId + ' input').click();
			});
			
			// Enable tabbing of main menu
			$('nav').tabs();
			
			// Handle selection/deselection of section checkboxes
			$('nav #selector input').change (function() {
				
				// Add background highlight to this tab
				$(this).parent('li').toggleClass('selected', this.checked);
				
				// Switch to its tab contents
				var index = $(this).parent().index();
				$('nav').tabs('option', 'active', index);
			});
			
			// Allow double-clicking of each menu item (surrounding each checkbox) as implicit selection of its checkbox
			$('nav #selector li a').dblclick(function() {
				$(this).parent().find('input').click();
			});
		},
		
		
		// Function to populate dynamic form controls
		populateDynamicFormControls: function ()
		{
			// Support for "data-monthly-since" (e.g. = '2013-07') macro which populates a select with an option list of each month, grouped by optgroup years
			var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			$('select[data-monthly-since]').val(function() {	// See: http://stackoverflow.com/a/16086337
				var since = $(this).data('monthly-since');
				since = since.split('-');
				var sinceYear = since[0];
				var sinceMonth = since[1];
				var html = '';
				var yearToday = new Date().getFullYear();
				var monthToday = new Date().getMonth() + 1;	// Index from 1
				var year;
				var month;
				var month1Indexed;
				for (year = yearToday; year >= sinceYear; year--) {	// See: http://stackoverflow.com/a/26511699
					html += '<optgroup label="' + year + '">';
					for (month = months.length - 1; month >= 0; month--) {	// Loop through backwards reliably; see: http://stackoverflow.com/a/4956313
						month1Indexed = month + 1;
						if ((year == yearToday) && (month1Indexed >= monthToday)) {continue;}	// Skip months not yet completed
						var monthPadded = (month1Indexed < 10 ? '0' : '') + month1Indexed;	// Pad zeroes and cast as string
						html += '<option value="' + year + '-' + monthPadded + '">' + months[month] + ' ' + year + '</option>';
						if ((year == sinceYear) && (monthPadded == sinceMonth)) {break;}	// End at last year and since month
					}
					html += '</optgroup>';
				}
				$(this).append(html);
			});
		},
		
		
		// Function to show a welcome message on first run
		welcomeFirstRun: function ()
		{
			// End if cookie already set
			var name = 'welcome';
			if (Cookies.get(name)) {return;}
			
			// Set the cookie
			Cookies.set(name, '1', {expires: 14});
			
			// Define a welcome message
			var message =
			   '<p>Welcome to Bikedata, from CycleStreets.</p>'
			 + '<p>Here, you can find data useful for cycle campaigning, by enabling the layers on the right.</p>'
			 + '<p>Please note that this site is work-in-progress beta.</p>';
			
			// Show the popup
			vex.dialog.alert ({unsafeMessage: message});
		},
		
		
		// Function to determine the layer status
		determineLayerStatus: function ()
		{
			// Initialise the registry
			$.each (_layerConfig, function (layerId, parameters) {
				_layers[layerId] = false;
			});
			
			// Create a list of the enabled layers
			$('nav #selector input:checked').map (function () {
				var layerId = this.id.replace('show_', '');
				_layers[layerId] = true;
			});
		},
		
		
		// Create the map
		createMap: function ()
		{
			// Add the tile layers
			var tileLayers = [];	// Background tile layers
			var baseLayers = {};	// Labels
			var layer;
			var name;
			$.each (_settings.tileUrls, function (tileLayerId, tileLayerAttributes) {
				layer = L.tileLayer(tileLayerAttributes[0], tileLayerAttributes[1]);
				tileLayers.push (layer);
				name = tileLayerAttributes[2];
				baseLayers[name] = layer;
			});
			
			// Create the map in the "map" div, set the view to a given place and zoom
			_map = L.map('map', {
				center: [51.51137, -0.10498],
				zoom: 17,
				layers: tileLayers[0]	// Documentation suggests tileLayers is all that is needed, but that shows all together
			});
			
			// Add the base (background) layer switcher
			L.control.layers(baseLayers, null).addTo(_map);
			
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
			autocomplete.addTo ('#geocoder input', {
				sourceUrl: _settings.apiBaseUrl + '/v2/geocoder' + '?key=' + _settings.apiKey + '&bounded=1&bbox=' + _settings.autocompleteBbox,
				select: function (event, ui) {
					var bbox = ui.item.feature.properties.bbox.split(',');
					_map.fitBounds([ [bbox[1], bbox[0]], [bbox[3], bbox[2]] ]);
					event.preventDefault();
				}
			});
		},
		
		
		// Function to enable a data layer
		enableLayer: function (layerId)
		{
			// If the layer is not available, give a dialog
			if ($('#selector li.' + layerId).hasClass('unavailable')) {
				vex.dialog.alert ('Sorry, the ' + $('#selector li.' + layerId + ' a').text().toLowerCase() + ' layer is not available yet.');
				$('nav li.' + layerId + ' input').prop('checked', false);
				return;
			}
			
			// Get the form parameters on load
			_parameters[layerId] = bikedata.parseFormValues (layerId);
			
			// Fetch the data
			bikedata.getData (layerId, _parameters[layerId]);
			
			// Register to refresh data on map move
			if (!_layerConfig[layerId].static) {	// Unless marked as static, i.e. no change based on map location
				_map.on ('moveend', function (e) {
					bikedata.getData (layerId, _parameters[layerId]);
				});
			}
			
			// Reload the data, using a rescan of the form parameters when any change is made
			$('form#data #sections :input, form#data #drawing :input').change (function () {
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
			var processing = {};
			var processingStrategy;
			$('form#data #' + layerId + ' :input').each(function() {
				
				// Determine the input type
				var tagName = this.tagName.toLowerCase();	// Examples: 'input', 'select'
				var type = $(this).prop('type');			// Examples: 'text', 'checkbox', 'select-one'
				
				// Obtain the element name and value
				var name = $(this).attr('name');
				var value = $(this).val();
				
				// For checkboxes, degroup them by creating/adding a value that is checked, split by the delimiter
				if (tagName == 'input' && type == 'checkbox') {
					if (this.checked) {
						
						// Get name of this checkbox, stripping any trailing grouping indicator '[]' (e.g. values for 'foo[]' are registered to 'foo')
						name = name.replace(/\[\]$/g, '');
						
						// Determine if there is a post-processing instruction
						processingStrategy = $(this).parent().attr('data-processing');
						if (processingStrategy) {
							processing[name] = processingStrategy;
						}
						
						// Register the value
						if (processingStrategy && (processingStrategy == 'array')) {
							if (!parameters.hasOwnProperty('name')) {parameters[name] = [];}	// Initialise if required
							parameters[name].push (value);
						} else if (parameters[name]) {
							parameters[name] += delimiter + value; // Add value
						} else {
							parameters[name] = value; // Set value
						}
					}
					return;	// Continue to next input
				}
				
				// For all other input types, if there is a value, register it
				if (value.length > 0) {
					parameters[name] = value;	// Set value
					return;	// Continue to next input
				}
			});
			
			// Handle processing when enabled
			$.each(processing, function (name, processingStrategy) {
				
				// Array strategy: convert values list to '["value1", "value2", ...]'
				if (processingStrategy == 'array') {
					parameters[name] = '["' + parameters[name].join('", "') + '"]';
				}
			});
			
			// If the layer requires that query fields are prefixed with a namespace, prefix each fieldname
			if (_layerConfig[layerId].parameterNamespace) {
				var parametersNamespaced = {};
				$.each(parameters, function (field, value) {
					field = _layerConfig[layerId].parameterNamespace + field;
					parametersNamespaced[field] = value;
				});
				parameters = parametersNamespaced;
			}
			
			// Add in boundary data if drawn; this will override bbox (added later)
			var boundary = $('form#data #drawing :input').val();
			if (boundary) {
				parameters.boundary = boundary;
			}
			
			// Return the parameters
			return parameters;
		},
		
		
		// Function to manipulate the map based on form interactions
		getData: function (layerId, parameters)
		{
			// End if the layer has been disabled (as the event handler from _map.on('moveend', ...) may still be firing)
			if (!_layers[layerId]) {return;}
			
			// Start API data parameters
			var apiData = {};
			
			// Add the key, unless disabled
			var sendApiKey = (_layerConfig[layerId].hasOwnProperty('apiKey') ? _layerConfig[layerId].apiKey : true);
			if (sendApiKey) {
				apiData.key = _settings.apiKey;
			}
			
			// Add fixed parameters if present
			if (_layerConfig[layerId].apiFixedParameters) {
				$.each(_layerConfig[layerId].apiFixedParameters, function (field, value) {
					apiData[field] = value;
				});
			}
			
			// If required for this layer, reformat a drawn boundary, leaving it unchanged for other layers
			if (parameters.boundary) {
				if (_layerConfig[layerId].hasOwnProperty('apiBoundaryFormat')) {
					parameters.boundary = bikedata.reformatBoundary (parameters.boundary, _layerConfig[layerId].apiBoundaryFormat);
				}
			}
			
			// Determine which retrieval strategy is needed - bbox (default) or lat/lon
			var retrievalStrategy = _layerConfig[layerId].retrievalStrategy || 'bbox';
			
			// Unless a boundary is drawn in, supply a bbox or lat/lon
			if (!parameters.boundary) {
				
				// For bbox, get the bbox, and reduce the co-ordinate accuracy to avoid over-long URLs
				if (retrievalStrategy == 'bbox') {
					parameters.bbox = _map.getBounds().toBBoxString();
					parameters.bbox = bikedata.reduceBboxAccuracy (parameters.bbox);
				}
				
				// For poly, convert map extents to a boundary listing
				if (retrievalStrategy == 'polygon') {	// As lat1,lon1:lat2,lon2:...
					var sw = _map.getBounds().getSouthWest();
					var se = _map.getBounds().getSouthEast();
					var ne = _map.getBounds().getNorthEast();
					var nw = _map.getBounds().getNorthWest();
					parameters.boundary = sw.lat + ',' + sw.lng + ':' + se.lat + ',' + se.lng + ':' + ne.lat + ',' + ne.lng + ':' + nw.lat + ',' + nw.lng + ':' + sw.lat + ',' + sw.lng;
				}
			}
			
			// If required, rename the boundary field, as some APIs use a different fieldname to 'boundary'
			if (parameters.boundary) {
				if (_layerConfig[layerId].apiBoundaryField) {
					var apiBoundaryField = _layerConfig[layerId].apiBoundaryField;
					parameters[apiBoundaryField] = parameters.boundary;
					delete parameters.boundary;
				}
			}
			
			// Send zoom if required
			if (_layerConfig[layerId].sendZoom) {
				apiData.zoom = _map.getZoom();
			}
			
			// Add in the parameters from the form
			$.each(parameters, function (field, value) {
				apiData[field] = value;
			});
			
			// If no change (e.g. map move while boundary set, and no other changes), avoid re-requesting data
			var requestSerialised = $.param(apiData);
			if (_requestCache[layerId]) {
				if (requestSerialised == _requestCache[layerId]) {
					return;
				}
			}
			_requestCache[layerId] = requestSerialised;     // Update cache
			
			// Set/update a cookie containing the full request state
			bikedata.setStateCookie ();
			
			// Determine the API URL to use
			var apiUrl = _layerConfig[layerId].apiCall;
			if (! (/https?:\/\//).test (apiUrl)) {
				apiUrl = _settings.apiBaseUrl + apiUrl;
			}
			
			// If an outstanding layer request is still active, cancel it
			if (_xhrRequests[layerId] != null) {
				_xhrRequests[layerId].abort();
				_xhrRequests[layerId] = null;
			}
			
			// Start data loading spinner for this layer
			$('#selector li.' + layerId + ' img.loading').show();
			
			// Fetch data
			_xhrRequests[layerId] = $.ajax({
				url: apiUrl,
				dataType: 'json',
				crossDomain: true,	// Needed for IE<=9; see: http://stackoverflow.com/a/12644252/180733
				data: apiData,
				error: function (jqXHR, error, exception) {
					
					// Deregister from the request registry
					_xhrRequests[layerId] = null;
					
					// Stop data loading spinner for this layer
					$('#selector li.' + layerId + ' img.loading').hide();
					
					// Show error, unless deliberately aborted
					if (jqXHR.statusText != 'abort') {
						var data = $.parseJSON(jqXHR.responseText);
						vex.dialog.alert ('Error: ' + data.error);
					}
				},
				success: function (data, textStatus, jqXHR) {
					
					// Deregister from the request registry
					_xhrRequests[layerId] = null;
					
					// Stop data loading spinner for this layer
					$('#selector li.' + layerId + ' img.loading').hide();
					
					// Show API-level error if one occured
					// #!# This is done here because the API still returns Status code 200
					if (data.error) {
						bikedata.removeLayer (layerId, false);
						vex.dialog.alert ('Error from ' + layerId + ' layer: ' + data.error);
						return {};
					}
					
					// Return the data successfully
					return bikedata.showCurrentData(layerId, data, requestSerialised);
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
			var i;
			for (i = 0; i < coordinates.length; i++) {
				coordinates[i] = parseFloat(coordinates[i]).toFixed(accuracy);
			}
			
			// Return the modified set
			return coordinates;
		},
		
		
		// Function to reformat the boundary data for a specific layer
		reformatBoundary: function (boundary, format)
		{
			// For latlon-comma-colons format, order as lat,lon pairs, separated by colons
			if (format == 'latlon-comma-colons') {
				var boundaryUnpacked = JSON.parse(boundary);
				var boundaryPoints = [];
				var i;
				for (i = 0; i < boundaryUnpacked.length; i++) {
					boundaryPoints[i] = boundaryUnpacked[i][1] + ',' + boundaryUnpacked[i][0];	// lat,lon
				}
				boundary = boundaryPoints.join(':');
				return boundary;
			}
		},
		
		
		// Function to set/update a cookie containing the full request state
		setStateCookie: function ()
		{
			Cookies.set ('state', _requestCache, {expires: 14});
		},
		
		
		// Function to construct the popup content
		popupHtml: function (layerId, feature)
		{
			// Use a template if this has been defined in the layer config
			var html;
			if (_layerConfig[layerId].popupHtml) {
				var template = _layerConfig[layerId].popupHtml;
				
				// Define a path parser, so that the template can define properties.foo which would obtain feature.properties.foo; see: http://stackoverflow.com/a/22129960
				Object.resolve = function(path, obj) {
					return path.split('.').reduce(function(prev, curr) {
						return (prev ? prev[curr] : undefined);
					}, obj || self);
				};
				
				// Replace template placeholders; see: http://stackoverflow.com/a/378000
				html = template.replace (/\{[^{}]+\}/g, function(path){
					return Object.resolve ( path.replace(/[{}]+/g, '') , feature);
				});
				
			// Otherwise, create an HTML table dynamically
			} else {
				
				html = '<table>';
				$.each (feature.properties, function (key, value) {
					if (key == 'thumbnailUrl') {
						if (feature.properties.hasPhoto) {
							html += '<p><img src="' + value + '" /></p>';
						}
					}
					if (value === null) {
						value = '[null]';
					}
					if (typeof value == 'string') {
						value = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
					}
					html += '<tr><td>' + key + ':</td><td><strong>' + value + '</strong></td></tr>';
				});
				html += '</table>';
			}
			
			// Street View container, for Point types (as not really applicable to areas)
			if (feature.geometry.type == 'Point') {
				html += '<iframe id="streetview" src="streetview.html?latitude=' + feature.geometry.coordinates[1] + '&longitude=' + feature.geometry.coordinates[0] + '">Street View loading &hellip;</div>';
			}
			
			// Return the content
			return html;
		},
		
		
		// Function to show the data for a layer
		showCurrentData: function (layerId, data, requestSerialised)
		{
			// If this layer already exists, remove it so that it can be redrawn
			bikedata.removeLayer (layerId, true);
			
			// Determine the field in the feature.properties data that specifies the icon to use
			var field = _layerConfig[layerId].iconField;
			
			// Convert from flat JSON to GeoJSON if required
			if (_layerConfig[layerId].flatJson) {
				data = GeoJSON.parse(data, {Point: _layerConfig[layerId].flatJson});
				//console.log(data);
			}
			
			// Define the data layer
			var totalItems = 0;
			_currentDataLayer[layerId] = L.geoJson(data, {
				
				// Set icon type
				pointToLayer: function (feature, latlng) {
					
					// Determine whether to use a local fixed icon, a local icon set, or an icon field in the data
					var iconUrl;
					if (_layerConfig[layerId].iconUrl) {
						iconUrl = _layerConfig[layerId].iconUrl;
					} else if (_layerConfig[layerId].icons) {
						iconUrl = _layerConfig[layerId].icons[feature.properties[field]];
					} else {
						iconUrl = feature.properties[field];
					}
					
					var icon = L.marker (latlng, {
						// Icon properties as per: http://leafletjs.com/reference.html#icon
						icon: L.icon({
							iconUrl: iconUrl,
							iconSize: [38, 95]
						})
					});
					return icon;
				},
				
				// Set popup
				onEachFeature: function (feature, layer) {
					totalItems++;
					var popupContent = bikedata.popupHtml (layerId, feature);
					layer.bindPopup(popupContent);
				},
				
				// Set polygon style if required
				style: function (feature) {
					if (_layerConfig[layerId].polygonStyle) {
						switch (_layerConfig[layerId].polygonStyle) {
							
							// Blue boxes with dashed lines, intended for data that is likely to tessellate, e.g. adjacent box grid
							case 'grid':
								return {
									fillColor: (feature.properties.hasOwnProperty('colour') ? feature.properties.colour : '#03f'),
									weight: 1,
									dashArray: [5, 5]
								};
							
							// Red
							case 'green':
								return {
									color: 'green',
									fillColor: '#090'
								};
						}
					}
				}
			});
			
			// Update the total count
			$('nav #selector li.' + layerId + ' p.total').html(totalItems);
			
			// Enable/update CSV export link, if there are items, and show its count
			if (totalItems) {
				if ( $('#sections #' + layerId + ' div.export p a').length == 0) {	// i.e. currently unlinked
					var exportUrl = _settings.apiBaseUrl + _layerConfig[layerId].apiCall + '?' + requestSerialised + '&format=csv';
					$('#sections #' + layerId + ' div.export p').contents().wrap('<a href="' + exportUrl + '"></a>');
					$('#sections #' + layerId + ' div.export p').addClass('enabled');
					$('#sections #' + layerId + ' div.export p').append(' <span>(' + totalItems + ')</span>');
				}
			}
			
			// Add to the map
			_currentDataLayer[layerId].addTo(_map);
		},
		
		
		// Function to remove a layer
		removeLayer: function (layerId, temporaryRedrawing)
		{
			// Remove the layer, checking first to ensure it exists
			if (_currentDataLayer[layerId]) {
				_map.removeLayer (_currentDataLayer[layerId]);
			}
			
			// Remove the total count
			$('nav #selector li.' + layerId + ' p.total').html('');
			
			// Remove/reset the export link, and its count
			if ($('#sections #' + layerId + ' div.export p a').length) {	// i.e. currently linked
				$('#sections #' + layerId + ' div.export p a').contents().unwrap();
				$('#sections #' + layerId + ' div.export p').removeClass('enabled');
				$('#sections #' + layerId + ' div.export span').remove();
			}
			
			// Reset cache entry
			if (!temporaryRedrawing) {
				delete _requestCache[layerId];
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
			};
			
			// Create a map drawing layer
			var drawnItems = new L.FeatureGroup();
			
			// Add default value if supplied; currently only polygon type supplied
			if (defaultValueString) {
				
				// Convert the string to an array of L.latLng(lat,lon) values
				var polygonPoints = JSON.parse(defaultValueString);
				var defaultPolygon = [];
				if (polygonPoints) {
					var i;
					var point;
					for (i = 0; i < polygonPoints.length; i++) {
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
				var layer = e.layer;
				drawnItems.addLayer(layer);
				
				// Convert to GeoJSON value
				var geojsonValue = drawnItems.toGeoJSON();
				
				// Reduce coordinate accuracy to 6dp (c. 1m) to avoid over-long URLs
				// #!# Ideally this would be native within Leaflet.draw: https://github.com/Leaflet/Leaflet.draw/issues/581
				var coordinates = geojsonValue.features[0].geometry.coordinates[0];
				var accuracy = 6;	// Decimal points; gives 0.1m accuracy; see: https://en.wikipedia.org/wiki/Decimal_degrees
				var i;
				var j;
				for (i = 0; i < coordinates.length; i++) {
					for (j = 0; j < coordinates[i].length; j++) {
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
				
				// Trigger jQuery change event, so that .change() behaves as expected for the hidden field; see: http://stackoverflow.com/a/8965804
				// #!# Note that this fires twice for some reason - see notes to the answer in the above URL
				$(targetField).trigger('change');
			});
			
			// Cancel button clears drawn polygon and clears the form value
			$('.edit-clear').click(function() {
				drawnItems.clearLayers();
				$(targetField).val('');
			
				// Trigger jQuery change event, so that .change() behaves as expected for the hidden field; see: http://stackoverflow.com/a/8965804
				$(targetField).trigger('change');
			});
			
			// Undo button
			$('.edit-undo').click(function() {
				drawnItems.revertLayers();
			});
		}
	};
	
} (jQuery));
