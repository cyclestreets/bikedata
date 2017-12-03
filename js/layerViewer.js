// Layer viewer library code

/*jslint browser: true, white: true, single: true, for: true */
/*global $, jQuery, L, autocomplete, Cookies, vex, GeoJSON, alert, console, window */

var layerviewer = (function ($) {
	
	'use strict';
	
	// Settings defaults
	var _settings = {
		
		// API
		apiBaseUrl: 'API_BASE_URL',
		apiKey: 'YOUR_API_KEY',
		
		// Initial lat/lon/zoom of map and tile layer
		defaultLocation: {
			latitude: 54.661,
			longitude: 1.263,
			zoom: 6
		},
		defaultTileLayer: 'mapnik',
		
		// Default layers ticked
		defaultLayers: [],
		
		// Geocoder API URL; re-use of settings values represented as placeholders {%apiBaseUrl}, {%apiKey}, {%autocompleteBbox}, are supported
		geocoderApiUrl: '{%apiBaseUrl}/v2/geocoder?key={%apiKey}&bounded=1&bbox={%autocompleteBbox}',
		
		// BBOX for autocomplete results biasing
		autocompleteBbox: '-6.6577,49.9370,1.7797,57.6924',
		
		// Feedback API URL; re-use of settings values represented as placeholders {%apiBaseUrl}, {%apiKey}, are supported
		feedbackApiUrl: '{%apiBaseUrl}/v2/feedback.add?key={%apiKey}',
		
		// First-run welcome message
		firstRunMessageHtml: false,
		
		// Google API key for Street View images
		gmapApiKey: 'YOUR_API_KEY',
		
		// Tileserver URLs, each as [path, options, label]
		tileUrls: {
			opencyclemap: [
				'https://{s}.tile.cyclestreets.net/opencyclemap/{z}/{x}/{y}@2x.png',
				{maxZoom: 21, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; <a href="https://www.thunderforest.com/">Thunderforest</a>'},
				'OpenCycleMap'
			],
			mapnik: [
				'https://{s}.tile.cyclestreets.net/mapnik/{z}/{x}/{y}.png',
				{maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'},
				'OpenStreetMap style'
			],
			osopendata: [
				'https://{s}.tile.cyclestreets.net/osopendata/{z}/{x}/{y}.png',
				{maxZoom: 19, attribution: 'Contains Ordnance Survey data &copy; Crown copyright and database right 2010'},
				'OS Open Data'
			],
			bartholomew: [
				'https://{s}.tile.cyclestreets.net/bartholomew/{z}/{x}/{-y}@2x.png',
				{maxZoom: 15, attribution: '&copy; <a href="http://maps.nls.uk/copyright.html">National Library of Scotland</a>'},
				'NLS - Bartholomew Half Inch, 1897-1907'
			],
			os6inch: [
				'https://{s}.tile.cyclestreets.net/os6inch/{z}/{x}/{-y}@2x.png',
				{maxZoom: 15, attribution: '&copy; <a href="http://maps.nls.uk/copyright.html">National Library of Scotland</a>'},
				'NLS - OS 6-inch County Series 1888-1913'
			],
			os1to25k1stseries: [
				'https://{s}.tile.cyclestreets.net/os1to25k1stseries/{z}/{x}/{-y}@2x.png',
				{maxZoom: 16, attribution: '&copy; <a href="http://maps.nls.uk/copyright.html">National Library of Scotland</a>'},
				'NLS - OS 1:25,000 Provisional / First Series 1937-1961',
			],
			os1inch7thseries: [
				'https://{s}.tile.cyclestreets.net/os1inch7thseries/{z}/{x}/{-y}@2x.png',
				{maxZoom: 16, attribution: '&copy; <a href="http://maps.nls.uk/copyright.html">National Library of Scotland</a>'},
				'NLS - OS 1-inch 7th Series 1955-1961'
			]
		}
	};
	
	// Layer definitions, which should be overriden by being supplied as an argument by the calling application
	var _layerConfig = {
		
		/* Example, showing all available options:
		layername: {
			
			// Path or full URL to the API endpoint
			apiCall: '/path/to/api',
			
			// API key specific to this layer's API call
			apiKey: false,
			
			// Fixed parameters required by this API
			apiFixedParameters: {
				key: 'value',
				foo: 'bar'
			},
			
			// Show a message if the zoom level is below this level (i.e. too zoomed out)
			fullZoom: 17,
			
			// If the layer requires that query fields are prefixed with a namespace, prefix each fieldname
			parameterNamespace: 'field:',
			
			// Whether to send zoom= to the API end, which is useful for some APIs
			sendZoom: true,
			
			// Specific icon to use for all markers in this layer
			iconUrl: '/images/icon.svg',
			
			// Field in GeoJSON data where the icon value can be looked up
			iconField: 'type',
			
			// Icon lookups, based on the iconField
			icons: {
				foo: '/images/foo.svg',
				bar: '/images/bar.svg',
				qux: '/images/qux.svg'
			},
			
			// Order of marker appearance, in order from least to most important
			markerImportance: ['foo', 'bar', 'qux'],
			
			// If drawing lines, the field that contains the value used to determine the colour, and the colour stops for this
			lineColourField: 'value',
			lineColourStops: [
				[200, '#ff0000'],
				[50, '#e27474'],
				[0, '#61fa61']
			],
			
			// Similarly, line width
			lineWidthField: 'width',
			lineWidthStops: [
				[250, 10],
				[100, 5],
				[0, 1],
			],
			
			// Polygon style; currently supported values are 'grid' (blue boxes with dashed lines, intended for tessellating data), 'green', 'red'
			polygonStyle: 'grid',
			
			// Code for poups; placeholders can be used to reference data in the GeoJSON
			popupHtml:
				+ '<p>Reference: <strong>{properties.id}</strong></p>'
				+ '<p>Date and time: {properties.datetime}</p>',
			
			// Field that contains a follow-on API URL where more details of the feature can be requested
			detailsOverlay: 'apiUrl',
			
			// Overlay code, as per popupHtml, but for the follow-on overlay data
			overlayHtml: '<p>{properties.caption}</p>',
			
			// Retrieval strategy - 'bbox' (default) sends w,s,e,n; 'polygon' sends as sw.lat,sw.lng:se.lat,se.lng:ne.lat,ne.lng:nw.lat,nw.lng:sw.lat,sw.lng
			retrievalStrategy: 'bbox',
			
			// Boundary parameter name (most likely to be useful in polygon retrievalStrategy mode), defaulting to 'boundary'
			apiBoundaryField: 'boundary',
			
			// If reformatting the boundary in the response is needed, unpacking strategy; only 'latlon-comma-colons' is supported
			apiBoundaryFormat: 'latlon-comma-colons',
			
			// Flat JSON mode, for when GeoJSON is not available, specifying the location of the location fields within a flat structure
			flatJson: ['location.latitude', 'location.longitude'],
			
			// Heatmap mode, implementing Leaflet.heat
			heatmap: false,
			
			// Tile layer mode, which adds a bitmap tile overlay
			tileLayer: []	// Format as per _settings.tileUrls
		},
		
		// More layers
		
		*/
	};
	
	
	// Internal class properties
	var _map = null;
	var _layers = {};	// Layer status registry
	var _currentDataLayer = {};
	var _tileOverlayLayers = {};
	var _heatmapOverlayLayers = {};
	var _parameters = {};
	var _xhrRequests = {};
	var _requestCache = {};
	var _title = false;
	var _embedMode = false;
	var _message = null;
	
	
	return {
		
	// Public functions
		
		// Main function
		initialise: function (config, layerConfig)
		{
			// Merge the configuration into the settings
			$.each (_settings, function (setting, value) {
				if (config.hasOwnProperty(setting)) {
					_settings[setting] = config[setting];
				}
			});
			
			// Obtain the layers
			_layerConfig = layerConfig;
			
			// Parse the URL
			var urlParameters = layerviewer.getUrlParameters ();
			
			// Set the initial location and tile layer
			var defaultLocation = (urlParameters.defaultLocation || _settings.defaultLocation);
			var defaultTileLayer = (urlParameters.defaultTileLayer || _settings.defaultTileLayer);
			
			// Create the map
			layerviewer.createMap (defaultLocation, defaultTileLayer);
			
			// Hide unwanted UI elements in embed mode if required
			layerviewer.embedMode ();
			
			// If HTML5 History state is provided, use that to select the sections
			var initialLayersPopstate = false;
			/* Doesn't work yet, as is asyncronous - need to restructure the initialisation
			$(window).on('popstate', function (e) {
				var popstate = e.originalEvent.state;
				if (popstate !== null) {
					initialLayersPopstate = popstate;
				}
			});
			*/
			
			// If cookie state is provided, use that to select the sections
			var state = Cookies.getJSON('state');
			var initialLayersCookies = [];
			if (state) {
				$.each (state, function (layerId, parameters) {
					if (_layerConfig[layerId]) {
						initialLayersCookies.push (layerId);
					}
				});
			}
			
			// Determine layers to use, checking for data in order of precedence
			var initialLayers = initialLayersPopstate || urlParameters.sections || initialLayersCookies || _settings.defaultLayers;
			
			// Load the tabs
			layerviewer.loadTabs (initialLayers);
			
			// Create mobile navigation
			layerviewer.createMobileNavigation ();
			
			// Populate dynamic form controls
			layerviewer.populateDynamicFormControls ();
			
			// Set form values specified in the URL
			layerviewer.setFormValues (urlParameters.queryString);
			
			// Add tooltip support
			layerviewer.tooltips ();
			
			// Set dialog style
			vex.defaultOptions.className = 'vex-theme-plain';
			
			// Show first-run welcome message if the user is new to the site
			layerviewer.welcomeFirstRun ();
			
			// Create a message area, and provide methods to manipulate it
			layerviewer.messageArea ();
			
			// Enable feedback handler
			layerviewer.feedbackHandler ();
			
			// Determine the enabled layers
			layerviewer.determineLayerStatus ();
			
			// Load the data, and add map interactions and form interactions
			$.each (_layers, function (layerId, layerEnabled) {
				if (layerEnabled) {
					layerviewer.enableLayer (layerId);
				}
			});
			
			// Toggle map data layers on/off when checkboxes changed
			$('nav #selector input').change (function() {
				var layerId = this.id.replace('show_', '');
				if (this.checked) {
					_layers[layerId] = true;
					layerviewer.enableLayer (layerId);
				} else {
					_layers[layerId] = false;
					if (_xhrRequests[layerId]) {
						_xhrRequests[layerId].abort();
					}
					layerviewer.removeLayer (layerId, false);
					layerviewer.setStateCookie ();	// Update to catch deletion of cache entry
				}
			});
		},
		
		
		// Function to parse the URL
		getUrlParameters: function ()
		{
			// Start a list of parameters
			var urlParameters = {};
			
			// Split by slash; see: https://stackoverflow.com/a/8086637
			var pathComponents = window.location.pathname.split('/').slice(1);
			if (pathComponents) {
				
				// Obtain the section(s), checking against the available sections in the settings
				urlParameters.sections = [];
				if (pathComponents[0]) {
					var sections = pathComponents[0].split(',');
					$.each (sections, function (index, section) {
						if (_layerConfig[section]) {
							urlParameters.sections.push (section);
						}
					});
				}
				
				// Obtain embed mode if present
				if (pathComponents[1]) {
					if (pathComponents[1] == 'embed') {
						_embedMode = true;
					}
				}
			}
			
			// Obtain query string parameters, which are used for presetting form values
			urlParameters.queryString = layerviewer.parseQueryString ();
			
			// Get the location from the URL
			urlParameters.defaultLocation = null;
			urlParameters.defaultTileLayer = null;
			if (window.location.hash) {
				var hashParts = window.location.hash.match (/^#([0-9]{1,2})\/([-.0-9]+)\/([-.0-9]+)\/([a-z0-9]+)$/);	// E.g. #17/51.51137/-0.10498/opencyclemap
				if (hashParts) {
					urlParameters.defaultLocation = {
						latitude: hashParts[2],
						longitude: hashParts[3],
						zoom: hashParts[1]
					}
					urlParameters.defaultTileLayer = hashParts[4];
				}
			}
			
			// Return the parameters
			return urlParameters;
		},
		
		
		// Function to parse the query string into key/value pairs
		parseQueryString: function ()
		{
			// See: https://stackoverflow.com/a/8649003/180733
			if (!location.search.length) {return {};}
			var queryString = location.search.substring(1);
			var parameters = JSON.parse('{"' + decodeURI(queryString).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}');
			return parameters;
		},
		
		
		// Function to support embed mode, which disables various UI elements
		embedMode: function ()
		{
			// End if not enabled
			if (!_embedMode) {return;}
			
			// If the site is being iframed, force target of each link to parent
			var inIframe = layerviewer.inIframe ();
			if (inIframe) {
				$('a').attr('target', '_parent');
			}
			
			// Add CSS
			$('body').addClass('embed');
		},
		
		
		// Helper function to determine if the site is being iframed; see: https://stackoverflow.com/a/326076/180733
		inIframe: function () {
			try {
				return window.self !== window.top;
			} catch (e) {
				return true;
			}
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
			
			// If a default tab is defined (or several, in which case use the first), switch to its contents (controls); see: https://stackoverflow.com/a/7916955/180733
			if (defaultLayers[0]) {
				var index = $('nav li.' + defaultLayers[0]).index();
				$('nav').tabs('option', 'active', index);
			}
			
			// Handle selection/deselection of section checkboxes
			$('nav #selector input').change (function() {
				
				// Add background highlight to this tab
				$(this).parent('li').toggleClass('selected', this.checked);
				
				// Update the URL using HTML5 History pushState
				var enabledLayers = [];
				$('nav #selector input:checked').map (function () {
					enabledLayers.push (this.id.replace('show_', ''));
				});
				layerviewer.updateUrl (enabledLayers);
				
				// If enabling, switch to its tab contents (controls)
				if (this.checked) {
					var index = $(this).parent().index();
					$('nav').tabs('option', 'active', index);
				}
			});
			
			// Allow double-clicking of each menu item (surrounding each checkbox) as implicit selection of its checkbox
			$('nav #selector li a').dblclick(function() {
				$(this).parent().find('input').click();
			});
		},
		
		
		// Create mobile navigation
		createMobileNavigation: function ()
		{
			// Add hamburger menu
			$('body').append ('<div id="nav-mobile"></div>');
			
			// Toggle visibility clickable
			$('#nav-mobile').click(function () {
				if ($('nav').is(':visible')) {
					$('nav').hide ('slide', {direction: 'right'}, 250);
				} else {
					$('nav').animate ({width:'toggle'}, 250);
				}
			});
			
			// Enable implicit click/touch on map as close menu
			if ($('#nav-mobile').is(':visible')) {
				if (!$('nav').is(':visible')) {
					$('.map').click(function () {
						$('nav').hide ('slide', {direction: 'right'}, 250);
					});
				};
			};
			
			// Enable closing menu on slide right
			if ($('#nav-mobile').is(':visible')) {
				$('nav').on('swiperight', function () {
					$('nav').hide ('slide', {direction: 'right'}, 250);
				});
			};
		},
		
		
		// Function to update the URL, to provide persistency when a link is circulated
		updateUrl: function (enabledLayers)
		{
			// End if not supported, e.g. IE9
			if (!history.pushState) {return;}
			
			// Construct the URL
			var url = '/';		// Absolute URL
			url += enabledLayers.join(',') + (enabledLayers.length ? '/' : '');
			url += window.location.hash;
			
			// Construct the page title
			if (!_title) {_title = document.title;}		// Obtain and cache the original page title
			var title = _title;
			var layerTitles = [];
			$.each (enabledLayers, function (index, layerId) {
				layerTitles.push (layerviewer.layerNameFromId (layerId).toLowerCase());
			});
			if (layerTitles) {
				title += ': ' + layerTitles.join(', ');
			}
			
			// Push the URL state
			history.pushState (enabledLayers, title, url);
		},
		
		
		// Function to get the layer name from its ID
		layerNameFromId: function (layerId)
		{
			return $('#selector li.' + layerId + ' a').text();
		},
		
		
		// Function to populate dynamic form controls
		populateDynamicFormControls: function ()
		{
			// Support for "data-monthly-since" (e.g. = '2013-07') macro which populates a select with an option list of each month, grouped by optgroup years
			var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			$('select[data-monthly-since]').val(function() {	// See: https://stackoverflow.com/a/16086337
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
				for (year = yearToday; year >= sinceYear; year--) {	// See: https://stackoverflow.com/a/26511699
					html += '<optgroup label="' + year + '">';
					for (month = months.length - 1; month >= 0; month--) {	// Loop through backwards reliably; see: https://stackoverflow.com/a/4956313
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
			
			// Support for "data-yearly-since-unixtime" macro which populates a select with an option list of each year, expressed as Unixtime
			$('select[data-yearly-since-unixtime]').val(function() {
				var sinceYear = $(this).data('yearly-since-unixtime');
				var yearToday = new Date().getFullYear();
				var html = '';
				var year;
				var unixtime;
				for (year = yearToday; year >= sinceYear; year--) {	// See: https://stackoverflow.com/a/26511699
					unixtime = parseInt((new Date(year + '.01.01').getTime() / 1000).toFixed(0));	// https://stackoverflow.com/a/28683720/180733
					html += '<option value="' + unixtime + '">' + year + '</option>';
				}
				$(this).append(html);
			});
		},
		
		
		// Function to set form values specified in the URL
		setFormValues: function (parameters)
		{
			// Loop through each parameter; valid matches are in the form 'layerId:inputId', e.g. layername:formwidget=value
			var formParameters = {};
			$.each (parameters, function (identifier, value) {
				var identifierParts;
				var layerId;
				var inputName;
				if (identifier.match (/^(.+):(.+)$/)) {
					identifierParts = identifier.split (':', 2);
					layerId = identifierParts[0];
					inputName = identifierParts[1];
					if (!formParameters[layerId]) {formParameters[layerId] = {};}	// Initialise nested array if not already present
					formParameters[layerId][inputName] = value;
				}
			});
			
			// Set form values, where they exist
			var elementPath;
			$.each (formParameters, function (layerId, values) {
				if (_layerConfig[layerId]) {	// Validate against layer registry
					$.each (values, function (inputName, value) {
						elementPath = '#sections #' + layerId + ' :input[name="' + inputName + '"]';
						if ($(elementPath).length) {
							$(elementPath).val(value);
						}
					});
				}
			});
		},
		
		
		// Function to add tooltips, using the title value
		tooltips: function ()
		{
			// Use jQuery tooltips; see: https://jqueryui.com/tooltip/
			$('nav').tooltip ({
				track: true
			});
		},
		
		
		// Function to show a welcome message on first run
		welcomeFirstRun: function ()
		{
			// End if no welcome message
			if (!_settings.firstRunMessageHtml) {return;}
			
			// End if cookie already set
			var name = 'welcome';
			if (Cookies.get(name)) {return;}
			
			// Set the cookie
			Cookies.set(name, '1', {expires: 14});
			
			// Show the dialog
			vex.dialog.alert ({unsafeMessage: _settings.firstRunMessageHtml});
		},
		
		
		// Function to create a message area, and provide methods to manipulate it
		messageArea: function ()
		{
			// Create the control
			_message = L.control({position:'bottomleft'});
			
			// Define its contents
			_message.onAdd = function () {
			    this._div = L.DomUtil.create('div', 'message');
			    return this._div;
			};
			
			// Register a method to set and show the message
			_message.show = function (html) {
				this._div.innerHTML = '<p>' + html + '</p>';
				$('.message').show ();
			};
			
			// Register a method to blank the message area
			_message.hide = function () {
				this._div.innerHTML = '';
				$('.message').hide ();
			}
			
			// Add to the map
			_message.addTo(_map);
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
		createMap: function (defaultLocation, defaultTileLayer)
		{
			// Add the tile layers
			var tileLayers = [];		// Background tile layers
			var baseLayers = {};		// Labels
			var baseLayersById = {};	// Layers, by id
			var layer;
			var name;
			$.each (_settings.tileUrls, function (tileLayerId, tileLayerAttributes) {
				layer = L.tileLayer(tileLayerAttributes[0], tileLayerAttributes[1]);
				tileLayers.push (layer);
				name = tileLayerAttributes[2];
				baseLayers[name] = layer;
				baseLayersById[tileLayerId] = layer;
			});
			
			// Create the map in the "map" div, set the view to a given place and zoom
			_map = L.map('map', {
				center: [defaultLocation.latitude, defaultLocation.longitude],
				zoom: defaultLocation.zoom,
				layers: baseLayersById[defaultTileLayer]	// Documentation suggests tileLayers is all that is needed, but that shows all together
			});
			
			// Add the base (background) layer switcher
			L.control.layers(baseLayers, null).addTo(_map);
			
			// Add geocoder control
			layerviewer.geocoder ();
			
			// Add drawing support
			layerviewer.drawing ('#geometry', true, '');
			
			// Add hash support
			// #!# Note that this causes a map move, causing a second data request
			new L.Hash (_map, baseLayersById);
			
			// Add geolocation control
			_map.addControl(L.control.locate({
				icon: 'fa fa-location-arrow',
				locateOptions: {maxZoom: 17}
			}));
		},
		
		
		// Wrapper function to add a geocoder control
		geocoder: function ()
		{
			// Geocoder URL; re-use of settings values is supported, represented as placeholders {%apiBaseUrl}, {%apiKey}, {%autocompleteBbox}
			var geocoderApiUrl = layerviewer.settingsPlaceholderSubstitution (_settings.geocoderApiUrl, ['apiBaseUrl', 'apiKey', 'autocompleteBbox']);
			
			// Attach the autocomplete library behaviour to the location control
			autocomplete.addTo ('#geocoder input', {
				sourceUrl: geocoderApiUrl,
				select: function (event, ui) {
					var bbox = ui.item.feature.properties.bbox.split(',');
					_map.fitBounds([ [bbox[1], bbox[0]], [bbox[3], bbox[2]] ]);
					event.preventDefault();
				}
			});
		},
		
		
		// Helper function to implement settings placeholder substitution in a string
		settingsPlaceholderSubstitution: function (string, supportedPlaceholders)
		{
			// Substitute each placeholder
			var placeholder;
			$.each(supportedPlaceholders, function (index, field) {
				placeholder = '{%' + field + '}';
				string = string.replace(placeholder, _settings[field]);
			});
			
			// Return the modified string
			return string;
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
			_parameters[layerId] = layerviewer.parseFormValues (layerId);
			
			// Register a dialog box handler for showing additional details if required
			if (_layerConfig[layerId].detailsOverlay) {
				layerviewer.detailsOverlayHandler ('#details', layerId);
			}
			
			// Fetch the data
			layerviewer.getData (layerId, _parameters[layerId]);
			
			// Register to refresh data on map move
			if (!_layerConfig[layerId].static) {	// Unless marked as static, i.e. no change based on map location
				_map.on ('moveend', function (e) {
					layerviewer.getData (layerId, _parameters[layerId]);
				});
			}
			
			// Register to show/hide message based on zoom level
			if (_layerConfig[layerId].fullZoom) {
				layerviewer.fullZoomMessage (layerId);
				_map.on ('zoomend', function (e) {
					layerviewer.fullZoomMessage (layerId);
				});
			}
			
			// Reload the data, using a rescan of the form parameters when any change is made
			$('form#data #sections :input, form#data #drawing :input').change (function () {
				_parameters[layerId] = layerviewer.parseFormValues (layerId);
				layerviewer.getData (layerId, _parameters[layerId]);
			});
			$('form#data #sections :text').on ('input', function() {	// Also include text input changes as-you-type; see: https://gist.github.com/brandonaaskov/1596867
				_parameters[layerId] = layerviewer.parseFormValues (layerId);
				layerviewer.getData (layerId, _parameters[layerId]);
			});
		},
		
		
		// Function to create a zoom message for a layer
		fullZoomMessage: function (layerId)
		{
			// Show or hide the message
			if (_map.getZoom () < _layerConfig[layerId].fullZoom) {
				_message.show ('Zoom in to show all ' + layerviewer.layerNameFromId (layerId).toLowerCase() + ' markers - only a selection are shown due to the volume.');
				$('nav #selector li.' + layerId + ' p.total').hide();
			} else {
				_message.hide ();
				$('nav #selector li.' + layerId + ' p.total').show();
			}
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
			
			// If the layer is a tile layer rather than an API call, add it and end
			if (_layerConfig[layerId].tileLayer) {
				var tileUrl = _layerConfig[layerId].tileLayer[0];
				var tileOptions = _layerConfig[layerId].tileLayer[1];
				
				// Substitute placeholder values, e.g. style switcher
				if (parameters) {
					var placeholder;
					$.each(parameters, function (field, value) {
						placeholder = '{%' + field + '}';
						tileUrl = tileUrl.replace(placeholder, value);
					});
				}
				
				// Force redraw if already present, e.g. with different style options
				if (_tileOverlayLayers[layerId]) {
					_map.removeLayer(_tileOverlayLayers[layerId]);
				}
				
				// Add to the map
				_tileOverlayLayers[layerId] = L.tileLayer(tileUrl, tileOptions);
				_map.addLayer(_tileOverlayLayers[layerId]);
				
				// No further action, e.g. API calls
				return;
			}
			
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
					parameters.boundary = layerviewer.reformatBoundary (parameters.boundary, _layerConfig[layerId].apiBoundaryFormat);
				}
			}
			
			// Determine which retrieval strategy is needed - bbox (default) or lat/lon
			var retrievalStrategy = _layerConfig[layerId].retrievalStrategy || 'bbox';
			
			// Unless a boundary is drawn in, supply a bbox or lat/lon
			if (!parameters.boundary) {
				
				// For bbox, get the bbox, and reduce the co-ordinate accuracy to avoid over-long URLs
				if (retrievalStrategy == 'bbox') {
					parameters.bbox = _map.getBounds().toBBoxString();
					parameters.bbox = layerviewer.reduceBboxAccuracy (parameters.bbox);
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
			layerviewer.setStateCookie ();
			
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
				dataType: (layerviewer.browserSupportsCors () ? 'json' : 'jsonp'),		// Fall back to JSON-P for IE9
				crossDomain: true,	// Needed for IE<=9; see: https://stackoverflow.com/a/12644252/180733
				data: apiData,
				error: function (jqXHR, error, exception) {
					
					// Deregister from the request registry
					_xhrRequests[layerId] = null;
					
					// Stop data loading spinner for this layer
					$('#selector li.' + layerId + ' img.loading').hide();
					
					/* Commented out as can be obtrusive if an API endpoint is slow/down
					// Catch cases of being unable to access the server, e.g. no internet access; avoids "Unexpected token u in JSON at position 0" errors
					if (jqXHR.status == 0) {
						vex.dialog.alert ('Error: Could not contact the server; perhaps your internet connection is not working?');
						return;
					}
					*/
					
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
						layerviewer.removeLayer (layerId, false);
						vex.dialog.alert ('Error from ' + layerId + ' layer: ' + data.error);
						return {};
					}
					
					// Return the data successfully
					return layerviewer.showCurrentData(layerId, data, requestSerialised);
				}
			});
		},
		
		
		// Details dialog box handler
		detailsOverlayHandler: function (triggerElement, layerId)
		{
			// Register a handler; note that the HTML in bindPopup doesn't exist yet, so $(triggerElement) can't be used; instead, this listens for click events on the map element which will bubble up from the tooltip, once it's created and someone clicks on it; see: https://stackoverflow.com/questions/13698975/
			$('#map').on('click', triggerElement, function (e) {
				
				// Load the data, using the specified data-id attribute set in the popup HTML dynamically
				var apiUrl = $(this).attr('data-url') + '&key=' + _settings.apiKey;
				$.get(apiUrl, function (data) {
					
					// Access the data
					var feature = data.features[0];
					
					// Render the data into the overlay template
					var template = (_layerConfig[layerId].overlayHtml ? _layerConfig[layerId].overlayHtml : false);
					var html = layerviewer.renderDetails (feature, template);
					
					// Create the dialog box and its contents
					var divId = layerId + 'details';
					html = '<div id="' + divId + '">' + html + '</div>';
					vex.dialog.buttons.YES.text = 'Close';
					vex.dialog.alert ({unsafeMessage: html, showCloseButton: true, className: 'vex vex-theme-plain wider'});
				});
				
				e.preventDefault ();
			});
		},
		
		
		// Helper function to enable fallback to JSON-P for older browsers like IE9; see: https://stackoverflow.com/a/1641582
		browserSupportsCors: function ()
		{
			return ('withCredentials' in new XMLHttpRequest ());
		},
		
		
		// Function to reduce co-ordinate accuracy of a bbox string
		reduceBboxAccuracy: function (bbox)
		{
			// Split by comma
			var coordinates = bbox.split(',');
			
			// Reduce accuracy of each coordinate
			coordinates = layerviewer.reduceCoordinateAccuracy (coordinates);
			
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
		
		
		// Function to construct the popup/overlay content
		renderDetails: function (feature, template)
		{
			// Use a template if this has been defined in the layer config
			var html;
			if (template) {
				
				// Define a path parser, so that the template can define properties.foo which would obtain feature.properties.foo; see: https://stackoverflow.com/a/22129960
				Object.resolve = function(path, obj) {
					return path.split('.').reduce(function(prev, curr) {
						return (prev ? prev[curr] : undefined);
					}, obj || self);
				};
				
				// Convert Street View macro
				if (template.indexOf ('{%streetview}') >= 0) {
					template = template.replace ('{%streetview}', layerviewer.streetViewTemplate (feature));
				}
				
				// If any property is null, show '?' instead
				$.each (feature.properties, function (key, value) {
					if (value === null) {
						feature.properties[key] = '<span class="unknown">?</span>';
					}
				});
				
				// Replace template placeholders; see: https://stackoverflow.com/a/378000
				html = template.replace (/\{[^{}]+\}/g, function(path){
					return Object.resolve ( path.replace(/[{}]+/g, '') , feature);
				});
				
				// Support 'yearstable' macro, which generates a table of fields for each year, with parameters: first year, last year, fieldslist split by semicolon, labels for each field split by semicolon
				var matches = html.match (/\[macro:yearstable\((.+), (.+), (.+), (.+)\)\]/);
				if (matches) {
					html = html.replace (matches[0], layerviewer.macroYearstable (matches, feature));
				}
				
			// Otherwise, create a simple key/value pair HTML table dynamically
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
			
			// Return the content
			return html;
		},
		
		
		// Street View container template
		streetViewTemplate: function (feature)
		{
			return '<iframe id="streetview" src="/streetview.html?latitude=' + feature.geometry.coordinates[1] + '&longitude=' + feature.geometry.coordinates[0] + '">Street View loading &hellip;</div>';
		},
		
		
		// Helper function to process a macro
		macroYearstable: function (matches, feature)
		{
			// Extract the matches
			var minYear = matches[1];
			var maxYear = matches[2];
			var fields = matches[3].split (';');
			var labels = matches[4].split (';');
			
			// Create a year range
			var years = layerviewer.range (parseInt(minYear), parseInt(maxYear));
			
			// Build the table, starting with the headings, representing the years
			var html = '<table>';
			html += '<tr>';
			html += '<th>Year:</th>';
			$.each (fields, function (fieldIndex, field) {
				html += '<th>' + labels[fieldIndex] + '</th>';
			});
			html += '</tr>';
			
			// Index the fields by field then year index
			var fieldsByYear = [];
			$.each (fields, function (fieldIndex, field) {
				fieldsByYear[field] = feature.properties[field].split(',');
			});
			
			// Add each field's data row
			$.each (years, function (yearIndex, year) {
				html += '<tr>';
				html += '<td><strong>' + year + ':</strong></td>';
				$.each (fields, function (fieldIndex, field) {
					var value = fieldsByYear[field][yearIndex];
					html += '<td>' + (layerviewer.isNumeric (value) ? Number(value).toLocaleString() : value) + '</td>';
				});
				html += '</tr>';
			});
			html += '</table>';
			
			// Return the table HTML
			return html;
		},
		
		
		// Helper function to create a number range; see: https://stackoverflow.com/a/3746752
		range: function (start, end)
		{
			if (start > end) {return [];}	// Prevent accidental infinite iteration
			var range = [];
			for (var i = start; i <= end; i++) {
				range.push(i);
			}
			return range;
		},
		
		
		// Helper function to check if a value is numeric; see: https://stackoverflow.com/a/9716515
		isNumeric: function (value)
		{
			return !isNaN (parseFloat (value)) && isFinite (value);
		},
		
		
		// Function to show the data for a layer
		showCurrentData: function (layerId, data, requestSerialised)
		{
			// If a heatmap, divert to this
			if (_layerConfig[layerId].heatmap) {
				layerviewer.heatmap(layerId, data);
				return;
			}
			
			// If this layer already exists, remove it so that it can be redrawn
			layerviewer.removeLayer (layerId, true);
			
			// Determine the field in the feature.properties data that specifies the icon to use
			var iconField = _layerConfig[layerId].iconField;
			
			// Convert from flat JSON to GeoJSON if required
			if (_layerConfig[layerId].flatJson) {
				data = GeoJSON.parse(data, {Point: _layerConfig[layerId].flatJson});
				//console.log(data);
			}
			
			// If marker importance is defined, define the zIndex offset values for each marker type, to be based on the iconField
			if (_layerConfig[layerId].markerImportance) {
				var markerZindexOffsets = [];
				$.each (_layerConfig[layerId].markerImportance, function (index, iconFieldValue) {
					markerZindexOffsets[iconFieldValue] = 1000 + (100 * index);	// See: http://leafletjs.com/reference-1.2.0.html#marker-zindexoffset
				});
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
						iconUrl = _layerConfig[layerId].icons[feature.properties[iconField]];
					} else {
						iconUrl = feature.properties[iconField];
					}
					
					var icon = L.marker (latlng, {
						// Icon properties as per: http://leafletjs.com/reference.html#icon and http://leafletjs.com/examples/custom-icons/
						icon: L.icon({
							iconUrl: iconUrl,
							iconSize: [38, 42]
						})
					});
					
					// Set the icon zIndexOffset if required
					if (_layerConfig[layerId].markerImportance) {
						var fieldValue = feature.properties[iconField];
						icon.setZIndexOffset (markerZindexOffsets[fieldValue]);
					}
					
					// Return the icon
					return icon;
				},
				
				// Set popup
				onEachFeature: function (feature, layer) {
					totalItems++;
					var template = (_layerConfig[layerId].popupHtml ? _layerConfig[layerId].popupHtml : false);
					var popupContent = layerviewer.renderDetails (feature, template);
					layer.bindPopup(popupContent, {autoPan: false, className: layerId});
				},
				
				// Rendering style
				style: function (feature) {
					var styles = {};
					
					// Set polygon style if required
					if (_layerConfig[layerId].polygonStyle) {
						switch (_layerConfig[layerId].polygonStyle) {
							
							// Blue boxes with dashed lines, intended for data that is likely to tessellate, e.g. adjacent box grid
							case 'grid':
								styles.fillColor = (feature.properties.hasOwnProperty('colour') ? feature.properties.colour : '#03f');
								styles.weight = 1;
								styles.dashArray = [5, 5];
								break;
							
							// Green
							case 'green':
								styles.color = 'green';
								styles.fillColor = '#090';
								break;
							
							// Red
							case 'red':
								styles.color = 'red';
								styles.fillColor = 'red';
								break;
						}
					}
					
					// Set line colour if required
					if (_layerConfig[layerId].lineColourField && _layerConfig[layerId].lineColourStops) {
						styles.color = layerviewer.lookupStyleValue (feature.properties[_layerConfig[layerId].lineColourField], _layerConfig[layerId].lineColourStops);
					}
					
					// Set line width if required
					if (_layerConfig[layerId].lineWidthField && _layerConfig[layerId].lineWidthStops) {
						styles.weight = layerviewer.lookupStyleValue (feature.properties[_layerConfig[layerId].lineWidthField], _layerConfig[layerId].lineWidthStops);
					}
					
					// Use supplied colour if present
					if (feature.properties.hasOwnProperty('color')) {
						styles.color = feature.properties.color;
					}
					
					// Return the styles that have been defined, if any
					return styles;
				}
			});
			
			// Update the total count
			$('nav #selector li.' + layerId + ' p.total').html(totalItems);
			
			// Enable/update CSV export link, if there are items, and show its count
			if (totalItems) {
				if ( $('#sections #' + layerId + ' div.export p a').length == 0) {	// i.e. currently unlinked
					var exportUrl = (_layerConfig[layerId].apiCall.match (/^https?:\/\//) ? '' : _settings.apiBaseUrl) + _layerConfig[layerId].apiCall + '?' + requestSerialised + '&format=csv';
					$('#sections #' + layerId + ' div.export p').contents().wrap('<a href="' + exportUrl + '"></a>');
					$('#sections #' + layerId + ' div.export p').addClass('enabled');
					$('#sections #' + layerId + ' div.export p').append(' <span>(' + totalItems + ')</span>');
				}
			}
			
			// Add to the map
			_currentDataLayer[layerId].addTo(_map);
		},
		
		
		// Assign style from lookup table
		lookupStyleValue: function (value, lookupTable)
		{
			// Loop through each style stop until found
			var styleStop;
			for (var i = 0; i < lookupTable.length; i++) {	// NB $.each doesn't seem to work - it doesn't seem to reset the array pointer for each iteration
				styleStop = lookupTable[i];
				if (value >= styleStop[0]) {
					return styleStop[1];
				}
			}
			
			// Fallback to final colour in the list
			return styleStop[1];
		},
		
		
		// Heatmap; see: https://github.com/Leaflet/Leaflet.heat
		heatmap: function (layerId, data)
		{
			// Parse the address points
			var points = data.map(function (point) {
				return [ point[0], point[1] ];
			});
			
			// Redraw if required
			if (_heatmapOverlayLayers[layerId]) {
				_map.removeLayer(_heatmapOverlayLayers[layerId]);
			}
			
			// Create the heatmap
			_heatmapOverlayLayers[layerId] = L.heatLayer(points);
			
			// Add to map
			_heatmapOverlayLayers[layerId].addTo(_map);
		},
		
		
		// Function to remove a layer
		removeLayer: function (layerId, temporaryRedrawing)
		{
			// If the layer is a tile layer rather than an API call, remove it and end
			if (_layerConfig[layerId].tileLayer) {
				if (_tileOverlayLayers[layerId]) {
					_map.removeLayer(_tileOverlayLayers[layerId]);
				}
				
				// No further action, e.g. API calls
				return;
			}
			
			// If the layer is a heatmap layer rather than an API call, remove it and end
			if (_layerConfig[layerId].heatmap) {
				if (_heatmapOverlayLayers[layerId]) {
					_map.removeLayer(_heatmapOverlayLayers[layerId]);
				}
			}
			
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
				
				// Trigger jQuery change event, so that .change() behaves as expected for the hidden field; see: https://stackoverflow.com/a/8965804
				// #!# Note that this fires twice for some reason - see notes to the answer in the above URL
				$(targetField).trigger('change');
			});
			
			// Cancel button clears drawn polygon and clears the form value
			$('.edit-clear').click(function() {
				drawnItems.clearLayers();
				$(targetField).val('');
			
				// Trigger jQuery change event, so that .change() behaves as expected for the hidden field; see: https://stackoverflow.com/a/8965804
				$(targetField).trigger('change');
			});
			
			// Undo button
			$('.edit-undo').click(function() {
				drawnItems.revertLayers();
			});
		},
		
		
		// Feedback box and handler
		feedbackHandler: function ()
		{
			// Obtain the HTML from the page
			var html = $('#feedback').html();
			
			$('a.feedback').click (function (e) {
				html = '<div id="feedbackbox">' + html + '</div>';
				vex.dialog.alert ({unsafeMessage: html, showCloseButton: true, showCloseButton: true, className: 'vex vex-theme-plain feedback'});
				
				// Create the form handler, which submits to the API
				$('#feedbackbox form').submit (function(event) {	// #feedbackbox form used as #feedbackform doesn't seem to exist in the DOM properly in this context
					var resultHtml;
					
					// Feedback URL; re-use of settings values is supported, represented as placeholders {%apiBaseUrl}, {%apiKey}
					var feedbackApiUrl = layerviewer.settingsPlaceholderSubstitution (_settings.feedbackApiUrl, ['apiBaseUrl', 'apiKey']);
					
					var form = $(this);
					$.ajax({
						url: feedbackApiUrl,
						type: form.attr('method'),
						data: form.serialize()
					}).done (function (result) {
						
						// Detect API error
						if ('error' in result) {
							resultHtml = "<p class=\"error\">Sorry, an error occured. The API said: <em>" + result.error + '</em></p>';
							$('#feedbackbox').replaceWith (resultHtml);
						
						// Normal result; NB result.id is the feedback number
						} else {
							resultHtml  = '<p class="success">&#10004; Thank you for submitting feedback.</p>';
							resultHtml += '<p>We read all submissions and endeavour to respond to all feedback.</p>';
							$('#feedbackbox').replaceWith (resultHtml);
						}
						
					}).fail (function (failure) {
						resultHtml = '<p>There was a problem contacting the server; please try again later. The failure was: <em>' + failure.responseText + '</em>.</p>';
						$('#feedbackbox').replaceWith (resultHtml);
					});
					
					// Prevent normal submit
					event.preventDefault();
				});
				
				// Prevent following link to contact page
				return false;
			});
		}
	};
	
} (jQuery));

