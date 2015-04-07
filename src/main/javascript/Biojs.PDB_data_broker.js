if(!Biojs.PDB_instances) {
	Biojs.PDB_instances = {};
	Biojs.PDB_default_opts = {'api_url':"http://www.ebi.ac.uk/pdbe/api"};
	Biojs.get_PDB_instance = function(opts) {
		opts = opts ? opts : Biojs.PDB_default_opts;
		if(! Biojs.PDB_instances[opts.api_url]) {
			Biojs.PDB_instances[opts.api_url] = new Biojs.PDB(opts)
		}
		return Biojs.PDB_instances[opts.api_url];
	};
	Biojs.marked_promise = function() {
		var promise = new jQuery.Deferred();
		promise.PDB_data_broker_marker = "marker_" + Math.random();
		return promise;
	};
	Biojs.is_promise = function(maybe_promise) {
		try {
			if(maybe_promise.PDB_data_broker_marker.slice(0,7) == "marker_") 
				return true;
		}
		catch(e) {}
		return false;
	};
	Biojs.promise_or_resolved_promise = function(obj) {
		if(Biojs.is_promise(obj))
			return obj;
		else
			return Biojs.marked_promise().resolve(obj).promise();
	};
	Biojs.undefined_or_promise = function(obj) {
		return ((!obj) || Biojs.is_promise(obj));
	};
}

// A URL must be fetched only once - so call-based registry that stores json or promise
// A call should be tried thrice before failing
// An object should be created only once
// Data types should be standardized for better interoperability
// Client code should not contain URL construction at all
// make_X methods must return promise - a trivial resolved promise if PDB object is available
// get_X methods must return PDB objects. get_X may internally erase fetched jsons
// promise from make_X need not always resolve to a useful return value
Biojs.PDB = Biojs.extend ({
	opt: {}
 	,
	constructor: function(options) {
		var self = this;
		options = options ? options : Biojs.PDB_default_opts;
		if(!Biojs.PDB_instances[options.api_url])
			Biojs.PDB_instances[options.api_url] = this;
		else
			throw "Instantiating another PDB from same URL: " + options.api_url;
		self.options = options;
		self.entries = {};
		self.PDB_API_DATA = {};
		console.log("Created PDB data broker for", options.api_url);
	}
	,
	get_api_url: function() {
		var self = this; var opts = self.options;
		return opts.api_url;
	}
	,
	get_entities_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/pdb/entry/entities/" + pdbid;
	}
	,
	get_summary_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/pdb/entry/summary/" + pdbid;
	}
	,
	make_pdb_entry: function(pdbid) {
		var self = this; var opts = self.options;
		if(self.entries[pdbid]) // unique promise for an entry
			return Biojs.promise_or_resolved_promise(self.entries[pdbid]);
		var promise = Biojs.marked_promise();
		var ajax = self.multi_ajax({
			url: self.get_summary_url(pdbid),
			done: function() { promise.resolve(self.get_pdb_entry(pdbid)); },
			fail: function() { promise.reject(); }
		});
		self.entries[pdbid] = promise;
		return promise;
	}
	,
	get_pdb_entry: function(pdbid) {
		var self = this;
		if(Biojs.undefined_or_promise(self.entries[pdbid])) {
		//if((!self.entries[pdbid]) || Biojs.is_promise(self.entries[pdbid])) {
			console.log("Adding new entry", pdbid);
			delete self.entries[pdbid];
			self.entries[pdbid] = new Biojs.PDB_Entry({'pdb':self, 'pdbid':pdbid});
		}
		return self.entries[pdbid];
	}
	,
	multi_ajax: function(args) {
		var self = this;
		if(args.url in self.PDB_API_DATA) {
			var val = self.PDB_API_DATA[args.url];
			var trivial_resolved_promise = function() {
				return Biojs.marked_promise().resolve().promise();
			};
			var trivial_rejected_promise = function() {
				return Biojs.marked_promise().reject().promise();
			};
			if(val == "failed") {
				args.fail(); return trivial_rejected_promise();
			}
			else if(Biojs.is_promise(val)) {
				console.log("Return previous promise", val);
				return val;
			}
			else if(val == "consumed" || val instanceof Object) {
				args.done(); return trivial_resolved_promise();
			}
			else
				throw "Unexpected state of PDB_API_DATA for " + args.url + ":" + val;
		}
		var ajax_info = {
			url: args.url, dataType: 'json',
			crossDomain: 'true', type: 'GET',
			success: function(data) {
				self.PDB_API_DATA[args.url] = data;
				console.log("Fetched", args.url, data);
			}
		};
		var promise = Biojs.marked_promise();
		self.PDB_API_DATA[args.url] = promise; // unique promise for a URL
		console.log("Fetching(1) ", args.url);
		jQuery.ajax(ajax_info) // 1st attempt
		.done(args.done)
		.fail(function() {
			console.log("Fetching(2) ", args.url);
			jQuery.ajax(ajax_info) // 2nd attempt
			.done(args.done)
			.fail(function() {
				console.log("Fetching(3) ", args.url);
				jQuery.ajax(ajax_info) // 3rd attempt
				.done(args.done)
				.fail(function() { // reject only after 3 attempts
					self.PDB_API_DATA[args.url] = "failed";
					args.fail();
				})
			});

		});
		return promise;
	}
	,
	get_api_data: function(url) {
		var self = this;
		return self.PDB_API_DATA[url];
	}
});


Biojs.PDB_Entry = Biojs.extend ({
	opt: {}
	,
	constructor: function(options) {
		var self = this;
		self.options = options;
		self.pdbid = self.options.pdbid;
		if(self.pdbid in self.options.pdb.entries)
			throw "Multiple entries with same PDB id!"
		var url = self.options.pdb.get_summary_url(self.pdbid);
		self.api_data = self.options.pdb.get_api_data(url)[self.pdbid][0];
	}
	,
	get_title: function() {
		var self = this;
		return self.api_data.title;
	}
	,
	make_entities: function() {
		var self = this;
		if(self.entities)
			return Biojs.promise_or_resolved_promise(self.entities);
		var promise = Biojs.marked_promise();
		var ajax = self.options.pdb.multi_ajax({
			url: self.options.pdb.get_entities_url(self.pdbid),
			done: function() { promise.resolve(self.get_entities()); },
			fail: function() { promise.reject(); }
		});
		self.entities = promise;
		return promise;
	}
	,
	get_entities: function() {
		var self = this;
		var pdb = self.options.pdb;
		var api_data = pdb.get_api_data(pdb.get_entities_url(self.pdbid))[self.pdbid];
		if(Biojs.undefined_or_promise(self.entities)) {
			self.entities = {};
			console.log("Adding entities to entry", self.pdbid);
			jQuery.each(api_data, function(ei, ed) {
				var eid = ed.entity_id;
				self.entities[eid] = new Biojs.PDB_Entity({pdb:pdb,
					pdbid:self.pdbid, entity_id:eid});
			});
		}
		return self.entities;
	}
});


Biojs.PDB_Entity = Biojs.extend ({
	opt:{}
	,
	constructor: function(options) {

	}
});
