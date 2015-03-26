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
		promise.PDB_data_broker_marker = Math.random();
		return promise;
	};
	Biojs.is_promise = function(maybe_promise) {
		try {
			if(maybe_promise.PDB_data_broker_marker != false) 
				return true;
		}
		catch(e) {}
		return false;
	};
}


Biojs.PDB = Biojs.extend ({
	opt: {}
 	,
	constructor: function (options) {
		var self = this;
		options = options ? options : Biojs.PDB_default_opts;
		if(!Biojs.PDB_instances[options.api_url])
			Biojs.PDB_instances[options.api_url] = this;
		else
			throw "Instantiating another PDB from same URL: " + options.api_url;
		self.options = options;
		self.entries = {};
		self.PDB_API_DATA = {};
	}
	,
	get_api_url: function() {
		var self = this; var opts = self.options;
		return opts.api_url;
	}
	,
	get_summary_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/pdb/entry/summary/" + pdbid;
	},
	make_pdb_entry: function(pdbid) {
		var self = this; var opts = self.options;
		if(self.entries[pdbid]) { // unique promise for an entry
			if(Biojs.is_promise(self.entries[pdbid]))
				return self.entries[pdbid];
			else
				return Biojs.marked_promise().resolve(self.entries[pdbid]).promise();
		}
		var promise = Biojs.marked_promise();
		var url = self.get_summary_url(pdbid);
		var ajax = self.multi_ajax({
			url: url,
			done: function() {
				promise.resolve(self.get_pdb_entry(pdbid));
			},
			fail: function() {
				promise.reject();
			}
		});
		self.entries[pdbid] = promise;
		return promise;
	}
	,
	get_pdb_entry: function(pdbid) {
		var self = this;
		if(!self.entries[pdbid]) {
			self.entries[pdbid] = new Biojs.PDB_Entry({'pdb':self, 'entry_id':pdbid});
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
				console.log("return previous promise", val);
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
			}
		};
		var promise = Biojs.marked_promise();
		console.log("make promise", promise);
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
	constructor: function (options) {
		var self = this;
		self.options = options;
		if(self.options.entry_id in self.options.pdb.entries)
			throw "Multiple entries with same PDB id!"
		var url = self.options.pdb.get_summary_url(self.options.entry_id);
		self.api_data = self.options.pdb.get_api_data(url)[self.options.entry_id][0];
	}
	,
	get_title: function() {
		var self = this;
		return self.api_data.title;
	}
});
