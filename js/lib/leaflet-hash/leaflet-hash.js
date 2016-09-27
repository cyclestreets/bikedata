// Based on https://github.com/mlevans/leaflet-hash
// Tidied up using jslint
/*jslint browser: true, continue: true, unparam: true, sloppy: false, vars: true, white: true, plusplus: true, maxerr: 50, indent: 4 */
/*global L */
(function(window) {

    // This directive helps the Javascript interpreter detect programming errors
    'use strict';

    // Determine whether a hash change event is available
    var HAS_HASHCHANGE = (function () {
	// IE before version 7 did not have the event
	var doc_mode = window.documentMode;
	return ('onhashchange' in window) &&
	    (doc_mode === undefined || doc_mode > 7);
    }());

    L.Hash = function(map) {
	this.onHashChange = L.Util.bind(this.onHashChange, this);

	if (!map) {return;}
	this.init(map);
    };

    L.Hash.parseHash = function (hash) {

	// Declarations
	var args, zoom, lat, lon;

	// Filter out leading #
	if (hash.indexOf('#') === 0) {hash = hash.substr(1);}

	// Unpack the string
	args = hash.split("/");

	// Expect exactly three components
	if (args.length !== 3) {return false;}

	zoom = parseInt(args[0], 10);
	lat = parseFloat(args[1]);
	lon = parseFloat(args[2]);
	if (isNaN(zoom) || isNaN(lat) || isNaN(lon)) {return false;}

	// Result
	return {center: new L.LatLng(lat, lon), zoom: zoom};
    };

    L.Hash.formatHash = function (map) {

	// Useful bindings
	var center = map.getCenter(),
	zoom = map.getZoom(),

	// Greater precision at greater zoom level
	precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));

	// Result
	return "#" + [zoom,
		      center.lat.toFixed(precision),
		      center.lng.toFixed(precision)
		     ].join("/");
    };

    L.Hash.prototype = {
	map: null,
	lastHash: null,

	parseHash: L.Hash.parseHash,
	formatHash: L.Hash.formatHash,
	movingMap: false,

	init: function(map) {
	    this.map = map;

	    // Reset the hash
	    this.lastHash = null;
	    this.onHashChange();

	    if (!this.isListening) {
		this.startListening();
	    }
	},

	removeFrom: function(map) {
	    if (this.changeTimeout) {
		clearTimeout(this.changeTimeout);
	    }

	    if (this.isListening) {
		this.stopListening();
	    }

	    this.map = null;
	},

	onMapMove: function() {

	    // Bail if we're moving the map (updating from a hash), or if the map is not yet loaded
	    // !! Uses internal property of Leaflet _loaded
	    if (this.movingMap || !this.map._loaded) {
		return false;
	    }

	    var hash = this.formatHash(this.map);

	    // Abandon if no change
	    if (this.lastHash === hash) {return;}

	    // Set and update
	    location.replace(hash);
	    this.lastHash = hash;
	},

	update: function() {
			var hash = location.hash;
			if (hash === this.lastHash) {
				return;
			}
			var parsed = this.parseHash(hash);
			if (parsed) {
				this.movingMap = true;

				this.map.setView(parsed.center, parsed.zoom);

				this.movingMap = false;
			} else {
				this.onMapMove(this.map);
			}
		},

		// defer hash change updates every 100ms
		changeDefer: 100,
		changeTimeout: null,
		onHashChange: function() {
			// throttle calls to update() so that they only happen every
			// `changeDefer` ms
			if (!this.changeTimeout) {
				var that = this;
				this.changeTimeout = setTimeout(function() {
					that.update();
					that.changeTimeout = null;
				}, this.changeDefer);
			}
		},

		isListening: false,
		hashChangeInterval: null,
		startListening: function() {
			this.map.on("moveend", this.onMapMove, this);

			if (HAS_HASHCHANGE) {
				L.DomEvent.addListener(window, "hashchange", this.onHashChange);
			} else {
				clearInterval(this.hashChangeInterval);
				this.hashChangeInterval = setInterval(this.onHashChange, 50);
			}
			this.isListening = true;
		},

		stopListening: function() {
			this.map.off("moveend", this.onMapMove, this);

			if (HAS_HASHCHANGE) {
				L.DomEvent.removeListener(window, "hashchange", this.onHashChange);
			} else {
				clearInterval(this.hashChangeInterval);
			}
			this.isListening = false;
		}
	};
	L.hash = function(map) {
		return new L.Hash(map);
	};
	L.Map.prototype.addHash = function() {
		this._hash = L.hash(this);
	};
	L.Map.prototype.removeHash = function() {
		this._hash.removeFrom();
	};
}(window));
