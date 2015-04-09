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
	Biojs.when_no_deferred_pending = function(deferreds) {
		// returns a promise that always resolves, never rejects
		var promise = Biojs.marked_promise();
		jQuery.each(deferreds, function(di,adef) {
			adef.always(function() {
				var pending = false;
				jQuery.each(deferreds, function(pi,pr) {
					if(pr.state() == "pending")
						pending = true;
				});
				if(!pending)
					promise.resolve();
			});
		});
		return promise;
	};
	Biojs.make_domain_instances = function(domtype, api_mappings, entity_id, struct_asym_id) {
		// this is a crucial function to define domain instances.. might need much fiddling
		var ret = [];
		if((!api_mappings) || !(api_mappings[domtype]))
			return ret;
		jQuery.each(api_mappings[domtype], function(domkey,dominfo) {
			var instance = {ranges:[]}; // make ranges first
			jQuery.each(dominfo.mappings, function(si,segment) {
				if(segment.entity_id != entity_id ||
					(struct_asym_id && struct_asym_id != segment.struct_asym_id))
					return;
				var seg = [segment.start.residue_number, segment.end.residue_number];
				var already = false;
				if(domtype in Biojs.sequence_domain_types) // uniqueify ranges
					for(var ai=0; ai < instance.ranges.length; ai++)
						if(seg[0] == instance.ranges[ai][0] && seg[1] == instance.ranges[ai][1]) {
							already = true;
							break;
						}
				if(!already)
					instance.ranges.push(seg);
			})
			// add more properties of domain instance here later
			ret.push(instance);
		});
		return ret;
	};
	Biojs.sequence_domain_types = {"Pfam":[], "UniProt":[]};
	Biojs.structure_domain_types = {"SCOP":[], "CATH":[]};
};

