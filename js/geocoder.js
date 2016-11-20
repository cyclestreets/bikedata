/** Attaches autocomplete functionality to the input element
 * Options is an object with these properties:
 * source is either a static list of data, or function that returns a list (e.g. via ajax) of results. Each result should have at least these properties: label, value, desc
 * select is a callback that takes a filtered result as arg, and can be run for side effects such as setting a marker on a map
 * renderItem is a callback for rendering the menu items, it takes as arguments the menu element and item and should return a rendered list item.
*  Items are rendered by default with the label on a first line, and a smaller font description on the second.
*
* Where possible this file should not assume that cyclestreetsNS has been loaded.
*/
/*jslint browser: true, devel: true, passfail: false, continue: true, eqeq: true, forin: true, nomen: true, plusplus: true, regexp: true, unparam: true, vars: true, white: true */
/*global jQuery, cyclestreetsNS, map, L */

var autocomplete = (function ($) {
    'use strict';

    return {

// Public methods

	addTo: function (inputElement, options) {

	    var element = $(inputElement);

	    // Default options
	    if (options === undefined) {options = {};}

	    // Default options to the source url
	    if (typeof options === "string") {options = {sourceUrl: options};}

	    // Default to geocoder function
	    if (options.source === undefined) {
		options.source = function (request, response) {autocomplete.geocoderAjax (element, options.sourceUrl, request, response);};
	    }

	    // If there is a map on the page then default to centering on the selection
	    if (options.select === undefined) {

		// Select callback - centres map on selection
		options.select = autocomplete.centreMap;
	    }

	    // Default function for rendering the menu
	    if (options.renderItem === undefined) {

		// Default render over two lines, second line smaller font size
		options.renderItem = function( ul, item ) {
		    return $( "<li>" )
			.append( "<a>" + item.label + "<br /><span>" + item.desc + "</span></a>" )
			.appendTo( ul );
		};
	    }

	    // Control caching of results
	    if (options.cacheResults !== undefined) {

		// Create the cache or turn off caching
		element.data('autocompleteCache', options.cacheResults ? {} : false);
	    }

	    // Run on document ready
	    $(function () {
			
			// Disable enter key when focus is on input element itself (i.e. not on a drop-down value)
			$(inputElement).keypress(function(e) {
				var code = e.keyCode || e.which;
				if (code === 13) {return false;}
			});
			
 		// Add the autocomplete to the element
		$(inputElement).autocomplete({
		    appendTo: '#cyclestreets-content',	// Ensures this is within the CSS scopes defined by the application, rather than being attached to the surrounding GUI's body which may have different CSS
		    source: options.source,
		    minLength: 3,
		    focus: function (event, ui) {

			// This is called when the focussed menu item changes, show the label (rather than the value) in the input element
			$(inputElement).val(ui.item.label);

 			// Prevent the widget from inserting the value.
			return false;
		    },
		    select: function (event, ui) {

			// Apply any select callback
			if (options.select !== undefined) {return options.select (event, ui);}

			// Set the value to the label
			$(inputElement).val(ui.item.label);
			
 			// Prevent the widget from inserting the value.
			return false;
		    }
		}).data("ui-autocomplete")._renderItem = options.renderItem;
	    });
	},


	// Centres map on lon lat in the autocomplete result
	centreMap: function (event, ui) {

	    // Declarations
	    var result = ui.item;
		
	    // Abandon if no map
	    if (cyclestreetsNS === undefined || cyclestreetsNS.map === undefined) {return;}
		
		// Zoom to fit the bounds of the polygon
		var geojsonItemLayer = L.geoJson(ui.item.feature);
		cyclestreetsNS.map.fitBounds(geojsonItemLayer.getBounds());
		
		// Zoom out if now too close
		if (cyclestreetsNS.map.getZoom() > 17) {
			cyclestreetsNS.map.setZoom(17);
		}
	},


// Private methods

	// Function used to retrieve results from a Nominatim server
	geocoderAjax: function (element, url, request, response) {

	    // The url should already include the api key, this object collates additional query string arguments for the CycleStreets geocoder api call
	    // http://www.cyclestreets.net/api/v2/geocoder/
	    var urlParams = {
			q: request.term, // I.e. the search string
			limit: 12	// Ideally this and perhaps other parameters that are sent to the geocoder could be settings
	    },

	    // Useful var to help determine any bounding box for the geocoding search
	    bounds,

	    // Bind the term for use in caching
	    term = request.term,

	    // Does the search term include a comma, which can be used in searches to specify particular places, such as other countries
	    containsComma = /,/.test(term),

	    // Cache is stored with the element
	    cache = element.data('autocompleteCache'),

	    // Flag to detect if the term has been found in the cache
            foundInCache = false;

	    // When caching is enabled for this element
	    if (cache) {

		// Scan the cache for data matching the term
		$.each(cache, function (key, data) {

		    // Skip if no match
		    if (term !== key) {return true;}

		    // Apply the response callback
		    response(data);

		    // Flag found
		    foundInCache = true;

		    // End the search
		    return false;
		});
	    }

	    // End if the result has been found in the cache
	    if (foundInCache) return;

	    // Get any preferred bounds - they are packed as W,S,E,N
	    if (window.cyclestreetsNS !== undefined && cyclestreetsNS.getPreferedNameSearchBoundingBox()) {
	
			// Set as bbox WSEN
			urlParams.bbox = cyclestreetsNS.getPreferedNameSearchBoundingBox();
	    }

	    // If there is a map on the page then assume it will provide bounds
	    else if ($("#map")) {
	
			// Callback that returns a csv: <left>,<top>,<right>,<bottom>
			urlParams.bbox = autocomplete.mapBoundsCallBack();
	    }

	    // Country codes (commas present in search string skip the country restriction)
	    if (!containsComma && window.cyclestreetsNS !== undefined && cyclestreetsNS.getGeocodingCountryCodes()) {urlParams.countrycodes = cyclestreetsNS.getGeocodingCountryCodes();}

	    // Bounded
	    if (window.cyclestreetsNS !== undefined && cyclestreetsNS.getBoundedSearch()) {urlParams.bounded = cyclestreetsNS.getBoundedSearch();}

	    $.ajax({
		url: url,

		// The next two options configure jQuery to parse the jsonp returned by call
		dataType: (window.cyclestreetsNS !== undefined && cyclestreetsNS.getUseJsonpTransport() ? 'jsonp' : 'json'),
		// Nominatim supports the value of this parameter which wraps json output in a callback function.
		// The callback function name is generated by jQuery, and parses the json.
		jsonp: (window.cyclestreetsNS !== undefined && cyclestreetsNS.getUseJsonpTransport() ? 'callback' :  null),

		data: urlParams,

		// Provides a useful chance to show the api request url
		beforeSend: function (jqXHR, settings) {

		    // Skip cyclestreetsNS not present
		    if (window.cyclestreetsNS === undefined) {return;}

		    // Show the requested url
		    cyclestreetsNS.debugtagmsg(settings.url);
		},

		// On success run returned data through a filter
		success: function (data, textStatus, jqXHR) {

		    // Declarations
		    var results = [];

		    // No data
		    if (!data) {

			// No results
			results = [];

		    } else if (data.error) {

			// By using these values the user can see that an error has occurred
			results = [{
			    value: false,
			    label: 'A geocoding error occurred',
			    desc: data.error}];

		    } else if (!data.features) {

			// No results
			results = [];

		    } else {

			// Render each feature
			results = $.map(data.features, autocomplete.renderGeocoderResult);
		    }

		    // Cache the results in the element
		    if (cache) {
			cache[term] = results;
			element.data('autocompleteCache', cache);
		    }

		    // Apply the response callback
		    response (results);
		},

		// Autocomplete needs to call response() even when an error occurs to avoid falling into an invalid state.
		error: function (jqXHR, textStatus, errorThrown) {

		    // By using these values the user can see that an error has occurred
		    response ([{
			value: errorThrown,
			label: "An error occurred: " + textStatus,
			desc: "Error type: " + errorThrown}]);
		},

		// Handle some http error codes
		statusCode: {
		    404: function () {
			alert( "The name lookup service cannot be found" );
		    }
		}
	    });
	},


	// Bounds callback - retrieves current bbox of map
	mapBoundsCallBack: function () {

	    // Declarations
	    var bounds;

	    // Abandon if no map
	    if (window.cyclestreetsNS === undefined || cyclestreetsNS.map === undefined) {return;}

	    // Visible bounds of the map
	    bounds = cyclestreetsNS.map.getBounds();

	    // Expand the bounds to be as least as big as a city
	    bounds = this.atLeastAsBigAsACity (bounds);
		
		// Return WSEN
		return bounds.toBBoxString();
	},
	
	
	// Expand the bounds to be as least as big as a city
	atLeastAsBigAsACity: function (bounds)
	{
	    // Declarations
	    var centre = bounds.getCenter(),

	    // City size in degrees NS, 1 degree = 100km, so 0.1 degree = 10km.
	    sizeNSdegrees = 0.25,

	    // Accommodate the forshortening of longitude
	    sizeEWdegrees = sizeNSdegrees / Math.cos(centre.lat * Math.PI / 180);

	    // Extend the bounds to the NW
	    bounds = bounds.extend (L.latLng(centre.lat + sizeNSdegrees, centre.lng - sizeEWdegrees));

	    // Extend the bounds to the SE
	    bounds = bounds.extend (L.latLng(centre.lat - sizeNSdegrees, centre.lng + sizeEWdegrees));

	    // Result
	    return bounds;
	},

	// Used to process each result from the geocoder
	renderGeocoderResult: function (item)
	{
	    // Form result object
	    var result = {
			value: item.properties.name + ', ' + item.properties.near,	// Feeding it back into the query seems to be the best way of getting a repeatable result.
			label: item.properties.name,
			desc: item.properties.near,
			lat: item.geometry.coordinates[1],
			lon: item.geometry.coordinates[0],
			feature: item
	    };
		
	    // Result
	    return result;
	}
    };
}(jQuery));

