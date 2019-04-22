// Bikedata implementation code

/*jslint browser: true, white: true, single: true, for: true */
/*global $, alert, console, window */

var bikedata = (function ($) {
	
	'use strict';
	
	// Settings defaults
	var _settings = {
		
		// CycleStreets API; obtain a key at https://www.cyclestreets.net/api/apply/
		apiBaseUrl: 'https://api.cyclestreets.net',
		apiKey: 'YOUR_API_KEY',
		
		// Initial lat/lon/zoom of map and tile layer
		defaultLocation: {
			latitude: 51.51137,
			longitude: -0.10498,
			zoom: 17
		},
		defaultTileLayer: 'opencyclemap',
		
		// Default layers ticked
		defaultLayers: ['collisions', 'photomap'],
		
		// Icon size, set globally for all layers
		iconSize: [38, 42],
		
		// Enable scale bar
		enableScale: true,
		
		// First-run welcome message
		firstRunMessageHtml: '<p>Welcome to Bikedata, from CycleStreets, the journey planning people.</p>'
			+ '<p>Here, you can find data useful for cycle campaigning, by enabling the layers on the right.</p>'
			+ '<p>Please note that this site is work-in-progress beta.</p>'
	};
	
	// Layer definitions
	var _layerConfig = {
		
		collisions: {
			apiCall: '/v2/collisions.locations',
			apiFixedParameters: {
				jitter: '1',
				datetime: 'friendly'
			},
			fullZoom: 17,
			parameterNamespace: 'field:',		// See: https://www.cyclestreets.net/api/v2/collisions.locations/
			sendZoom: true,	// Needed for jitter support
			iconField: 'severity',
			icons: {
				slight:  '/images/icons/icon_collision_slight.svg',
				serious: '/images/icons/icon_collision_serious.svg',
				fatal:   '/images/icons/icon_collision_fatal.svg'
			},
			markerImportance: ['slight', 'serious', 'fatal'],
			popupHtml:
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
		
		taxidata: {
			apiCall: '/v2/advocacydata.taxis',
			iconUrl: '/images/icons/road_neutral.svg',
			heatmap: true
		},
		
		trafficcounts: {
			apiCall: '/v2/trafficcounts.locations',
			apiFixedParameters: {
				groupyears: '1'
			},
			iconUrl: '/images/icons/icon_congestion_bad.svg',
			lineColourField: 'car_pcu',	// #!# Fixme - currently no compiled all_motors_pcu value
			lineColourStops: [
				[40000, '#ff0000'],	// Colour and line values based on GMCC site
				[20000, '#d43131'],
				[10000, '#e27474'],
				[5000, '#f6b879'],
				[2000, '#fce8af'],
				[0, '#61fa61']
			],
			lineWidthField: 'cycle_pcu',	// #!# Fixme - should be Daily cycles
			lineWidthStops: [
				[1000, 10],
				[500, 8],
				[100, 6],
				[10, 4],
				[0, 2],
			],
			popupHtml:	// Popup code thanks to https://hfcyclists.org.uk/wp/wp-content/uploads/2014/02/captions-html.txt
				  '<p>Count Point {properties.id} on <strong>{properties.road}</strong>, a {properties.road_type}<br />'
				+ 'Located in {properties.wardname} in {properties.boroughname}<br />'
				+ '[macro:yearstable({properties.minyear}, {properties.maxyear}, cycles;p2w;cars;buses;lgvs;mgvs;hgvs;all_motors;all_motors_pcu, Cycles;P2W;Cars;Buses;LGVs;MGVs;HGVs;Motors;Motor PCU)]'
				+ '<p><strong>{properties.maxyear} PCU breakdown -</strong> Cycles: {properties.cycle_pcu}, P2W: {properties.p2w_pcu}, Cars: {properties.car_pcu}, Buses: {properties.bus_pcu}, LGVs: {properties.lgv_pcu}, MGVs: {properties.mgv_pcu}, HGVs: {properties.hgv_pcu}</p>'
				+ '</div>'
		},
		
		planningapplications: {
			apiCall: 'https://www.planit.org.uk/api/applics/geojson',
			apiFixedParameters: {
				pg_sz: 100,
				limit: 100
			},
			apiKey: false,
			iconUrl: '/images/icons/signs_neutral.svg',
			popupHtml:
				  '<p><strong>{properties.description}</strong></p>'
				+ '<p>{properties.address}</p>'
				+ '<p>Reference: <a href="{properties.url}">{properties.uid}</a><br />'
				+ 'Local Authority: {properties.authority_name}<br />'
				+ 'Date: {properties.start_date}</p>'
				+ '<p><a href="{properties.url}"><img src="images/icons/bullet_go.png" /> <strong>View full details</a></strong></p>'
		},
		
		bikeshare: {
			apiCall: '/v2/pois.locations',
			apiFixedParameters: {
				type: 'londoncyclehire',	// NB This value likely to be changed (generalised) in future
				limit: 400
			},
			iconUrl: '/images/icons/bicycles_good.svg',
			popupHtml:
				  '<p><strong>Cycle hire dock</strong></p>'
				+ '<p>{properties.name}</p>'
				+ '<p>{properties.notes}</p>'
		},
		
		triplengths: {
			apiCall: '/v2/usage.journeylengths',
			polygonStyle: 'grid',
			popupHtml:
				  '<p>Average distance: <strong>{properties.distance}km</strong>'
		},
		
		cycleparking: {
			apiCall: '/v2/pois.locations',
			apiFixedParameters: {
				type: 'cycleparking',
				fields: 'id,name,osmTags[capacity,access,bicycle_parking,covered],nodeId',
				limit: 400
			},
			iconUrl: '/images/icons/cycleparking_good.svg',
			popupHtml:
				  '<p><strong>Cycle parking</strong></p>'
				+ '<table>'
				+ '<tr><td>Spaces:</td><td>{properties.Capacity}</td></tr>'
				+ '<tr><td>Access:</td><td>{properties.Access}</tr>'
				+ '<tr><td>Type:</td><td>{properties.Bicycle_parking}</tr>'
				+ '<tr><td>Covered?:</td><td>{properties.Covered}</tr>'
				+ '</table>'
				+ '<p class="edit"><a href="https://www.openstreetmap.org/edit?node={properties.nodeId}" target="_blank">Add/edit details</a></p>'
		},
		
		// https://data.police.uk/docs/method/crime-street/
		// https://data.police.uk/api/crimes-street/bicycle-theft?poly=52.199295,0.124497:52.214312,0.124497:52.214312,0.1503753:52.1992,0.15037:52.19929,0.1244&date=2016-07
		cycletheft: {
			apiCall: 'https://data.police.uk/api/crimes-street/bicycle-theft',
			retrievalStrategy: 'polygon',
			flatJson: ['location.latitude', 'location.longitude'],
			apiKey: false,
			apiBoundaryField: 'poly',
			apiBoundaryFormat: 'latlon-comma-colons',
			iconUrl: '/images/icons/icon_enforcement_bad.svg',
			popupHtml:
				  '<p>Crime no.: <strong>{properties.persistent_id}</strong></p>'
				+ '<p>'
				+ 'Date: <strong>{properties.month}</strong><br />'
				+ 'Location: <strong>{properties.location.street.name}</strong><br />'
				+ 'Outcome: <strong>{properties.outcome_status.category}</strong><br />'
				+ '</p>'
				+ '<p>Note: The location given in the police data is <a href="https://data.police.uk/about/#location-anonymisation" target="_blank" title="See more details [link opens in a new window]">approximate</a>, for anonymity reasons.</p>'
		},
		
		// https://www.cyclescape.org/api
		issues: {
			apiCall: 'https://www.cyclescape.org/api/issues.json',
			apiKey: false,
			apiFixedParameters: {
				page: 1,
				per_page: 100
			},
			iconUrl: '/images/icons/destinations_bad.svg',
			polygonStyle: 'red',
			popupHtml:
				  '<p><strong><a href="{properties.cyclescape_url}">{properties.title}</a></strong></p>'
				+ '<div class="scrollable">'
				+ '{properties.description}'	// Already HTML
				+ '</div>'
				+ '<p><a href="{properties.cyclescape_url}">Full details</a></p>'
		},
		
		photomap: {
			apiCall: '/v2/photomap.locations',
			apiFixedParameters: {
				fields: 'id,captionHtml,hasPhoto,thumbnailUrl,url,username,licenseName,iconUrl,categoryName,metacategoryName,datetime,apiUrl',
				limit: 150,
				thumbnailsize: 300,
				datetime: 'friendlydate'
			},
			iconField: 'iconUrl',		// icons specified in the field value
			popupHtml:
				  '<p><a href="/photomap/{properties.id}/" id="details" data-url="{properties.apiUrl}&thumbnailsize=800"><img src="{properties.thumbnailUrl}" /></a></p>'
				+ '<div class="scrollable">'
				+ '<strong>{properties.captionHtml}</strong>'
				+ '</div>'
				+ '<table>'
				+ '<tr><td>Date:</td><td>{properties.datetime}</td></tr>'
				+ '<tr><td>By:</td><td>{properties.username}</td></tr>'
				+ '<tr><td>Category:</td><td>{properties.categoryName} &mdash; {properties.metacategoryName}</td></tr>'
				+ '</table>'
				+ '<p><a href="{properties.url}"><img src="images/icons/bullet_go.png" /> <strong>View full details</a></strong></p>',
			detailsOverlay: 'apiUrl',
			overlayHtml:
				  '<table class="fullimage">'
				+ '<tr>'
				+ '<td>'
				+ '<p><img src="{properties.thumbnailUrl}" /></p>'
				+ '</td>'
				+ '<td>'
				+ '<p>'
				+ '<strong>{properties.caption}</strong>'
				+ '</p>'
				+ '<table>'
				// + '<tr><td>Date:</td><td>{properties.datetime}</td></tr>'
				+ '<tr><td>By:</td><td>{properties.username}</td></tr>'
				// + '<tr><td>Category:</td><td>{properties.categoryName} &mdash; {properties.metacategoryName}</td></tr>'
				+ '</table>'
				+ '{%streetview}'
				+ '</td>'
				+ '</tr>'
				+ '</table>'
		},
		
		// https://wiki.openstreetmap.org/wiki/Strava
		strava: {
			apiCall: false,
			apiKey: false,
			tileLayer: [
				'https://heatmap-external-c.strava.com/tiles/ride/{%style}/{z}/{x}/{y}.png?v=19',	// E.g. https://heatmap-external-c.strava.com/tiles/ride/blue/11/1026/674.png?v=19
				{maxZoom: 17, attribution: 'Strava heatmap (used experimentally), not for tracing'},
				'Strava heatmap'
			]
		},
		
		// https://www.cyipt.bike/api/#width
		widths: {
			apiCall: 'https://www.cyipt.bike/api/v1/width.json',
			sendZoom: true,
			lineColourField: 'width',
			lineColourStops: [
				[14, '#4575b4'],
				[12, '#74add1'],
				[10, '#abd9e9'],
				[8, '#e0f3f8'],
				[6, '#fee090'],
				[4, '#fdae61'],
				[2, '#f46d43'],
				[0, '#d73027']
			],
			lineWidthField: 'width',
			lineWidthStops: [
				[21, 8],
				[14, 7],
				[8, 6],
				[5, 5],
				[3, 4],
				[0, 3],
			],
			popupHtml:
				  '<p>Width: {properties.width}</p>'
				+ '{%streetview}'
		},
		
		// https://www.cyclestreets.net/api/v2/mapdata/
		cycleability: {
			apiCall: '/v2/mapdata',
			apiFixedParameters: {
				limit: 400,
				types: 'way'
			},
			sendZoom: true,
			popupHtml:
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
		groups: {
			apiCall: 'https://www.cyclescape.org/api/groups.json',
			apiKey: false,
			polygonStyle: 'green',
			popupHtml:
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
			// Merge the configuration into the settings
			$.each (_settings, function (setting, value) {
				if (config.hasOwnProperty(setting)) {
					_settings[setting] = config[setting];
				}
			});
			
			// Run the layerviewer for these settings and layers
			layerviewer.initialise (_settings, _layerConfig);
			
			// Autocomplete
			bikedata.autocomplete ();
		},
		
		
		// Autocomplete
		autocomplete: function ()
		{
			// Enable autocomplete for Photomap tags; see: https://stackoverflow.com/a/21398000/180733
			$('#photomap input[name="tags"]').autocomplete({
				minLength: 3,
				source: function (request, response) {
					$.ajax({
						dataType: 'json',
						type : 'GET',
						url: _settings.apiBaseUrl + '/v2/photomap.tags?key=' + _settings.apiKey + '&limit=10',
						data: {
							match: request.term
						},
						success: function (data) {
							response ($.map (data, function (item) {
								return {
									label: item.tag,
									value: item.tag
								}
							}));
						}
					});
				}
			});
		}
	};
	
} (jQuery));

