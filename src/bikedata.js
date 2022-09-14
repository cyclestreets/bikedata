// Bikedata implementation code

/*jslint browser: true, white: true, single: true, for: true, unordered: true, long: true */
/*global $, alert, console, window, osmtogeojson, layerviewer, jQuery */

var bikedata = (function ($) {
	
	'use strict';
	
	// Settings defaults
	var _settings = {
		
		// CycleStreets API; obtain a key at https://www.cyclestreets.net/api/apply/
		apiBaseUrl: 'https://api.cyclestreets.net',
		apiKey: 'YOUR_API_KEY',
		
		// Mapbox API key
		mapboxApiKey: 'YOUR_MAPBOX_API_KEY',
		
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
		
		// Zoom position
		zoomPosition: 'top-left',
		
		// Geolocation position
		geolocationPosition: 'top-left',
		
		// Enable scale bar
		enableScale: true,
		
		// First-run welcome message
		firstRunMessageHtml: '<p>Welcome to Bikedata, from CycleStreets, the journey planning people.</p>'
			+ '<p>Here, you can find data useful for cycle campaigning, by enabling the layers on the right.</p>'
			+ '<p>Please note that this site is work-in-progress beta.</p>',
		firstRunMessageEmbedMode: false
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
				+ 'No. of Casualties: <strong>{properties.number_of_casualties}</strong><br />'
				+ 'No. of Vehicles: <strong>{properties.number_of_vehicles}</strong>'
				+ '</p>'
				+ '{%streetview}'
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
				[0, 2]
			],
			popupHtml:	// Popup code thanks to https://hfcyclists.org.uk/wp/wp-content/uploads/2014/02/captions-html.txt
				  '<p>Count Point {properties.id} on <strong>{properties.road}</strong>, a {properties.road_type}.</p>'
			//	+ 'Located in {properties.wardname} in {properties.boroughname}<br />'
				+ '[macro:yearstable({properties.minyear}, {properties.maxyear}, cycles;p2w;cars;buses;lgvs;mgvs;hgvs;all_motors;all_motors_pcu, Cycles;P2W;Cars;Buses;LGVs;MGVs;HGVs;Motors;Motor PCU)]'
				+ '<p><strong>{properties.maxyear} PCU breakdown -</strong> Cycles: {properties.cycle_pcu}, P2W: {properties.p2w_pcu}, Cars: {properties.car_pcu}, Buses: {properties.bus_pcu}, LGVs: {properties.lgv_pcu}, MGVs: {properties.mgv_pcu}, HGVs: {properties.hgv_pcu}</p>'
				+ '</div>'
		},
		
		planningapplications: {
			apiCall: 'https://www.planit.org.uk/api/applics/geojson',
			apiFixedParameters: {
				pg_sz: 100,
				limit: 100,
				select: 'location,description,address,app_size,app_type,app_state,uid,area_name,start_date,url'
			},
			apiKey: false,
			iconUrl: '/images/icons/signs_neutral.svg',
			iconSizeField: 'app_size',
			iconSizes: {
				'Small': [24, 24],
				'Medium': [36, 36],
				'Large': [50, 50]
			},
			popupHtml:
				  '<p><strong>{properties.description}</strong></p>'
				+ '<p>{properties.address}</p>'
				+ '<p>Size of development: <strong>{properties.app_size}</strong><br />'
				+ 'Type of development: <strong>{properties.app_type}</strong><br />'
				+ 'Status: <strong>{properties.app_state}</strong></p>'
				+ '<p>Reference: <a href="{properties.url}">{properties.uid}</a><br />'
				+ 'Local Authority: {properties.area_name}<br />'
				+ 'Date: {properties.start_date}</p>'
				+ '<p><a href="{properties.url}"><img src="/images/icons/bullet_go.png" /> <strong>View full details</a></strong></p>'
		},
		
		bikeshare: {
			apiCall: '/v2/pois.locations',
			apiFixedParameters: {
				type: 'londoncyclehire',	// NB This value likely to be changed (generalised) in future
				limit: 400
			},
			iconField: 'iconUrl',
			iconSize: [28, 28],
			popupHtml:
				  '<p><strong>Cycle hire dock</strong></p>'
				+ '<p>{properties.name}</p>'
				+ '<p>{properties.notes}</p>'
		},
		
		// https://www.cyclestreets.net/api/v2/pois.locations/
		pollingstations: {
			apiCall: '/v2/pois.locations',
			apiFixedParameters: {
				type: 'pollingstations',
				limit: 400,
				iconsize: 24,
			},
			iconField: 'iconUrl',
			iconSize: [24, 24],
			popupHtml:
				  '<p><strong>Polling station</strong></p>'
				+ '<p>{properties.name}</p>'
				+ '<p>{properties.notes}</p>'
				+ '<p><a href="{properties.website}" target="_blank">{properties.website}</a></p>'
				+ '<p><a href="https://www.cyclestreets.net/journey/to/{geometry.coordinates.1},{geometry.coordinates.0},14/Polling+station/" target="_blank"><strong>Get cycle directions here!</strong></a></p>'
		},
		
		// https://www.cyclestreets.net/api/v2/advocacydata.popupcycleways.locations/
		popupcyclewaylocations: {
			apiCall: '/v2/advocacydata.popupcycleways.locations',
			bbox: false,
			iconField: 'type',
			iconSize: [40, 40],
			icons: {
				'Council action': 						'/images/icons/popup_cyclinguk_council_action.png',
				'Coming soon': 							'/images/icons/popup_cyclinguk_coming_soon.png',
				'Council consultation - have your say':	'/images/icons/popup_cyclinguk_council_consultation.png',
				'Council considering potential': 		'/images/icons/popup_cyclinguk_council_considering_potential.png',
				'Plans produced': 						'/images/icons/popup_cyclinguk_plans_produced.png',
				'Council action - comprehensive': 		'/images/icons/popup_cyclinguk_council_action_comprehensive.png'
			},
			popupHtml:
				  '<table>'
				+ '<tr><td>Area:</td><td><strong>{properties.area}</strong></td></tr>'
				+ '<tr><td>Description:</td><td><strong>{properties.description}</strong></tr>'
				+ '<tr><td>Location:</td><td>{properties.location}</tr>'
				+ '<tr><td>Type:</td><td>{properties.type}</tr>'
				+ '<tr><td></td><td><a href="{properties.link}">More info</a></tr>'
				+ '</table>'
				//+ '{%streetview}'
		},
		
		// https://www.cyclestreets.net/api/v2/advocacydata.popupcycleways.suggested/
		popupcycleways: {
			apiCall: '/v2/advocacydata.popupcycleways.suggested',
			minZoom: 9,
			style: {
				LineString: {
					'line-color': 'purple'
				}
			}
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
			iconSize: [24, 24],
			popupHtml:
				  '<h3>Cycle parking</h3>'
				+ '<table>'
				+ '<tr><td>Spaces:</td><td>{properties.Capacity}</td></tr>'
				+ '<tr><td>Access:</td><td>{properties.Access}</tr>'
				+ '<tr><td>Type:</td><td>{properties.Bicycle_parking}</tr>'
				+ '<tr><td>Covered?:</td><td>{properties.Covered}</tr>'
				+ '</table>'
				+ '<p class="edit right"><a href="https://www.openstreetmap.org/edit?node={properties.nodeId}" target="_blank">Add/edit details</a></p>'
				+ '{%streetview}'
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
				+ '<p><a href="{properties.url}"><img src="/images/icons/bullet_go.png" /> <strong>View full details</a></strong></p>',
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
			tileLayer: {
				tiles: 'https://tile.cyclestreets.net/strava/ride/{%style}/{z}/{x}/{y}@2x.png',	// E.g. https://heatmap-external-c.strava.com/tiles/ride/blue/11/1026/674.png?v=19
				maxZoom: 11.999,
				attribution: 'Strava heatmap',
				tileSize: 512,
				label: 'Strava heatmap'
			}
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
				[0, 3]
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
				types: 'way',
				wayFields: 'name,ridingSurface,id,cyclableText,quietness,speedMph,speedKmph,pause,color'
			},
			sendZoom: true,
			popupHtml:
				  '<table>'
				+ '<tr><td>Name:</td><td><strong>{properties.name}</strong></td></tr>'
				+ '<tr><td>Type:</td><td>{properties.ridingSurface}</td></tr>'
				+ '<tr><td>Cyclable?:</td><td>{properties.cyclableText}</td></tr>'
				+ '<tr><td>Quietness:</td><td><strong>{properties.quietness}%</strong></td></tr>'
				+ '<tr><td>Speed (max achievable):</td><td><strong>{properties.speedMph} mph</strong><br />({properties.speedKmph} km/h)</td></tr>'
				+ '<tr><td>Pause:</td><td>{properties.pause}</td></tr>'
				+ '<tr><td>Full details:</td><td>OSM #<a href="https://www.openstreetmap.org/way/{properties.id}" target="_blank" title="[Link opens in a new window]">{properties.id}</a></td></tr>'
				+ '</table>'
				+ '<p>{%osmeditlink}</p>'
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
		},
		
		// https://www.cyclestreets.net/api/v2/isochrones.show/
		howfar: {
			apiCall: '/v2/isochrones.show',
			iconUrl: '/images/icons/destinations_good.svg',
			setMarker: 'lonlat',
			polygonStyle: 'blue'
		},
		
		// LTNs - modal filters
		modalfilters: {
			apiCall: '/v2/advocacydata.modalfilters',
			pointSize: 12,
			pointColourApiField: 'colour',
			zoomInitialMin: 10,
			name: 'Modal filters',
			description: 'Type of modal filter:',
			legend: [
				['bollard', '#888'],
				['gate', '#952'],
				['gap', '#444'],
				['cycleway filter', '#a6a'],
				['bus gate', '#f33']
			],
			locateFeedbackButton: 'Modal filter here?',
			popupFeedbackButton: 'Not a modal filter?',
			popupHtml:
				  '<h2>Modal filter</h2>'
				+ '<table>'
				+ '<tr><td>Location:</td><td><strong>{properties.name}</strong></tr>'
				+ '<tr><td>Type:</td><td><strong>{properties.modalfilter}</strong></td></tr>'
				+ '<tr><td>OSM data:</td><td><a href="https://www.openstreetmap.org/{properties.osmType}/{properties.osmId}" target="_blank">View in OSM</a></tr>'
				+ '</table>'
				+ '{%streetview}'
		},
		
		// LTNs - streets
		ltns: {
			apiCall: '/v2/advocacydata.ltns',
			sendZoom: true,
			lineColourApiField: 'colour',
			lineWidthField: 'ratrun',
			lineWidthValues: {
				'main': 5,
				'yes': 3,
				'calmed': 3,
				'no': 3
			},
			zoomInitialMin: 10,
			name: 'LTNs',
			description: 'LTNs/rat-runs - experimental data',
			legend: [
				['LTN', '#8bb'],
				['Traffic-calmed', '#966'],
				['Rat-runs', '#d44'],
				['Main roads', '#888']
			],
			streetview: true,
			popupHtml:
				  '<table>'
				+ '<tr><td>Location:</td><td><strong>{properties.name}</strong></tr>'
				+ '<tr><td>Through-traffic possible?</td><td><strong>{properties.ratrun}</strong></td></tr>'
				+ '<tr><td>Traffic-calming?</td><td><strong>{properties.traffic_calmed}</strong></td></tr>'
				+ '<tr><td>OSM data:</td><td><a href="https://www.openstreetmap.org/way/{properties.osmId}" target="_blank">View in OSM</a></tr>'
				+ '</table>'
				+ '{%streetview}'
		},
		
		// LTNs - statistics
		ltnstatistics: {
			apiCall: '/v2/advocacydata.ltnstatistics',
			sendZoom: true,	// Allows geometry simplification and reduced data
			lineColour: 'purple',
			fillOpacity: 0.7,
			polygonColourField: 'noThroughStreetLengthPercent',
			polygonColourStops: [
				[80, '#030a92'],
				[70, '#313695'],
				[65, '#4575b4'],
				[60, '#abd9e9'],
				[55, '#fee090'],
				[50, '#f46d43'],
				[30, '#d73027'],
				[0, 'red']
			],
			legend: [
				['≥80%', '#030a92'],
				['≥70%', '#313695'],
				['≥65%', '#4575b4'],
				['≥60%', '#abd9e9'],
				['≥55%', '#fee090'],
				['≥50%', '#f46d43'],
				['≥30%', '#d73027'],
				['≥0%', 'red']
			],
			popupHtml:
				  '<h3>Area statistics</h3>'
				+ '<table>'
				+ '<tr><td>Highway authority:</td><td><strong>{properties.name}</strong></tr>'
				+ '<tr><td>Area type:</td><td><strong>{properties.area_description}</strong></tr>'
				+ '<tr><td>Census code:</td><td><strong>{properties.census_code}</strong></tr>'
				+ '<tr><td>Streets:</td><td><strong><a href="{properties.dataUrl}">Download GIS data</a></strong></tr>'
				+ '</table>'
				+ '<h4>Percentage of streets by length:</h4>'
				+ '<table>'
				+ '<tr><td width="175">Not through-traffic (LTN):</td><td><strong>{properties.noThroughStreetLengthPercent}%</strong></tr>'
				+ '<tr><td>Through-traffic possible:</td><td><strong>{properties.throughStreetLengthPercent}%</strong></tr>'
				+ '<tr><td>Through-traffic but with traffic calming:</td><td><strong>{properties.calmedThroughStreetLengthPercent}%</strong></tr>'
				+ '<tr><td>Main roads (C &amp; above):</td><td><strong>{properties.mainRoadLengthPercent}%</strong></tr>'
				+ '</table>'
				+ '<h4>Total length in metres:</h4>'
				+ '<table>'
				+ '<tr><td width="175">Not through-traffic (LTN):</td><td><strong>{properties.noThroughStreetLengthMetres}m</strong></tr>'
				+ '<tr><td>Through-traffic possible:</td><td><strong>{properties.throughStreetLengthMetres}m</strong></tr>'
				+ '<tr><td>Through-traffic possible but with traffic calming:</td><td><strong>{properties.calmedThroughStreetLengthMetres}m</strong></tr>'
				+ '<tr><td>Main roads (C &amp; above):</td><td><strong>{properties.mainRoadLengthMetres}m</strong></tr>'
				+ '</table>'
		},
		
		// One-way streets without contraflows
		nocontraflows: {
			apiCall: '/v2/advocacydata.nocontraflows',
			sendZoom: true,
			lineColour: '#808',
			lineWidth: 5,
			streetview: true,
			popupHtml:
				  '<table>'
				+ '<tr><td>Name:</td><td><strong>{properties.name}</strong></tr>'
				+ '<tr><td>OSM data:</td><td><a href="https://www.openstreetmap.org/way/{properties.osmId}" target="_blank">View in OSM</a></tr>'
				+ '</table>'
				+ '{%streetview}'
		},
		
		// https://footways.london/map#digital
		footways: {
			apiCall: 'https://www.google.com/maps/d/kml?forcekml=1&mid=1djPyfTHyWyHfqVNNIqStpRbvXZ7yabk0',
			dataType: 'kml',
			bbox: false,
			style: {
				LineString: {
					'line-color': '#3e97a8',
					'line-width': 10
				},
				Point: {
					'circle-color': '#3e97a8',
					'circle-radius': 10
				}
			},
			popupHtml: '<p>{properties.name}</p>'
		},
		
		// https://www.cyclestreets.net/api/v2/infrastructure.locations/
		tflcid: {
			apiCall: '/v2/infrastructure.locations',
			apiFixedParameters: {
				dataset: 'tflcid',
				thumbnailsize: 400
			},
			iconSize: [24, 24],
			iconField: 'iconUrl',
			style: {
				LineString: {
					'line-color': 'red',
					'line-width': 3
				}
			},
			popupImagesField: 'images',
			popupLabels: {
				ss_road: 'Road marking',
				ss_patch: 'Coloured patch on surface',
				ss_facing: 'Facing off-side',
				ss_nocyc: 'No cycling',
				ss_noveh: 'No vehicles',
				ss_circ: 'Circular/Rectangular',
				ss_exempt: 'Exemption',
				ss_noleft: 'No left turn exception',
				ss_norigh: 'No right turn exception',
				ss_left: 'Compulsory turn left exception',
				ss_right: 'Compulsory turn right exception',
				ss_noexce: 'No straight ahead exception',
				ss_dismou: 'Cyclists dismount',
				ss_end: 'End of Route',
				ss_cycsmb: 'Cycle symbol',
				ss_pedsmb: 'Pedestrian symbol',
				ss_bussmb: 'Bus symbol',
				ss_smb: 'Other vehicle symbol',
				ss_lnsign: 'Line on sign',
				ss_arrow: 'Direction arrow',
				ss_nrcol: 'Road marking or Sign includes a number in a box',
				ss_ncn: 'National Cycle Network',
				ss_lcn: 'London Cycle Network',
				ss_superh: 'Cycle Superhighway',
				ss_quietw: 'Quietway',
				ss_greenw: 'Greenway',
				ss_routen: 'Route Number',
				ss_destn: 'Destination',
				ss_access: 'Access times',
				ss_name: 'TSRGD Sign number',
				ss_colour: 'Colour of Patch',
				sig_head: 'Cycle signal head',
				sig_separa: 'Separate stage for cyclists',
				sig_early: 'Early release',
				sig_twostg: 'Two stage turn',
				sig_gate: 'Cycle gate/Bus gate',
				trf_raised: 'Raised table',
				trf_entry: 'Raised side road entry treatment',
				trf_cushi: 'Speed cushions',
				trf_hump: 'Speed hump',
				trf_sinuso: 'Sinusoidal',
				trf_barier: 'Barrier',
				trf_narow: 'Carriageway narrowing',
				trf_calm: 'Other traffic calming',
				rst_steps: 'Steps',
				rst_lift: 'Lift',
				prk_carr: 'Carriageway',
				prk_cover: 'Covered',
				prk_secure: 'Secure',
				prk_locker: 'Locker',
				prk_sheff: 'Sheffield',
				prk_mstand: 'M stand',
				prk_pstand: 'P stand',
				prk_hoop: 'Cyclehoop',
				prk_post: 'Post',
				prk_buterf: 'Butterfly',
				prk_wheel: 'Wheel rack',
				prk_hangar: 'Bike hangar',
				prk_tier: 'Two tier',
				prk_other: 'Other / unknown',
				prk_provis: 'Provision',
				prk_cpt: 'Capacity',
				clt_carr: 'On / Off Carriageway',
				clt_segreg: 'Segregated lane / track',
				clt_stepp: 'Stepped lane / track',
				clt_parseg: 'Partially segregated lane / track',
				clt_shared: 'Shared lane or footway',
				clt_mandat: 'Mandatory cycle lane',
				clt_advis: 'Advisory cycle lane',
				clt_priori: 'Cycle lane/track priority',
				clt_contra: 'Contraflow lane/track',
				clt_bidire: 'Bi-directional',
				clt_cbypas: 'Cycle bypass',
				clt_bbypas: 'Continuous cycle facilities at bus stop',
				clt_parkr: 'Park route',
				clt_waterr: 'Waterside route',
				clt_ptime: 'Full-time / Part-time',
				clt_access: 'Access times',
				asl_fdr: 'Feeder lane',
				asl_fdrlft: 'Feeder lane on left',
				asl_fdcent: 'Feeder Lane in centre',
				asl_fdrigh: 'Feeder lane on right',
				asl_shared: 'Shared nearside lane',
				crs_signal: 'Signal controlled crossing',
				crs_segreg: 'Segregated cycles and pedestrians',
				crs_cygap: 'Cycle gap',
				crs_pedest: 'Pedestrian Only Crossing',
				crs_level: 'Level Crossing',
				res_pedest: 'Pedestrian only route',
				res_bridge: 'Pedestrian bridge',
				res_tunnel: 'Pedestrian tunnel',
				res_steps: 'Steps',
				res_lift: 'Lift',
				colour: 'Surface colour',
				road_name: 'Road name',
				osm_id: 'OSM way ID assignment',
				'_type': 'Asset type'
			},
			popupFormatters: {
				osm_id: function (value, feature) {return '<a href="https://www.openstreetmap.org/way/' + value + '" target="_blank">' + value + '</a>';}
			}
		},
		
		tflcid2osm: {
			apiCall: '/v2/advocacydata.tflcid2osm',
			iconUrl: '/images/icons/bicycles_good.svg',
			style: {
				LineString: {
					'line-color': 'purple',
					'line-width': 12
				}
			},
			popupImagesField: 'images',
			popupFormatters: {
				osm_id: function (value, feature) {
					return '<a href="https://www.openstreetmap.org/' + (feature.geometry.type == 'Point' ? 'node' : 'way') + '/' + value + '" target="_blank">' + value + '</a>';
				},
				osm_way_id: function (value, feature) {
					return '<a href="https://www.openstreetmap.org/way/' + value + '" target="_blank">' + value + '</a>';
				}
			}
		},
		
		// OpenStreetMap; see: https://wiki.openstreetmap.org/wiki/API_v0.6
		osm: {
			apiCall: 'https://www.openstreetmap.org/api/0.6/map',	// Will return XML; see: https://wiki.openstreetmap.org/wiki/API_v0.6#Retrieving_map_data_by_bounding_box:_GET_.2Fapi.2F0.6.2Fmap
			apiKey: false,
			bbox: true,
			dataType: 'xml',
			minZoom: 17,
			fullZoom: 17,
			fullZoomMessage: 'OSM data is only available from zoom 17 - please zoom in further.',
			style: {
				LineString: {
					'line-color': 'purple',
					'line-width': 3
				}
			},
			convertData: function (osmXml) {
				var geojson = osmtogeojson (osmXml);		// Requires osmtogeojson from https://github.com/tyrasd/osmtogeojson/
				geojson.features = geojson.features.filter (function (feature) { return (feature.geometry.type == 'LineString'); });	// See: https://stackoverflow.com/a/2722213
				return geojson;
			}
		},
		
		// Cycleways and paths
		cyclewayspaths: {
			apiCall: '/v2/advocacydata.cyclewayspaths',
			sendZoom: true,	// Allows geometry simplification and reduced data
			lineColour: 'orange',
			lineColourField: 'category',
			lineColourValues: {
			    'onroad':		'#ff338f',	// Pink
			    'cycleways':	'#8929ff',	// Purple
			    'unsegregated':	'#ba705a',	// Brown
			    'foot':		'#76ba5a'	// Green
			},
			lineWidthField: 'category',
			lineWidthValues: {
				'onroad':	4,
				'cycleways':	4,
				'unsegregated':	1.5,
				'foot':		1.5
			},
			legend: [
				['Roads with cycle infrastructure', '#ff338f'],
				['Cycleways', '#8929ff'],
			['General off-road paths', '#ba705a'],
				['General off road paths that are not cyclable', '#76ba5a']
			],
			fillOpacity: 0.7,
			popupHtml:
				  '<h3>Cycleways and paths</h3>'
				+ '<table>'
				+ '<tr><td>Way:</td><td><strong>{properties.name}</strong></tr>'
				+ '<tr><td>Category:</td><td><strong>{properties.category}</strong></tr>'
				+ '<tr><td>OSM data:</td><td><a href="https://www.openstreetmap.org/way/{properties.osmId}" target="_blank">View in OSM</a></tr>'
				+ '</table>'
				+ '{%streetview}'
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

			// Show these options if they are in the url
			if (window.location.href.indexOf("taxidata") > -1) {$("li.taxidata").show();}
			if (window.location.href.indexOf("cyclewayspaths") > -1) {$("li.cyclewayspaths").show();}
			
			// Run the layerviewer for these settings and layers
			layerviewer.initialise (_settings, _layerConfig);
			
			// Autocomplete
			bikedata.autocomplete ();
			
			// Layer-specific behaviour
			bikedata.tflCid ();
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
								};
							}));
						}
					});
				}
			});
		},
		
		
		// Layer-specific behaviour
		tflCid: function ()
		{
			// Provide drop-down filters based on feature type, firstly getting the schema from the server
			// #!# Filters in the URL are not persistent as this is not set early enough - need to move setFilters behaviour upstream
			$.ajax({
				url: _settings.apiBaseUrl + '/v2/infrastructure.schema?dataset=tflcid&key=' + _settings.apiKey,
				success: function (schema) {
					
					// Load description for type dropdown and filters
					var field = $("form #tflcid select[name='type']").val ();
					bikedata.setFilters (schema, field);
					$("form #tflcid select[name='type']").on ('change', function () {
						bikedata.setFilters (schema, this.value);
					});
				}
			});
		},
		
		
		// Helper function to set the field
		setFilters: function (schema, field)
		{
			// If no field selected (i.e. blank option), set HTML to be empty
			if (!field) {
				$('#featuretypedescription p').html ('All feature types are shown. Change the box above to filter to particular asset types.');
				$('#featuretypefilters').html ('');
				return;
			}
			
			// Set description for type dropdown
			$('#featuretypedescription p').html (schema[field].description);
			
			// Obtain the selected fields
			var fields = schema[field].fields;
			
			// Create HTML controls for each field
			var html = '<p>Filter to:</p>';
			$.each (fields, function (field, attributes) {
				var fieldname = 'field:' + field;
				
				// Parse out the form field
				var matches = attributes.datatype.match (/^([A-Z]+)\((.+)\)$/);
				var type = matches[1];
				var option = matches[2];
				var widgetHtml = '';
				var i;
				var enumMatches;
				var len;
				switch (type) {
					case 'VARCHAR':
						widgetHtml = '<input name="' + fieldname + '" type="text" maxlength=' + option + '" />';
						break;
					case 'INT':
						widgetHtml = '<input name="' + fieldname + '" type="number" maxlength=' + option + '" step="1" min="0" style="width: 4em;" />';
						break;
					case 'ENUM':
						enumMatches = option.match(/'[^']*'/g);		// https://stackoverflow.com/a/11227539/180733
						if (enumMatches) {
							len = enumMatches.length;
							for (i = 0; i < len; i++) {
								enumMatches[i] = enumMatches[i].replace(/'/g, '');
							}
						}
						widgetHtml  = '<select name="' + fieldname + '">';
						widgetHtml += '<option value="">';
						$.each (enumMatches, function (index, value) {
							widgetHtml += '<option value="' + value + '">' + value + '</option>';
						});
						widgetHtml += '</select>';
						break;
				}
				
				// Assemble the HTML
				html += '<hr />';
				html += '<p>' + layerviewer.htmlspecialchars (attributes.field) + ':</p>';
				html += '<p>' + widgetHtml + '</p>';
				html += '<p class="smaller">' + layerviewer.nl2br (layerviewer.htmlspecialchars (attributes.description)) + '</p>';
			});
			
			// Add reset link
			// #!# Doesn't currently force a form/URL rescan
			html = '<p class="smaller right"><a id="resetfilters" href="#">[Reset filters]</a></p>' + html;
			$(document).on ('click', '#resetfilters', function (e) {
				$.each (fields, function (field, attributes) {
					var fieldname = 'field:' + field;
					$('input[name="' + fieldname + '"], select[name="' + fieldname + '"]').val (function() {return this.defaultValue;} );	// https://stackoverflow.com/a/8668089/180733
				});
				e.preventDefault ();
			});
			
			// Show the HTML
			$('#featuretypefilters').html (html);
		}
	};
	
} (jQuery));

