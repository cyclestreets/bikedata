// Bikedata application code

/*jslint browser: true, white: true, single: true, for: true */
/*global $, jQuery, L, autocomplete, Cookies, vex, GeoJSON, alert, console, window */

var bikedata = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _settings = {};
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
				  '<p><a href="{properties.url}"><img src="/images/icons/bullet_go.png" /> <strong>View full, detailed report</a></strong></p>'
				+ '<p>Reference: <strong>{properties.id}</strong></p>'
				+ '<p>'
				+ 'Date and time: <strong>{properties.datetime}</strong><br />'
				+ 'Severity: <strong>{properties.severity}</strong><br />'
				+ 'Casualties: <strong>{properties.casualties}</strong><br />'
				+ 'No. of Casualties: <strong>{properties.Number_of_Casualties}</strong><br />'
				+ 'No. of Vehicles: <strong>{properties.Number_of_Vehicles}</strong>'
				+ '</p>'
		},
		
		'taxidata': {
			'apiCall': '/v2/advocacydata.taxis',
			'iconUrl': '/images/icons/road_neutral.svg',
			'heatmap': true
		},
		
		'trafficcounts': {
			'apiCall': '/v2/trafficcounts.locations',
			'apiFixedParameters': {
				'groupyears': '1'
			},
			'iconUrl': '/images/icons/icon_congestion_bad.svg',
			'lineColourField': 'car_pcu',	// #!# Fixme - currently no compiled all_motors_pcu value
			'lineColourStops': [
				[40000, '#ff0000'],	// Colour and line values based on GMCC site
				[20000, '#d43131'],
				[10000, '#e27474'],
				[5000, '#f6b879'],
				[2000, '#fce8af'],
				[0, '#61fa61']
			],
			'lineWidthField': 'cycle_pcu',	// #!# Fixme - should be Daily cycles
			'lineWidthStops': [
				[1000, 5],
				[500, 4],
				[100, 3],
				[10, 2],
				[0, 1],
			],
			'popupHtml':	// Popup code thanks to http://hfcyclists.org.uk/wp/wp-content/uploads/2014/02/captions-html.txt
				  '<p>Count Point {properties.id} on <strong>{properties.road}</strong>, a {properties.road_type}<br />'
				+ 'Located in {properties.wardname} in {properties.boroughname}<br />'
				+ '[macro:yearstable({properties.minyear}, {properties.maxyear}, cycles;p2w;cars;buses;lgvs;mgvs;hgvs;all_motors;all_motors_pcu, Cycles;P2W;Cars;Buses;LGVs;MGVs;HGVs;Motors;Motor PCU)]'
				+ '<p><strong>{properties.maxyear} PCU breakdown -</strong> Cycles: {properties.cycle_pcu}, P2W: {properties.p2w_pcu}, Cars: {properties.car_pcu}, Buses: {properties.bus_pcu}, LGVs: {properties.lgv_pcu}, MGVs: {properties.mgv_pcu}, HGVs: {properties.hgv_pcu}</p>'
				+ '</div>'
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
			'polygonStyle': 'grid',
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
			'apiCall': 'https://www.cyclescape.org/api/issues.json',
			'apiKey': false,
			'apiFixedParameters': {
				'page': 1,
				'per_page': 100
			},
			'iconUrl': '/images/icons/destinations_bad.svg',
			'polygonStyle': 'red',
			'popupHtml':
				  '<p><strong><a href="{properties.cyclescape_url}">{properties.title}</a></strong></p>'
				+ '<div class="scrollable">'
				+ '{properties.description}'	// Already HTML
				+ '</div>'
				+ '<p><a href="{properties.cyclescape_url}">Full details</a></p>'
		},
		
		'photomap': {
			'apiCall': '/v2/photomap.locations',
			'apiFixedParameters': {
				'fields': 'id,captionHtml,hasPhoto,thumbnailUrl,url,username,licenseName,iconUrl,categoryName,metacategoryName,datetime',
				'limit': 150,
				'thumbnailsize': 300,
				'datetime': 'friendlydate'
			},
			'iconField': 'iconUrl',		// icons specified in the field value
			'popupHtml':
				  '<p><img src="{properties.thumbnailUrl}" /></p>'
				+ '<div class="scrollable">'
				+ '<strong>{properties.captionHtml}</strong>'
				+ '</div>'
				+ '<table>'
				+ '<tr><td>Date:</td><td>{properties.datetime}</td></tr>'
				+ '<tr><td>By:</td><td>{properties.username}</td></tr>'
				+ '<tr><td>Category:</td><td>{properties.categoryName} &mdash; {properties.metacategoryName}</td></tr>'
				+ '</table>'
				+ '<p><a href="{properties.url}">Full details</a></p>'
		},
		
		// https://wiki.openstreetmap.org/wiki/Strava
		'strava': {
			'apiCall': false,
			'apiKey': false,
			'tileLayer': [
				'https://globalheat.strava.com/tiles/cycling/{%style}/{z}/{x}/{y}.png',   // E.g. https://globalheat.strava.com/tiles/cycling/color1/15/16370/10922.png
				{maxZoom: 17, attribution: 'Strava heatmap (used experimentally), not for tracing'},
				'Strava heatmap'
			]
		},
		
		// https://www.cyclestreets.net/api/v2/mapdata/
		'cycleability': {
			'apiCall': 'https://api.cyclestreets.net/v2/mapdata',
			'apiFixedParameters': {
				'limit': 400,
				'types': 'way'
			},
			'sendZoom': true,
			'popupHtml':
				  '<table>'
				+ '<tr><td>Name:</td><td><strong>{properties.name}</strong></td></tr>'
				+ '<tr><td>OSM ID:</td><td><a href="https://www.openstreetmap.org/way/{properties.id}" target="_blank" title="[Link opens in a new window]">{properties.id}</a></td></tr>'
				+ '<tr><td>Cycleable?</td><td>{properties.cyclableText}</td></tr>'
				+ '<tr><td>Quietness:</td><td><strong>{properties.quietness}</strong></td></tr>'
				+ '<tr><td>Speed rating</td><td>{properties.speed}</td></tr>'
				+ '<tr><td>Pause</td><td>{properties.pause}</td></tr>'
				+ '<tr><td>Type</td><td>{properties.ridingSurface}</td></tr>'
				+ '</table>'
		},
		
		// https://www.cyclescape.org/api
		'groups': {
			'apiCall': 'https://www.cyclescape.org/api/groups.json',
			'apiKey': false,
			'polygonStyle': 'green',
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
			
			// Parse the URL
			var urlParameters = bikedata.getUrlParameters ();
			
			// Hide unwanted UI elements in embed mode if required
			bikedata.embedMode ();
			
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
			var initialLayers = initialLayersPopstate || urlParameters.sections || initialLayersCookies || _defaultLayers;
			
			// Load the tabs
			bikedata.loadTabs (initialLayers);
			
			// Populate dynamic form controls
			bikedata.populateDynamicFormControls ();
			
			// Set form values specified in the URL
			bikedata.setFormValues (urlParameters.queryString);
			
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
			
			// Split by slash; see: https://stackoverflow.com/a/8086637
			var pathComponents = window.location.pathname.split('/').slice(1);
			
			// End if none
			if (!pathComponents) {return {};}
			
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
			
			// Obtain query string parameters, which are used for presetting form values
			urlParameters.queryString = bikedata.parseQueryString ();
			
			// Return the parameters
			return urlParameters;
		},
		
		
		// Function to parse the query string into key/value pairs
		parseQueryString: function ()
		{
			// See: http://stackoverflow.com/a/8649003/180733
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
			var inIframe = bikedata.inIframe ();
			if (inIframe) {
				$('a').attr('target', '_parent');
			}
			
			// Add CSS
			$('body').addClass('embed');
		},
		
		
		// Helper function to determine if the site is being iframed; see: http://stackoverflow.com/a/326076/180733
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
			
			// If a default tab is defined (or several, in which case use the first), switch to its contents (controls); see: http://stackoverflow.com/a/7916955/180733
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
				bikedata.updateUrl (enabledLayers);
				
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
				layerTitles.push ($('#selector li.' + layerId + ' a').text().toLowerCase());
			});
			if (layerTitles) {
				title += ': ' + layerTitles.join(', ');
			}
			
			// Push the URL state
			history.pushState (enabledLayers, title, url);
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
			// Loop through each parameter; valid matches are in the form 'layerId:inputId', e.g. photomap:tags=cycleparking
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
			
			// Show the dialog
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
			new L.Hash (_map, baseLayersById);
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
			$('form#data #sections :text').on ('input', function() {	// Also include text input changes as-you-type; see: https://gist.github.com/brandonaaskov/1596867
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
				dataType: (bikedata.browserSupportsCors () ? 'json' : 'jsonp'),		// Fall back to JSON-P for IE9
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
						bikedata.removeLayer (layerId, false);
						vex.dialog.alert ('Error from ' + layerId + ' layer: ' + data.error);
						return {};
					}
					
					// Return the data successfully
					return bikedata.showCurrentData(layerId, data, requestSerialised);
				}
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
				
				// Define a path parser, so that the template can define properties.foo which would obtain feature.properties.foo; see: https://stackoverflow.com/a/22129960
				Object.resolve = function(path, obj) {
					return path.split('.').reduce(function(prev, curr) {
						return (prev ? prev[curr] : undefined);
					}, obj || self);
				};
				
				// Replace template placeholders; see: https://stackoverflow.com/a/378000
				html = template.replace (/\{[^{}]+\}/g, function(path){
					return Object.resolve ( path.replace(/[{}]+/g, '') , feature);
				});
				
				// Support 'yearstable' macro, which generates a table of fields for each year, with parameters: first year, last year, fieldslist split by semicolon, labels for each field split by semicolon
				var matches = html.match (/\[macro:yearstable\((.+), (.+), (.+), (.+)\)\]/);
				if (matches) {
					html = html.replace (matches[0], bikedata.macroYearstable (matches, feature));
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
			
			// // Street View container, for Point types (as not really applicable to areas)
			// if (feature.geometry.type == 'Point') {
			// 	html += '<iframe id="streetview" src="/streetview.html?latitude=' + feature.geometry.coordinates[1] + '&longitude=' + feature.geometry.coordinates[0] + '">Street View loading &hellip;</div>';
			// }
			
			// Return the content
			return html;
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
			var years = bikedata.range (parseInt(minYear), parseInt(maxYear));
			
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
					html += '<td>' + (bikedata.isNumeric (value) ? Number(value).toLocaleString() : value) + '</td>';
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
				bikedata.heatmap(layerId, data);
				return;
			}
			
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
						// Icon properties as per: http://leafletjs.com/reference.html#icon and http://leafletjs.com/examples/custom-icons/
						icon: L.icon({
							iconUrl: iconUrl,
							iconSize: [38, 42]
						})
					});
					return icon;
				},
				
				// Set popup
				onEachFeature: function (feature, layer) {
					totalItems++;
					var popupContent = bikedata.popupHtml (layerId, feature);
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
						styles.color = bikedata.lookupStyleValue (feature.properties[_layerConfig[layerId].lineColourField], _layerConfig[layerId].lineColourStops);
					}
					
					// Set line width if required
					if (_layerConfig[layerId].lineWidthField && _layerConfig[layerId].lineWidthStops) {
						styles.weight = bikedata.lookupStyleValue (feature.properties[_layerConfig[layerId].lineWidthField], _layerConfig[layerId].lineWidthStops);
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
					var exportUrl = _settings.apiBaseUrl + _layerConfig[layerId].apiCall + '?' + requestSerialised + '&format=csv';
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
		}
	};
	
} (jQuery));