// A URL must be fetched only once - so call-based registry that stores json or promise
// A call should be tried thrice before failing
// An object should be created only once
// Data types should be standardized for better interoperability
// Client code should not be required to contain URL construction at all
// make_X methods must return promise - a trivial resolved promise if PDB object is available
// get_X methods must return PDB objects. get_X may internally erase fetched jsons
// promise from make_X need not always resolve to a useful return value
// Entry has entity(-ies) has entity_instance(s) has residue(s)
// A modelled instance or residue has model_id+altcode
// All sequence ranges are returned in terms of mmcif-res-num
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
	get_ligand_monomers_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/pdb/entry/ligand_monomers/" + pdbid;
	}
	,
	get_polymer_coverage_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/pdb/entry/polymer_coverage/" + pdbid;
	}
	,
	get_entities_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/pdb/entry/entities/" + pdbid;
	}
	,
	get_mappings_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/mappings/" + pdbid;
	}
	,
	get_residue_listing_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/pdb/entry/residue_listing/" + pdbid;
	}
	,
	get_sec_str_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/pdb/entry/secondary_structure/" + pdbid;
	}
	,
	get_binding_sites_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/pdb/entry/binding_sites/" + pdbid;
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
		// dependence: make_pdb_entry
		var self = this;
		if(Biojs.undefined_or_promise(self.entries[pdbid])) {
			console.log("Adding new entry", pdbid);
			delete self.entries[pdbid];
			self.entries[pdbid] = new Biojs.PDB_Entry({'pdb':self, 'pdbid':pdbid});
		}
		return self.entries[pdbid];
	}
	,
	multi_ajax: function(args) {
		var self = this;
		var promise = Biojs.marked_promise();
		var done_function = function() {
			if(args.done) args.done();
			promise.resolve();
		};
		var fail_function = function() {
			if(args.fail) args.fail();
			promise.reject();
		};
		if(args.url in self.PDB_API_DATA) {
			var val = self.PDB_API_DATA[args.url];
			var trivial_resolved_promise = function() {
				return Biojs.marked_promise().resolve().promise();
			};
			var trivial_rejected_promise = function() {
				return Biojs.marked_promise().reject().promise();
			};
			if(val == "failed") {
				fail_function();
				return trivial_rejected_promise();
			}
			else if(Biojs.is_promise(val)) {
				console.log("Return previous promise", val);
				return val;
			}
			else if(val == "consumed" || val instanceof Object) {
				done_function();
				return trivial_resolved_promise();
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
		self.PDB_API_DATA[args.url] = promise; // unique promise for a URL
		console.log("Fetching(1) ", args.url);
		jQuery.ajax(ajax_info) // 1st attempt
		.done(done_function)
		.fail(function() {
			console.log("Fetching(2) ", args.url);
			jQuery.ajax(ajax_info) // 2nd attempt
			.done(done_function)
			.fail(function() {
				console.log("Fetching(3) ", args.url);
				jQuery.ajax(ajax_info) // 3rd attempt
				.done(done_function)
				.fail(function() { // reject only after 3 attempts
					self.PDB_API_DATA[args.url] = "failed";
					fail_function();
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
		// dependence: make_entities
		var self = this;
		var pdb = self.options.pdb;
		var api_data = pdb.get_api_data(pdb.get_entities_url(self.pdbid))[self.pdbid];
		if(Biojs.undefined_or_promise(self.entities)) {
			self.entities = {};
			jQuery.each(api_data, function(ei, ed) {
				var eid = ed.entity_id;
				console.log("Adding new entity", self.pdbid, eid);
				self.entities[eid] = new Biojs.PDB_Entity({pdb:pdb,
					pdbid:self.pdbid, entity_id:eid});
			});
		}
		return self.entities;
	}
	,
	get_entity: function(eid) {
		var self = this;
		return self.entities[eid];
	}
});


Biojs.PDB_Entity = Biojs.extend ({
	opt:{}
	,
	constructor: function(options) {
		var self = this;
		self.options = options;
		self.pdbid = self.options.pdbid;
		self.pdb = self.options.pdb;
		self.entity_id = self.options.entity_id;
		self.grab_api_data();
	}
	,
	grab_api_data: function() {
		var self = this;
		self.api_data = self.pdb.get_api_data(self.pdb.get_entities_url(self.pdbid))[self.pdbid];
		jQuery.each(self.api_data, function(ei,ed) {
			if(ed.entity_id == self.entity_id) {
				self.api_data = ed;
				return false;
			}
		});
		if(self.api_data.entity_id != self.entity_id)
			throw "PDB "+self.pdbid+" Entity "+self.entity_id+" has no data!";
	}
	,
	is_protein: function() {
		var self = this;
		return (self.api_data.molecule_type == 'polypeptide(L)');
	}
	,
	is_protein_DNA_RNA: function() {
		var self = this;
		return (self.api_data.molecule_type == 'polypeptide(L)' 
		|| self.api_data.molecule_type == 'polyribonucleotide'
		|| self.api_data.molecule_type == 'polydeoxyribonucleotide');
	}
	,
	throw_if_not_protein_DNA_RNA: function() {
		var self = this;
		if(!self.is_protein_DNA_RNA())
			console.warn("Method might be unsuitable for this entity "+self.entity_id+" - not protein, RNA, DNA");
	}
	,
	get_instances: function() {
		// dependence: make_instances
		var self = this;
		if(Biojs.undefined_or_promise(self.instances)) {
			self.instances = [];
			jQuery.each(self.api_data.in_struct_asyms, function(si, sid) {
				self.instances.push(new Biojs.PDB_Entity_Instance({
					pdb:self.pdb, pdbid:self.pdbid, entity_id:self.entity_id,
					struct_asym_id:sid, auth_asym_id:self.api_data.in_chains[si]
				}));
			});
		}
		return self.instances;
	}
	,
	make_instances: function() {
		// possible bug here due to 404 return on no-ligand entries
		var self = this;
		if(self.instances)
			return Biojs.promise_or_resolved_promise(self.instances);
		var promise = Biojs.marked_promise();
		var composite_promise = Biojs.when_no_deferred_pending([
			self.pdb.multi_ajax({url:self.pdb.get_polymer_coverage_url(self.pdbid)}),
			self.pdb.multi_ajax({url:self.pdb.get_ligand_monomers_url(self.pdbid)})
		])
		.done(function() {
			promise.resolve(self.get_instances());
		});
		self.instances = promise;
		return promise;
	}
	,
	make_sequence_mappings: function() {
		var self = this;
		if(self.seq_mappings)
			return Biojs.promise_or_resolved_promise(self.seq_mappings);
		var promise = Biojs.marked_promise();
		var ajax = self.pdb.multi_ajax({
			url: self.pdb.get_mappings_url(self.pdbid),
			done: function() { promise.resolve(self.get_sequence_mappings("Pfam")); },
			fail: function() { promise.reject(); }
		});
		self.seq_mappings = promise;
		return promise;
	}
	,
	get_sequence_mappings: function(domtype) {
		// dependence: make_sequence_mappings
		var self = this;
		if(Biojs.undefined_or_promise(self.seq_mappings)) {
			console.log("Adding seq_mappings", self.pdbid, self.entity_id);
			self.seq_mappings = self.pdb.get_api_data(self.pdb.get_mappings_url(self.pdbid))[self.pdbid];
			var mappings = {};
			for(var dt in Biojs.sequence_domain_types) {
				mappings[dt] = Biojs.make_domain_instances(dt, self.seq_mappings, self.entity_id)
			}
			self.seq_mappings = mappings;
		}
		return self.seq_mappings[domtype];
	}
});


Biojs.PDB_Entity_Instance = Biojs.extend ({
	opt:{}
	,
	constructor: function(options) {
		var self = this;
		self.options = options;
		self.pdbid = self.options.pdbid;
		self.pdb = self.options.pdb;
		self.entity_id = self.options.entity_id;
		self.struct_asym_id = self.options.struct_asym_id;
		self.auth_asym_id = self.options.auth_asym_id;
		console.warn("PDB_Entity_Instance ctor needs to use polymer_coverage and ligand_monomers data");
	}
	,
	make_sequence_mappings: function() {
		// dependence on entity's make_sequence_mappings
		var self = this;
		if(self.seq_mappings)
			return Biojs.promise_or_resolved_promise(self.seq_mappings);
		self.seq_mappings = self.pdb.get_pdb_entry(self.pdbid).get_entity(self.entity_id).make_sequence_mappings();
		return self.seq_mappings;
	}
	,
	get_sequence_mappings: function(domtype) {
		// dependence: make_sequence_mappings
		var self = this;
		if(Biojs.undefined_or_promise(self.seq_mappings)) {
			console.log("Adding seq_mappings", self.pdbid, self.entity_id, self.struct_asym_id);
			self.seq_mappings = self.pdb.get_api_data(self.pdb.get_mappings_url(self.pdbid))[self.pdbid];
			var mappings = [];
			for(var dt in Biojs.structure_domain_types) {
				mappings[dt] = Biojs.make_domain_instances(dt, self.seq_mappings, self.entity_id)
			}
			self.seq_mappings = mappings;
		}
		return self.seq_mappings[domtype];
	}
	,
	make_structural_features: function() {
		var self = this; var opts = self.options;
		if(self.structural_features)
			return Biojs.promise_or_resolved_promise(self.structural_features);
		var promise = Biojs.marked_promise();
		Biojs.when_no_deferred_pending([
			self.pdb.multi_ajax({url: self.pdb.get_binding_sites_url(self.pdbid)}),
			self.pdb.multi_ajax({url: self.pdb.get_sec_str_url(self.pdbid)}),
			self.pdb.multi_ajax({url: self.pdb.get_residue_listing_url(self.pdbid, self.auth_asym_id)})
		])
		.done(function() {
			promise.resolve(self.get_binding_sites());
		});
		self.structural_features = promise;
		return promise;
	}
	,
	get_binding_sites: function() {
		// dependence: make_structural_features
		var self = this;
		if(Biojs.undefined_or_promise(self.structural_features)) {
			console.log("Adding structural features", self.pdbid, self.entity_id, self.struct_asym_id);
			self.structural_features = true;
			// binding sites
			var sites = [], apidata = self.pdb.get_api_data(self.pdb.get_binding_sites_url(self.pdbid))[self.pdbid];
			jQuery.each(apidata, function(bi,bd) {
				var bound_resnums = [];
				jQuery.each(bd.site_residues, function(ri,res) {
					if(res.entity_id == self.entity_id && res.structural_features == self.struct_asym_id)
						bound_resnums.push(res.residue_number);
				});
				if(bound_resnums.length > 0)
					sites.push({residue_numbers:bound_resnums}); // can add more detail here later
			});
			self.binding_sites = sites;
			// secondary structure
			var secstr = {}, apidata = self.pdb.get_api_data(self.pdb.get_sec_str_url(self.pdbid))[self.pdbid];
			jQuery.each(apidata.molecules, function(mi,md) {
				if(md.entity_id != self.entity_id)
					return;
				jQuery.each(md.chains, function(ci,cd) {
					if(cd.struct_asym_id != self.struct_asym_id)
						return;
					secstr = cd.secondary_structure;
				});
			});
			console.log(secstr);
			self.secondary_structure = secstr;
			// residue listing
		}
		return self.binding_sites;
	}
});
