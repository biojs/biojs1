clog = console.log.bind(console);

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
	Biojs.mark_promise = function(promise) {
		promise.PDB_data_broker_marker = Biojs.get_random_string("marker");
		return promise;
	};
	Biojs.marked_promise = function() {
		var promise = new jQuery.Deferred();
		return Biojs.mark_promise(promise);
	};
	Biojs.is_promise = function(maybe_promise) {
		try {
			if(maybe_promise.PDB_data_broker_marker.slice(0,7) == "marker_") 
				return true;
		}
		catch(e) {}
		return false;
	};
	Biojs.delayed_promise = function(num_millisec, state) {
		var prom = Biojs.marked_promise();
		setTimeout(function() {
			if(state == "resolved")
				prom.resolve();
			else if(state == "rejected")
				prom.reject();
			else
				throw "Can't understand promise state!!"
		}, num_millisec);
		return prom;
	};
	Biojs.trivial_resolved_promise = function() {
		var ret = Biojs.marked_promise();
		ret.resolve();
		return ret;
	};
	Biojs.trivial_rejected_promise = function() {
		var ret = Biojs.marked_promise()
		ret.reject();
		return ret;
	};
	Biojs.get_random_string = function(prefix) {
		return prefix + "_" + Math.random().toString().replace(/^0./,"");
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
		// promise resolves when all deferreds have failed or succeeded
		if(deferreds.length == 0)
			return Biojs.trivial_resolved_promise();
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
	Biojs.get_biojs_URL = function() {
		var url = null;
		jQuery.each(jQuery('script'), function(ei,elem) {
			if(elem.src.match(/Biojs.js$/)) {
				url = elem.src;
				return false;
			}
		});
		return url;
	};
	Biojs.get_template = function(template_id) {
		if(!Biojs.templates_fetched) {
			var templates_url = Biojs.get_biojs_URL().replace(/Biojs.js$/, "../../main/resources/data/PDB_Sequence_Layout_Maker_templates.html");
			jQuery.ajax({
				url:templates_url,
				crossDomain: 'true', type: 'GET',
				async:false,
				success:function(data) {
					var hidden_divid = 'pdb_sequence_layout_maker_template';
					jQuery('body').append("<div id='"+hidden_divid+"' style='display:none;'>"+data+"</div>")
					console.log("Templates loaded.", jQuery("#"+hidden_divid));
				}
			});
			Biojs.templates_fetched = true;
		}
		return Handlebars.compile(jQuery("#"+template_id).html(), {noEscape:true,strict:true});
	};
	Biojs.publication_key = function(apub) {
		if(apub.pubmed_id)
			pkey = apub.pubmed_id;
		else if(apub.doi)
			pkey = apub.doi;
		else
			pkey = apub.title;
		if(!pkey)
			pkey = Math.random();
		return pkey;
	};
	Biojs.string_or_func_eval = function(markup) {
		if(!markup)
			return "";
		else if(typeof(markup) == typeof("astring"))
			return markup;
		else
			return markup();
	};
	Biojs.eval_if_function = function(some) {
		if(jQuery.isFunction(some))
			return some();
		else
			return some;
	};
	Biojs.sequence_domain_types = {"Pfam":[], "UniProt":[]};
	Biojs.structure_domain_types = {"SCOP":[], "CATH":[]};
	Biojs.layout_params = {"MIN_ROW_HEIGHT":20};
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
// A modelled entity instance has model_id. A modelled residue has altcode too. Can have symop too.
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
	get_publications_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/pdb/entry/citations/" + pdbid;
	}
	,
	get_related_publications_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/pdb/entry/related_publications/" + pdbid;
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
	get_validation_url: function(pdbid) {
		var self = this;
		return self.options.api_url + "/validation/residuewise_outlier_summary/entry/" + pdbid;
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
			if(val == "failed") {
				fail_function();
				return Biojs.trivial_rejected_promise();
			}
			else if(Biojs.is_promise(val)) {
				console.log("Return previous promise", val);
				return val;
			}
			else if(val == "consumed" || val instanceof Object) {
				done_function();
				return Biojs.trivial_resolved_promise();
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
	make_publications: function() {
		var self = this;
		if(self.publications)
			return Biojs.promise_or_resolved_promise(self.publications);
		var promise = Biojs.marked_promise();
		var composite_promise = Biojs.when_no_deferred_pending([
			self.options.pdb.multi_ajax({url: self.options.pdb.get_publications_url(self.pdbid)}),
			self.options.pdb.multi_ajax({url: self.options.pdb.get_related_publications_url(self.pdbid)})
		])
		.done(function() {
			promise.resolve(self.get_publications());
		});
		self.publications = promise;
		return promise;
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
	,
	get_release_year: function() {
		var self = this;
		return parseInt(self.api_data.release_date.substring(0,4));
	}
	,
	get_publications: function(type) {
		// dependence: make_publications
		// type can be "associated", "cited_by", "appears_without_citation" or absent(i.e. all)
		var self = this;
		var pdb = self.options.pdb;
		var associated = pdb.get_api_data(pdb.get_publications_url(self.pdbid))[self.pdbid];
		var related = pdb.get_api_data(pdb.get_related_publications_url(self.pdbid))[self.pdbid];
		if(Biojs.undefined_or_promise(self.publications)) {
			self.publications = {};
			console.log("Adding publications", self.pdbid, associated, related);
			self.publications["associated"] = associated;
			self.publications["cited_by"] = {};
			self.publications["appears_without_citation"] = {};
			if(related) {
				self.publications["cited_by"] = related["cited_by"];
				self.publications["appears_without_citation"] = related["appears_without_citation"];
			}
		}
		if(type)
			return self.publications[type];
		else
			return self.publications;
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
	get_sequence: function() {
		var self = this;
		return self.api_data.sequence;
	}
	,
	get_length: function() {
		var self = this;
		return self.api_data.length;
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
			console.error("TODO Choose preferred model id before creating entity instance");
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
		self.model_id = self.options.model_id;
		self.symop = self.options.symop;
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
	make_validation_info: function() {
		var self = this;
		if(self.validation_info)
			return Biojs.promise_or_resolved_promise(self.validation_info);
		var promise = Biojs.marked_promise();
		var ajax = self.options.pdb.multi_ajax({
			url: self.options.pdb.get_validation_url(self.pdbid),
			done: function() { promise.resolve(self.get_validation_info()); },
			fail: function() { promise.reject(); }
		});
		self.validation_info = promise;
		return promise;
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
		if(Biojs.undefined_or_promise(self.binding_sites)) {
			console.log("Adding structural features", self.pdbid, self.entity_id, self.struct_asym_id);
			self.binding_sites = [];
			var apidata = self.pdb.get_api_data(self.pdb.get_binding_sites_url(self.pdbid))[self.pdbid];
			jQuery.each(apidata, function(bi,bd) {
				var bound_resnums = [];
				console.error("TODO must check entity_id here not just struct_asym!!");
				jQuery.each(bd.site_residues, function(ri,res) {
					//if(res.entity_id == self.entity_id && res.struct_asym_id == self.struct_asym_id)
					if(res.struct_asym_id == self.struct_asym_id)
						bound_resnums.push(res.residue_number);
				});
				if(bound_resnums.length > 0)
					self.binding_sites.push({residue_numbers:bound_resnums}); // can add more detail here later
			});
		}
		return self.binding_sites;
	}
	,
	get_secondary_structure: function() {
		// dependence: make_structural_features
		var self = this;
		if(Biojs.undefined_or_promise(self.secondary_structure)) {
			console.log("Adding structural features", self.pdbid, self.entity_id, self.struct_asym_id);
			self.secondary_structure = {};
			var apidata = self.pdb.get_api_data(self.pdb.get_sec_str_url(self.pdbid))[self.pdbid];
			jQuery.each(apidata.molecules, function(mi,md) {
				if(md.entity_id != self.entity_id)
					return;
				console.error("TODO must check entity_id here not just struct_asym!!");
				jQuery.each(md.chains, function(ci,cd) {
					if(cd.struct_asym_id != self.struct_asym_id)
						return;
					self.secondary_structure = cd.secondary_structure;
					return false;
				});
			});
		}
		return self.secondary_structure;
	}
	,
	get_residue_listing: function() {
		// dependence: make_structural_features
		var self = this;
		if(Biojs.undefined_or_promise(self.residue_listing)) {
			console.log("Adding structural features", self.pdbid, self.entity_id, self.struct_asym_id);
			self.residue_listing = [];
			var apidata = self.pdb.get_api_data(self.pdb.get_residue_listing_url(self.pdbid))[self.pdbid];
			jQuery.each(apidata.molecules, function(mi,md) {
				if(md.entity_id != self.entity_id)
					return;
				console.error("TODO must check entity_id here not just struct_asym!!");
				jQuery.each(md.chains, function(ci,cd) {
					if(cd.struct_asym_id != self.struct_asym_id)
						return;
					self.residue_listing = cd.residues;
					return false;
				});
			});
		}
		return self.residue_listing;
	}
	,
	get_validation_info: function() {
		// dependence: get_validation_info
		var self = this;
		if(Biojs.undefined_or_promise(self.validation_info)) {
			console.log("Adding validation info", self.pdbid, self.entity_id, self.struct_asym_id);
			self.validation_info = [];
			var apidata = self.pdb.get_api_data(self.pdb.get_validation_url(self.pdbid))[self.pdbid];
			jQuery.each(apidata.molecules, function(mi,md) {
				if(md.entity_id != self.entity_id)
					return;
				console.error("TODO must check entity_id here not just struct_asym!!");
				jQuery.each(md.chains, function(ci,cd) {
					if(cd.struct_asym_id != self.struct_asym_id)
						return;
					jQuery.each(cd.models, function(modi,model) {
						if(self.model_id && model.model_id != self.model_id)
							return;
						self.validation_info = model.residues;
						return false;
					});
				});
			});
		}
		return self.validation_info;
	}
});


(function () { // this is to support jQuery events not based on any dom element, copied from http://stackoverflow.com/questions/9977486/event-trigger-not-firing-in-non-dom-object
	var topics = {};
	if(jQuery.Topic)
		return;
	jQuery.Topic = function (id) {
		var callbacks, method, topic = id && topics[id];
		if (!topic) {
			callbacks = jQuery.Callbacks();
			topic = {
				publish: callbacks.fire,
				subscribe: callbacks.add,
				unsubscribe: callbacks.remove
			};
			if (id) {
				topics[id] = topic;
			}
		}
		return topic;
	};
}) ();


// this is to achieve precise placement of letters of a string on a raphael canvas
Raphael.prototype.print_precise = function (x, y, string, font, size, origin, letter_spacing) {
	var E = "", Str = String, split = "split", R = Raphael, separator = /[, ]+/, top = 0;
	origin = origin || "middle"; // baseline|middle
	var letters = Str(string)[split](E),
		shift = 0,
		notfirst = 0,
		path = E;
	if(R.is(font, string)) font = this.getFont(font);
	var scale = (size || 16) / font.face["units-per-em"];
	if(font.face["units-per-em"] % size != 0) {
		console.warn("Raphael:print_precise might not work properly because font size is not a factor of units-per-em", size, font.face["units-per-em"]);
	};
	var bb = font.face.bbox.split(separator),
		top = +bb[0],
		lineHeight = bb[3] - bb[1],
		shifty = 0,
		height = +bb[1] + (origin == "baseline" ? lineHeight + (+font.face.descent) : lineHeight / 2);
	for (var i = 0, ii = letters.length; i < ii; i++) {
//console.log("printing", i);
		var curr = font.glyphs[letters[i]];
		shift = letter_spacing[i];
//console.log(shift, scale, shift*scale, x, bb[0], top, x-top, scale, (x-top)/scale);
		notfirst = 1;
		path += R.transformPath(curr.d, ["t", shift * scale, shifty * scale, "s", scale, scale, top, height, "t", (x - top) / scale, (y - height) / scale]);
	}
	return this.path(path).attr({
		fill: "#000",
		stroke: "none"
	});
};


// Sequence layout has rows and menu at top or bottom.
// The layout can add/remove a row.
// A row can have menu on right or left, but middle bit has to be about sequence.
// A row can be visible or hidden. It can request data upon becoming visible for the first time.
// A row has one or more painters which paint into Raphael element in the middle.
// Painters differ on consumed data and drawing style
// Events (click, mouse-in/out) are broadcast with objects such as single/multiple residues, binding site, a helix/strand, a domain, etc.
Biojs.PDB_Sequence_Layout_Maker = Biojs.extend ({
	opt: {}
 	,
	constructor: function(options) {
		var self = this;
		self.target = options.target;
		self.dimensions = options.dimensions;
		var total_width = 0;
		for(var wt in self.dimensions.widths)
			total_width += self.dimensions.widths[wt];
		self.dimensions.widths.total_width = total_width;
		self.markups = options.markups ? options.markups : {top:"", bottom:""};
		self.seq_font_size = options.seq_font_size ? options.seq_font_size : 8;
		self.num_slots = options.num_slots;
		self.units_per_index = options.units_per_index ?  options.units_per_index : Math.floor(self.dimensions.widths.middle / self.num_slots);
		console.log("Units per index", self.units_per_index, options.units_per_index);
		self.id2row = {};
		jQuery("#"+self.target).html(self.get_markup());
	}
	,
	get_markup: function(which) {
		var self = this;
		if(which)
			return Biojs.string_or_func_eval(self.markups[which]);
		else {
			var template = Biojs.get_template("sequence_layout_maker_template");
			var ret = template({
				top_markup: self.get_markup("top"),
				bottom_markup: self.get_markup("bottom"),
				widths: self.dimensions.widths,
				heights: self.dimensions.heights
			});
			return ret;
		}
	}
	,
	add_row: function(arow) {
		var self = this;
		arow.seq_font_size = self.seq_font_size;
		arow.units_per_index = self.units_per_index;
		arow.num_slots = self.num_slots;
		if(self.id2row[arow.id])
			console.warn("Not adding already added row!");
		else {
			jQuery("#"+self.target+" .pslm_middle_panel")
				.append(arow.get_markup(self));
			self.id2row[arow.id] = arow;
		}
	}
});


Biojs.PDB_Sequence_Layout_Row = Biojs.extend ({
	opt: {}
 	,
	constructor: function(options) {
		var self = this;
		self.id = options.id ? options.id : Biojs.get_random_string("row");
		self.height = options.height ? options.height : Biojs.layout_params.MIN_ROW_HEIGHT;
		self.markups = options.markups ? options.markups : {left:"", middle:"", right:""};
		self.waiting = false;
	}
	,
	toggle_visibilty: function() {
		var self = this;
		jQuery("#"+self.id).toggle();
	}
	,
	get_markup: function(layout) {
		var self = this;
		if(layout == "left" || layout == "middle" || layout == "right") {
			if(!(self.markups[layout] instanceof Array))
				return Biojs.string_or_func_eval(self.markups[layout]);
			else {
				// take markup from only first painter!
				var ret_markup = null;
				jQuery.each(self.markups[layout], function(pi, painter) {
					//console.log(layout, self.markups[layout]);
					if(painter.type == "zoom" && self.markups[layout].length > 1)
						throw "Can't render a zoom row with non-zoom painter";
					var markup = painter.get_markup(self);
					if(ret_markup == null)
						ret_markup = markup;
				});
				return ret_markup;
			}
		}
		else {
			var template = Biojs.get_template("sequence_layout_row_template");
			var ret = template({
				widths:layout.dimensions.widths,
				row_height:self.height, row_id:self.id,
				left_markup:self.get_markup("left"),
				middle_markup:self.get_markup("middle"),
				right_markup:self.get_markup("right")
			});
			return ret;
		}
	}
	,
	render_painters: function() {
		// painter.render can return a promise, and row-waiting will end when all promises are resolved either way
		var self = this;
		self.toggle_waiting_display("Wait...");
		var promises = [];//[ Biojs.trivial_resolved_promise() ];
		if(self.markups.middle instanceof Array) {
			jQuery.each(self.markups.middle, function(pi,painter) {
				var ret = painter.render();
				if(Biojs.is_promise(ret))
					promises.push(ret);
			});
		}
		Biojs.when_no_deferred_pending(promises) // this always resolves, so only done() reqd
		.done(function() {
			var num_rejected = 0;
			jQuery.each(promises, function(pi,ps) {
				if(ps.state() == "rejected")
					num_rejected += 1;
			});
			self.toggle_waiting_display();
			if(num_rejected > 0) {
				if(num_rejected == promises.length) {
					self.toggle_waiting_display("No data could be fetched this row. The row will vanish soon.");
					setTimeout(function() { self.toggle_visibilty(); }, 3000);
				}
				else {
					self.toggle_waiting_display("Some data could not be fetched for this row.");
					setTimeout(function() { self.toggle_waiting_display(); }, 2000);
				}
			}
		});
	}
	,
	toggle_waiting_display: function(message) {
		var self = this;
		jQuery("#"+self.id+" .cell_cover")
			.html(Biojs.string_or_func_eval(message))
			.toggle();
		self.waiting = !self.waiting;
	}
	,
	set_raphael: function(rapha) {
		var self = this;
		if(!self.rapha)
			self.rapha = rapha;
		else
			throw "Cannot set multiple Raphael objects on a row...";
	}
	,
	get_raphael: function() {
		var self = this;
		return self.rapha;
	}
});


Biojs.PDB_Sequence_Layout_Painter = Biojs.extend ({
	opt: {}
 	,
	constructor: function(options) {
		var self = this;
		self.num_slots = options.num_slots;
		self.height = options.height;
		self.width = options.width;
		self.type = options.type;
		self.ranges = options.ranges;
		self.indices = options.indices;
		self.index_pairs = options.index_pairs;
		self.heights = options.heights;
		self.sequence = options.sequence;
		self.color = options.color ? options.color : "green";
		self.baseline = options.baseline ? options.baseline : 10;
		self.y_height = options.y_height ? options.y_height : 10;
		self.seq_attributes = options.seq_attributes ? options.seq_attributes : {fill:"red"};
		self.shape_attributes = options.shape_attributes ? options.shape_attributes : {fill:"red"};
		self.hover_attributes = options.hover_attributes;
		self.tooltip = options.tooltip;
		self.render_after_promise = options.render_after_promise ?
			options.render_after_promise : Biojs.trivial_resolved_promise();
		self.histo_x_pos = options.histo_x_pos ? options.histo_x_pos : {start:0, stop:99};
		self.zoom_minval = options.zoom_minval;
		self.zoom_no_seq_increments = options.zoom_no_seq_increments;
		self.zoom_maxval = options.zoom_maxval;
	}
	,
	range_to_units: function(start, end) {
		var self = this;
		return [start * self.row.units_per_index, (end+1) * self.row.units_per_index -1 ];
	}
	,
	get_markup: function(row) {
		var self = this;
		if(!self.row)
			self.row = row;
		else if(!(self.row === row))
			throw "Cannot have a painter in two different rows!!";
		if(self.divid)
			throw "Multiple add_markup calls to same row painter!";
		self.divid = Biojs.get_random_string("zoom");
		var markup = Biojs.get_template("sequence_layout_zoom_div")({divid:self.divid});
		var this_interval = setInterval(function() {
			if(jQuery("#"+self.divid).length > 0) {
				clearInterval(this_interval);
        		jQuery('#'+self.divid).html("");
				self.row.render_painters();
			}
		}, 100);
		return markup;
	}
	,
	render: function() {
		var self = this;
		if(self.rendered) // attempt rendering only once
			return;
		self.rendered = true;
   		self.px_per_index = self.width/self.row.num_slots;
		self.current_zoom_indices = [0, self.row.num_slots-1];
		if(self.type != "zoom" && jQuery("#"+self.divid).html() == "") { // create Raphael element only once
			self.row.set_raphael(new Raphael(self.divid, self.width, self.height));
			jQuery.Topic("ZoomEvent").subscribe(function(edata) {
				self.current_zoom_indices = [edata.start, edata.stop];
				self.zoom_rapha_to_range();
			});
		}
		self.render_after_promise.done(function() {
			if(self.type == "zoom")
				self.draw_zoombar();
			else {
				if(self.type == "zoomable_sequence") {
					self.draw_sequence(0, self.row.num_slots);
					jQuery.Topic("ZoomEvent").subscribe(function(edata) {
						self.draw_sequence(edata.start, edata.stop);
					});
				}
				else if(self.type == "domain") {
					self.draw_domain();
					self.zoom_rapha_to_range();
					self.setup_tooltip();
					self.setup_hover();
				}
				else if(self.type == "points") {
					self.draw_points();
					self.zoom_rapha_to_range();
					self.setup_tooltip();
					self.setup_hover();
				}
				else if(self.type == "histogram") {
					self.draw_histogram();
					self.zoom_rapha_to_range();
					self.setup_tooltip();
					self.setup_hover();
				}
				else if(self.type == "connectors") {
					self.draw_connectors();
					self.zoom_rapha_to_range();
					self.setup_tooltip();
					self.setup_hover();
				}
				else if(self.type != "zoom")
					throw "Unknown painter type! " + self.type;
			}
		});
		return self.render_after_promise;
	}
	,
	draw_histogram: function() {
		var self = this;
		console.log("Drawing painter", self, "histogram", self.heights);
		var heights = Biojs.eval_if_function(self.heights);
		self.rapha_elems = [];
		var max_height = -1e10, min_height = 1e10;
		jQuery.each(heights, function(ri, ht) { // find min max
			ht *= -1; // to make +ve go up and -ve go down
			if(max_height < ht)
				max_height = ht;
			if(min_height > ht)
				min_height = ht;
		});
		if(max_height <= 0 && min_height <= 0)
			max_height = 0;
		else if(max_height >= 0 && min_height >= 0)
			min_height = 0;
		//self.row.get_raphael().path(["M", 0, self.baseline, "L", 100, self.baseline]);
		//self.row.get_raphael() .path(["M", 0, self.baseline+self.y_height, "L", 100, self.baseline+self.y_height]);
		var y_start = self.baseline, y_stop = self.baseline + self.y_height; // fit histogram in this y-band
		var given_y_to_rapha_y = function(gy) {
			return (y_stop-y_start) * (gy-min_height) / (max_height-min_height) + y_start;
		}
		jQuery.each(heights, function(ri, ht) {
			if(ht==0)
				return;
			ht *= -1; // to make +ve go up and -ve go down
			ri = parseInt(ri);
			// draw box from 0-height to given-height
			var aru = self.range_to_units(ri, ri);
			var startx = aru[0] + self.histo_x_pos.start*(aru[1]-aru[0]+1)/100;
			var stopx  = aru[0] + self.histo_x_pos.stop *(aru[1]-aru[0]+1)/100;
			self.rapha_elems.push(
				self.row.get_raphael()
					.path(["M", startx, given_y_to_rapha_y(0), "L", stopx, given_y_to_rapha_y(0),
						"L", stopx, given_y_to_rapha_y(ht), "L", startx, given_y_to_rapha_y(ht), "Z"])
					.attr(self.shape_attributes)
			);
		});
	}
	,
	draw_connectors: function() {
		var self = this;
		console.log("Drawing painter", self, "points", self.index_pairs);
		var index_pairs = Biojs.eval_if_function(self.index_pairs);
		self.rapha_elems = [];
		jQuery.each(index_pairs, function(ri, ii) {
			//console.log(ar, self.row);
			var ar0 = self.range_to_units(ii[0], ii[0]);
			var ar1 = self.range_to_units(ii[1], ii[1]);
			self.rapha_elems.push(
				self.row.get_raphael()
				.path(["M", ar0[0], self.baseline, "L", ar0[0]+1, self.baseline,
						"L", ar1[0]+1, self.baseline+self.y_height,
						"L", ar1[0], self.baseline+self.y_height, "Z"])
				.attr(self.shape_attributes)
			);
		});
	}
	,
	draw_points: function() {
		var self = this;
		console.log("Drawing painter", self, "points", self.indices);
		var indices = Biojs.eval_if_function(self.indices);
		self.rapha_elems = [];
		jQuery.each(indices, function(ri, ar) {
			//console.log(ar, self.row);
			var aru = self.range_to_units(ar, ar);
			self.rapha_elems.push(
				self.row.get_raphael()
				.rect(aru[0], self.baseline, aru[1]-aru[0], self.y_height).attr(self.shape_attributes)
			);
		});
	}
	,
	draw_domain: function() {
		var self = this;
		var domain_ranges = Biojs.eval_if_function(self.ranges);
		console.log("Drawing painter", self, "domains", domain_ranges);
		self.rapha_elems = [];
		jQuery.each(domain_ranges, function(ri, ar) {
			//console.log(ar, self.row);
			var aru = self.range_to_units(ar[0], ar[1]);
			self.rapha_elems.push(
				self.row.get_raphael()
				.rect(aru[0], self.baseline, aru[1]-aru[0], self.y_height).attr(self.shape_attributes)
			);
		});
	}
	,
	zoom_rapha_to_range: function() {
		var self = this;
		var zoom_from_index = self.current_zoom_indices[0];
		var zoom_till_index = self.current_zoom_indices[1];
		var start = zoom_from_index*self.row.units_per_index, width = (zoom_till_index-zoom_from_index+1)*self.row.units_per_index;
		self.row.get_raphael().setViewBox(start, 0, width, self.height, false);
		self.row.get_raphael().canvas.setAttribute('preserveAspectRatio', 'none'); // TODO no equivalent fix for IE 6/7/8?
	}
	,
	get_min_rangediff: function() {
		var self = this;
		//console.log("get_min_rangediff", self.width, self.row.seq_font_size, Math.floor(self.width / self.row.seq_font_size));
		return Math.floor(self.width / self.row.seq_font_size);
	}
	,
	getCufonFont: function() {
		var self = this;
		// downloaded from : http://www.cufonfonts.com/en/basic-fixed-weight-fonts
		if(!self.registered_cufon_font) {
			Cufon.registerFont(Raphael.registerFont({"w":1195,"face":{"font-family":"Pseudo APL","font-weight":400,"font-stretch":"normal","units-per-em":"2048","panose-1":"2 0 0 0 0 0 0 0 0 0","ascent":"1638","descent":"-410","x-height":"33","bbox":"-25 -1510 1226 391.797","underline-thickness":"150","underline-position":"-142","unicode-range":"U+0020-U+20AC"},"glyphs":{" ":{"w":569},"\u00a0":{"w":569},"!":{"d":"663,-428v-19,10,-35,17,-50,21v-45,-11,-68,-38,-71,-80r-45,-733v5,-44,74,-64,141,-64v32,0,62,20,89,61v4,12,3,25,2,39r-43,698v-1,19,-9,38,-23,58xm593,-242v93,0,150,46,153,121v2,60,-53,121,-113,121v-93,0,-151,-44,-153,-119v-2,-66,47,-123,113,-123"},"\"":{"d":"933,-1156v0,69,-29,235,-88,498r-19,1v-62,-221,-93,-394,-93,-519v0,-100,59,-126,144,-99v15,5,27,17,40,30v11,23,16,53,16,89xm542,-1163v0,72,-30,240,-89,505r-19,0v-63,-218,-94,-390,-94,-515v0,-103,62,-126,148,-101v46,37,54,35,54,111"},"#":{"d":"997,-784v21,-2,65,34,65,55v0,58,-166,41,-237,39r-17,199r147,0v42,0,63,13,63,38v0,22,-42,56,-63,56r-156,0r-31,349v-1,21,-35,48,-59,48v-37,0,-54,-18,-51,-55r31,-342r-177,0r-31,349v-3,32,-19,48,-49,48v-25,0,-45,-18,-59,-53r31,-344r-160,0v-29,0,-64,-19,-64,-56v0,-25,21,-38,64,-38r169,0r15,-199v-49,-5,-205,29,-205,-39v0,-11,13,-27,40,-48v7,-5,64,-7,173,-7r33,-350v0,-27,48,-61,83,-42v20,11,28,29,26,48r-30,344r174,0r36,-350v3,-30,20,-46,50,-48v25,5,44,22,57,52r-32,346r164,0xm716,-690r-177,0r-18,199r180,0"},"$":{"d":"1016,-300v0,177,-156,305,-337,301v0,41,-5,68,-16,82v-17,9,-31,15,-41,18v-44,-9,-64,-45,-60,-108v-70,-15,-126,-41,-169,-79v0,41,-17,62,-51,62v-33,0,-50,-22,-51,-65r-4,-192v0,-34,12,-60,49,-63v59,-4,64,131,86,142v27,41,74,70,140,89r2,-393v-169,-45,-253,-131,-253,-258v0,-153,114,-258,254,-280v1,-57,1,-85,1,-86v7,-35,26,-52,57,-52v31,0,55,16,55,50r0,86v78,7,139,29,183,66r2,19v0,-42,16,-63,48,-63v36,0,54,21,55,62r4,177v1,44,-16,66,-49,66v-25,0,-42,-17,-51,-50v-34,-122,-80,-147,-211,-174r20,355v43,7,105,16,179,46v108,44,158,131,158,242xm565,-935v-77,14,-151,78,-150,164v0,84,50,138,149,161xm679,-102v118,3,233,-86,233,-200v0,-61,-26,-106,-76,-135v-28,-16,-80,-32,-157,-47r0,382"},"%":{"d":"341,-1120v82,0,148,66,148,147v0,79,-69,149,-148,149v-79,0,-150,-70,-150,-149v0,-82,68,-147,150,-147xm909,-423v112,0,208,98,208,209v0,113,-96,207,-208,207v-110,0,-208,-97,-208,-207v0,-109,98,-209,208,-209xm457,-1120v5,-4,8,-8,8,-17v146,29,174,20,357,-5r17,-9v-29,1,-201,24,-250,24v-50,0,-200,-34,-250,-34v-98,0,-186,90,-186,188v0,101,87,190,188,190v97,0,192,-94,188,-190v-4,-80,-22,-89,-72,-147xm833,-1173v29,-35,102,-15,102,42v0,7,-169,369,-506,1084v-12,25,-36,37,-73,37v-25,0,-38,-19,-38,-57v0,-5,172,-374,515,-1106xm909,-85v69,0,128,-59,128,-129v0,-70,-58,-129,-128,-129v-67,0,-127,56,-127,124v0,74,53,134,127,134"},"&":{"d":"857,-947v-6,164,-102,226,-238,305r163,287v20,-87,34,-139,41,-156v27,-66,65,-99,112,-99v81,0,103,65,54,105v-51,41,-60,43,-89,143v-20,67,-35,111,-46,132v58,76,57,78,122,123v49,34,11,102,-59,102v-54,0,-99,-38,-134,-115v-55,80,-126,120,-212,120v-169,0,-295,-183,-295,-358v0,-137,65,-246,195,-328v-53,-97,-80,-172,-80,-225v0,-143,112,-275,255,-275v134,0,216,101,211,239xm569,-732v117,-66,171,-89,180,-225v4,-53,-49,-100,-103,-100v-74,0,-139,76,-139,149v0,53,21,111,62,176xm390,-358v0,111,74,231,178,231v59,0,108,-37,149,-111r-192,-345v-90,61,-135,136,-135,225"},"'":{"d":"717,-1243v31,105,13,186,-18,343r-49,244r-17,1v-59,-209,-89,-383,-89,-520v0,-99,40,-124,136,-99v13,7,26,18,37,31"},"(":{"d":"781,15v21,43,-11,80,-45,86v-65,12,-210,-376,-229,-460v-59,-265,-21,-473,92,-725v60,-132,106,-198,136,-198v29,0,48,18,54,55v3,17,-87,199,-85,198v-87,242,-121,459,-48,725v27,98,80,225,125,319"},")":{"d":"525,101v-22,0,-58,-33,-55,-54v4,-24,92,-215,113,-274v77,-219,81,-461,11,-680v0,-11,-66,-158,-124,-320v4,-37,22,-55,54,-55v64,0,217,381,233,459v28,134,31,319,0,455v-23,99,-157,469,-232,469"},"*":{"d":"557,-1169r115,0r0,311r293,-96r32,108r-288,98r188,256r-94,66r-189,-254r-188,254r-94,-66r188,-256r-289,-98r33,-108r293,96r0,-311","w":1229},"+":{"d":"621,-1045v47,15,58,16,58,73r0,321r323,0v48,0,72,20,72,61v0,40,-24,60,-72,60r-323,0r-3,355v0,13,-18,26,-55,39v-40,-12,-60,-37,-60,-74r0,-320r-321,0v-41,0,-66,-20,-75,-60v4,-41,29,-61,75,-61r321,0r0,-321v2,-55,12,-58,60,-73"},",":{"d":"595,-269v106,0,180,59,180,148v0,90,-73,151,-180,151v-82,0,-146,-68,-146,-150v0,-82,64,-149,146,-149xm766,-69v-37,105,-91,193,-159,265v-74,78,-81,74,-168,97v-4,1,-7,0,-9,-5v75,-125,112,-220,112,-285"},"-":{"d":"1034,-639v59,19,53,100,-32,100r-795,-3v-28,0,-42,-16,-42,-48v0,-35,25,-52,75,-52"},"\u00ad":{"d":"1034,-639v59,19,53,100,-32,100r-795,-3v-28,0,-42,-16,-42,-48v0,-35,25,-52,75,-52"},".":{"d":"605,-274v101,0,171,50,171,137v0,83,-72,137,-171,137v-74,0,-140,-62,-140,-136v0,-77,63,-138,140,-138"},"\/":{"d":"981,-1172v58,-38,122,37,83,89r-803,1069v-32,33,-96,7,-96,-43v0,-18,4,-32,12,-42"},"0":{"d":"609,-1209v246,0,369,242,364,513r0,185v5,257,-119,511,-352,511v-234,0,-360,-254,-355,-511r0,-185v-5,-249,120,-513,343,-513xm629,-111v151,7,239,-238,236,-410v-2,-140,7,-233,-32,-355v-44,-137,-78,-214,-223,-221v-150,-8,-242,239,-236,410v5,142,-12,234,30,356v44,129,86,213,225,220"},"1":{"d":"965,-57v0,38,-23,57,-68,57r-576,0v-44,0,-66,-19,-66,-56v0,-36,22,-54,66,-54r234,0r0,-906v-158,50,-240,75,-246,75v-51,6,-64,-58,-41,-95v8,-7,20,-13,36,-18r361,-115r0,1059r232,0v45,0,68,18,68,53"},"2":{"d":"598,-1182v196,0,397,218,316,438v-36,97,-211,277,-300,333v-58,37,-123,82,-195,136r-143,203r0,-39r549,0v0,-55,17,-82,52,-82v79,0,51,118,56,193r-746,0r0,-137v37,-26,99,-159,134,-188v67,-56,183,-137,265,-195v21,-15,67,-63,140,-142v65,-71,98,-132,98,-182v0,-122,-124,-227,-244,-224v-127,3,-183,57,-234,152v-29,54,-27,78,-68,78v-36,0,-54,-17,-54,-51v0,-31,17,-73,51,-127v68,-110,176,-166,323,-166"},"3":{"d":"756,-614v95,47,185,166,187,296v4,203,-188,357,-397,357v-136,0,-306,-69,-363,-150v-13,-39,7,-81,49,-77v86,45,209,115,317,115v166,0,345,-153,261,-332v-32,-68,-88,-122,-183,-143r-154,-34v-30,-29,-17,-95,33,-95v-5,1,23,1,83,1v101,0,203,-85,203,-188v0,-114,-110,-194,-226,-194v-102,0,-178,31,-229,93v-5,7,-14,16,-27,28v-40,10,-78,-2,-78,-46v0,-31,27,-67,82,-106v73,-53,157,-80,252,-80v181,0,339,130,336,307v-2,105,-73,207,-146,248"},"4":{"d":"791,-111v75,-1,112,3,112,55v0,37,-23,56,-69,56r-230,0v-45,0,-68,-19,-68,-56v0,-59,59,-60,145,-55r0,-200r-485,0r0,-113r412,-730r183,0r0,730v74,-1,105,2,112,53v-6,56,-36,61,-112,60r0,200xm681,-424r0,-616r-9,0r-350,616r359,0"},"5":{"d":"590,-710v187,0,325,166,325,358v0,223,-147,397,-366,393v-130,-2,-182,-32,-270,-88v-59,-38,-87,-71,-87,-96v-1,-26,26,-55,53,-54v2,0,36,23,103,67v67,44,133,66,197,66v160,2,264,-127,264,-291v0,-138,-93,-250,-226,-248v-57,-12,-227,64,-254,73v-9,0,-21,-5,-38,-16v-7,-12,-11,-26,-12,-41r-22,-567r557,0v80,-6,91,89,30,114v-10,4,-167,4,-472,4r14,370v75,-29,143,-44,204,-44"},"6":{"d":"588,-625v167,0,329,172,329,338v0,191,-163,343,-353,343v-188,0,-353,-154,-353,-343r0,-540v-4,-230,259,-402,490,-291v62,30,96,66,99,111v-27,72,-68,68,-126,13v-30,-29,-74,-41,-128,-41v-111,0,-209,96,-209,212r-1,271v86,-49,170,-73,252,-73xm564,-55v130,0,243,-99,243,-229v0,-133,-111,-229,-243,-229v-129,0,-242,99,-242,227v0,134,109,231,242,231"},"7":{"d":"303,-1012v1,78,-1,115,-57,115v-36,0,-54,-21,-54,-64r0,-164r711,0r0,140r-296,965v-3,8,-10,21,-23,39v-43,26,-93,5,-89,-57v0,-1,99,-326,296,-974r-488,0"},"8":{"d":"867,-829v0,69,-73,232,-116,260v111,65,166,159,166,282v0,191,-163,343,-353,343v-188,0,-353,-154,-353,-343v0,-120,56,-214,168,-282v-44,-26,-118,-191,-118,-260v0,-159,144,-292,303,-292v157,0,303,135,303,292xm564,-650v107,0,199,-73,199,-177v0,-103,-96,-194,-199,-194v-104,0,-199,89,-199,193v0,102,94,178,199,178xm564,-55v130,0,243,-99,243,-229v0,-133,-111,-228,-243,-228v-130,0,-242,95,-242,226v0,134,109,231,242,231"},"9":{"d":"587,-1168v187,0,354,158,354,344r0,539v5,176,-159,324,-335,324v-90,0,-252,-61,-252,-143v0,-38,20,-57,61,-57v18,0,40,12,67,35v27,23,66,35,118,35v117,2,217,-83,217,-201r0,-269v-36,23,-178,74,-229,74v-184,0,-352,-152,-352,-337v0,-189,162,-344,351,-344xm587,-598v132,0,244,-97,244,-227v0,-130,-114,-232,-244,-232v-126,0,-243,102,-243,229v0,128,117,230,243,230"},":":{"d":"605,-874v106,0,171,61,171,150v0,93,-65,151,-171,151v-76,0,-140,-74,-140,-149v0,-79,60,-152,140,-152xm605,-300v104,0,171,62,171,148v0,93,-65,152,-171,152v-79,0,-140,-68,-140,-150v0,-78,61,-150,140,-150"},";":{"d":"595,-874v106,0,180,62,180,150v0,94,-70,154,-180,154v-82,0,-146,-70,-146,-152v0,-83,63,-152,146,-152xm595,-298v107,0,180,57,180,149v0,96,-70,153,-180,153v-79,0,-146,-73,-146,-152v0,-83,62,-150,146,-150xm766,-97v-36,105,-85,193,-150,261v-81,85,-86,94,-177,107v-4,1,-7,-1,-9,-5v75,-125,112,-220,112,-286"},"\u037e":{"d":"595,-874v106,0,180,62,180,150v0,94,-70,154,-180,154v-82,0,-146,-70,-146,-152v0,-83,63,-152,146,-152xm595,-298v107,0,180,57,180,149v0,96,-70,153,-180,153v-79,0,-146,-73,-146,-152v0,-83,62,-150,146,-150xm766,-97v-36,105,-85,193,-150,261v-81,85,-86,94,-177,107v-4,1,-7,-1,-9,-5v75,-125,112,-220,112,-286"},"<":{"d":"975,-1030v46,-35,99,-3,99,44v0,23,-14,42,-43,59r-595,337r595,335v29,17,43,36,43,58v-2,48,-48,74,-99,46r-810,-439"},"=":{"d":"1084,-731v0,39,-24,59,-72,59r-783,0v-49,0,-73,-20,-73,-59v0,-38,23,-57,68,-57r793,0v45,0,67,19,67,57xm1084,-456v-1,36,-27,57,-72,57r-783,0v-49,0,-73,-19,-73,-56v0,-38,24,-57,73,-57r783,0v48,0,72,19,72,56"},">":{"d":"224,-136v-25,2,-59,-34,-59,-59v0,-23,14,-43,43,-60r597,-335r-597,-337v-62,-25,-57,-120,16,-118v9,0,22,5,40,15r810,440r-810,439v-18,10,-31,15,-40,15"},"?":{"d":"613,-1182v216,0,373,148,373,364v0,87,-35,160,-106,218v-38,31,-112,72,-222,121v0,77,-19,115,-58,115v-85,0,-60,-115,-63,-194v97,-37,165,-68,205,-92v83,-50,125,-104,125,-165v0,-145,-118,-246,-262,-246v-108,0,-177,20,-208,60v-5,7,-15,37,-29,91v-10,38,-30,57,-57,57v-29,0,-62,-31,-62,-59v0,-180,121,-270,364,-270xm638,-242v63,-2,119,59,119,122v0,65,-54,120,-119,120r-81,0v-61,2,-118,-52,-118,-113v0,-70,47,-129,118,-129r81,0"},"@":{"d":"150,-601v0,-318,194,-586,500,-582v230,3,316,53,405,201v65,108,96,386,22,528v-34,66,-80,113,-143,139v-33,14,-105,19,-218,17v-170,-3,-308,-79,-308,-238v0,-132,111,-240,230,-258v21,-4,62,-6,125,-6v11,-38,33,-40,61,-47v4,0,13,3,28,9v27,1,30,12,30,43r-3,412r-19,0r0,-26v10,7,20,13,35,15v72,11,125,-225,125,-310v0,-221,-116,-395,-329,-393v-81,0,-137,7,-168,22v-171,84,-256,257,-256,518v0,279,124,479,424,479v109,0,199,-19,269,-57v30,-17,57,-16,90,-5v11,9,16,19,16,28v0,76,-282,115,-387,115v-352,0,-529,-239,-529,-604xm759,-389r0,-321v-81,-1,-212,47,-221,111v-11,75,-12,148,45,183v56,34,85,40,176,27"},"A":{"d":"1101,-122v89,-2,125,-1,125,60v0,41,-25,62,-74,62r-318,0v-11,0,-26,-5,-44,-16v-27,-27,-26,-63,0,-89v25,-12,55,-18,89,-19v-69,1,-37,2,97,2r-98,-261r-517,0r-95,261v80,5,206,-25,206,60v0,32,-30,63,-74,62r-307,0v-50,0,-75,-20,-75,-60v0,-59,45,-63,128,-62r347,-939v-80,-5,-203,25,-203,-60v0,-41,24,-61,73,-61r342,0xm832,-502r-213,-559r-5,0r-204,559r422,0"},"B":{"d":"676,-1182v190,-4,365,132,365,315v0,95,-46,175,-139,241v147,57,221,155,221,294v0,188,-164,332,-351,332r-610,0v-51,0,-76,-20,-76,-60v0,-33,22,-54,65,-61v5,-1,38,-1,99,-1r4,-939v-71,7,-165,6,-165,-60v0,-41,25,-61,75,-61r512,0xm640,-674v143,3,278,-69,278,-199v0,-109,-124,-188,-239,-188r-306,0r-2,387r269,0xm801,-123v102,5,210,-114,201,-218v-8,-83,-64,-152,-162,-183v-128,-40,-305,-23,-468,-28r-1,430"},"C":{"d":"236,-523v-7,223,198,435,418,435v125,0,240,-57,335,-178v31,-40,109,-34,109,28v0,20,-16,48,-48,84v-149,162,-323,231,-555,159v-97,-30,-138,-54,-197,-119v-109,-119,-175,-206,-181,-396r0,-170v-8,-274,232,-529,503,-529v126,0,235,39,328,116v3,-59,23,-89,60,-89v41,0,61,25,61,74r0,229v0,23,-5,41,-16,56v-30,26,-60,25,-90,0v-15,-21,-18,-98,-37,-117v-71,-123,-308,-195,-472,-109v-111,58,-219,216,-218,382r0,144"},"D":{"d":"182,-1061v-81,1,-123,-3,-123,-60v0,-41,25,-61,75,-61r438,0v165,0,298,83,400,246v83,132,76,213,81,411v7,266,-222,525,-482,525r-438,0v-50,0,-75,-20,-75,-60v0,-58,43,-64,123,-62xm932,-516v0,-185,1,-303,-99,-418v-73,-84,-155,-127,-252,-127r-278,0r-1,939r278,0v184,7,352,-206,352,-394"},"E":{"d":"932,-891v-70,0,-65,-101,-57,-170r-546,0r-2,388r253,0v1,-53,2,-83,3,-89v7,-39,25,-59,56,-59v43,0,64,25,64,76r-1,265v0,51,-20,76,-60,76v-33,0,-53,-19,-60,-57v-2,-8,-3,-38,-2,-91r-253,0r0,430r590,0v11,-76,-13,-211,68,-210v41,0,61,23,61,69v0,1,-4,88,-11,263r-918,0v-49,0,-73,-20,-73,-59v0,-36,20,-63,61,-63r102,0r1,-939r-98,0v-43,-6,-65,-26,-65,-59v0,-41,24,-62,73,-62r878,0r-2,219v-1,48,-21,72,-62,72"},"F":{"d":"1089,-1182r-12,220v-3,47,-22,71,-59,71v-79,0,-58,-105,-51,-170r-587,0r0,388r256,0v0,-56,0,-86,1,-90v6,-39,25,-58,56,-58v42,0,63,25,63,76r-1,265v0,51,-20,76,-59,76v-62,0,-72,-68,-60,-148r-256,0r0,430r177,0v85,-8,96,95,32,118v-130,10,-280,4,-418,4v-49,0,-74,-20,-74,-60v0,-35,21,-62,64,-62r100,0r1,-939r-99,0v-43,-6,-65,-26,-65,-60v0,-41,25,-61,74,-61r917,0"},"G":{"d":"232,-513v-2,275,179,427,460,425v111,0,190,-37,241,-108v27,-38,34,-147,25,-227r-262,0v-57,1,-85,-33,-70,-82v9,-28,35,-41,70,-41r402,0v-3,179,21,278,-49,426v-46,97,-209,153,-362,153v-342,0,-577,-209,-577,-546v0,-238,18,-395,148,-534v100,-107,224,-162,373,-162v123,0,228,30,315,90v-5,-46,29,-63,60,-63v41,0,62,25,62,74r0,185v0,49,-20,74,-61,74v-62,0,-50,-59,-67,-102v-34,-87,-176,-136,-302,-136v-225,0,-412,200,-406,424r0,150"},"H":{"d":"1133,-62v0,41,-25,62,-75,62r-281,0v-51,0,-76,-20,-76,-60v0,-34,21,-54,64,-61v3,-1,37,-1,101,-1r1,-431r-504,0r-1,431r100,0v78,7,88,89,24,118v-97,9,-212,4,-316,4v-50,0,-75,-20,-75,-60v0,-32,18,-52,55,-59v9,-2,40,-3,92,-3r3,-939v-73,0,-110,-20,-110,-60v0,-41,26,-61,77,-61r241,0v88,-6,100,88,33,117v-22,5,-63,6,-122,4r-1,387r503,0r1,-387r-99,0v-44,-7,-66,-27,-66,-60v0,-41,25,-61,76,-61r240,0v51,0,76,20,76,60v0,45,-35,66,-105,61r-3,939v55,0,86,0,91,1v37,7,56,26,56,59"},"I":{"d":"999,-1122v0,41,-23,61,-70,61r-260,0r0,939r257,0v83,-8,94,92,34,118r-34,4r-635,0v-34,1,-71,-21,-71,-60v0,-41,24,-62,71,-62r260,0r0,-939r-257,0v-48,0,-72,-23,-72,-68v0,-35,24,-53,72,-53r635,0v47,0,70,20,70,60"},"J":{"d":"523,-88v146,0,273,-121,273,-267r2,-706v-76,-1,-179,14,-229,-15v-41,-44,-18,-106,55,-106r428,0v50,0,75,20,75,60v0,86,-126,56,-207,61r-1,706v6,211,-186,388,-397,388v-149,0,-320,-96,-379,-192v-59,-97,-34,-242,-2,-365v16,-27,68,-30,92,-4v43,46,-7,134,-7,193v0,140,153,247,297,247"},"K":{"d":"530,-62v-3,44,-21,62,-76,62r-340,0v-50,0,-75,-20,-75,-60v0,-35,21,-62,64,-62r100,0r2,-939r-100,0v-43,-6,-65,-26,-65,-60v0,-41,25,-61,76,-61r298,0v90,-7,102,93,33,117v-21,7,-63,6,-122,4r0,442r496,-442v-43,0,-76,-6,-97,-17v-34,-44,-13,-104,56,-104r243,0v49,0,74,20,74,60v0,45,-33,66,-99,61r-425,379v104,46,189,125,255,236v29,48,77,156,145,324r99,0v43,7,65,27,65,61v0,41,-25,61,-74,61r-171,0v-89,-238,-162,-391,-219,-459v-51,-59,-117,-104,-199,-134r-149,134r-1,337v80,5,210,-24,206,60"},"L":{"d":"1073,0r-920,0v-37,0,-74,-18,-75,-60v-3,-87,160,-65,248,-62r1,-939v-84,-5,-204,26,-204,-67v0,-36,24,-54,73,-54r385,0v87,-6,100,91,32,117v-10,4,-64,4,-163,4r-2,939r503,0r9,-221v2,-49,22,-73,61,-73v42,0,63,23,63,69v0,1,-4,117,-11,347"},"M":{"d":"1054,-122v81,-1,119,4,125,61v3,32,-32,61,-76,61r-263,0v-14,0,-32,-6,-53,-17v-24,-26,-24,-60,0,-88v22,-11,45,-18,70,-19v-29,1,-3,2,78,2r0,-939r13,0r-311,719r-116,0r-301,-683r-2,903v71,-7,164,-6,164,60v0,41,-24,62,-72,62r-261,0v-49,0,-74,-20,-74,-60v0,-58,45,-65,124,-62r1,-939v-71,0,-106,-20,-106,-60v0,-41,24,-61,73,-61r213,0r300,677r294,-677r217,0v81,-6,92,91,30,117v-23,4,-44,5,-65,4"},"N":{"d":"37,-60v22,-60,30,-63,124,-62r1,-939r-98,0v-45,-7,-67,-27,-67,-60v0,-41,26,-61,77,-61r225,0r570,974r3,-853r-99,0v-43,-6,-64,-26,-64,-60v0,-41,25,-61,74,-61r258,0v23,0,42,6,57,17v33,42,21,75,-23,100v-23,4,-51,5,-84,4r-1,1061r-136,0r-572,-971r-1,849r100,0v44,6,66,26,66,60v0,41,-25,62,-76,62r-261,0v-13,0,-32,-6,-55,-17v-10,-11,-16,-26,-18,-43"},"O":{"d":"597,-1209v299,0,516,309,516,621v0,316,-215,621,-518,621v-301,0,-515,-308,-515,-621v0,-314,215,-621,517,-621xm596,-88v235,0,395,-253,395,-500v0,-247,-159,-499,-394,-499v-234,0,-398,252,-398,499v0,247,164,500,397,500"},"P":{"d":"625,-1182v210,-5,400,150,400,353v0,106,-42,192,-125,257v-60,47,-112,75,-155,84v-58,12,-186,18,-383,18r0,348r176,0v49,0,74,20,74,60v0,41,-25,62,-74,62r-385,0v-49,0,-74,-20,-74,-60v0,-34,21,-54,63,-61v5,-1,38,-1,99,-1r3,-939r-99,0v-43,-6,-64,-26,-64,-60v0,-41,24,-61,73,-61r471,0xm605,-590v141,4,301,-104,301,-239v0,-130,-138,-232,-273,-232r-269,0r-2,471r243,0"},"Q":{"d":"1017,-41v16,0,59,-20,74,-20v30,0,45,18,45,53v0,43,-46,65,-139,65v-67,0,-185,-57,-221,-93v-125,69,-227,91,-382,55r2,-10r-4,9v-259,-121,-389,-322,-389,-605v0,-319,214,-622,521,-622v300,0,516,311,516,622v0,159,-73,343,-183,479v69,45,123,67,160,67xm558,-238v55,0,163,34,195,59v109,-87,164,-223,164,-408v0,-246,-160,-500,-393,-500v-232,0,-405,256,-400,500v5,227,77,335,218,446r-9,17v-3,-5,-18,-18,-9,-23r8,2v55,-62,131,-93,226,-93xm657,-112v-66,-39,-163,-20,-205,21v90,14,131,11,205,-21"},"R":{"d":"731,-544v143,119,196,211,318,422v47,0,75,1,84,4v28,8,42,29,42,64v0,28,-34,55,-74,54r-120,0v-76,-138,-134,-234,-173,-287v-77,-104,-159,-178,-246,-223r-239,0r0,388v64,0,97,0,100,1v53,7,73,34,62,82v-16,26,-40,39,-72,39r-259,0v-49,0,-74,-20,-74,-60v0,-56,45,-63,122,-62r2,-939v-63,0,-96,0,-99,-1v-44,-7,-66,-26,-66,-59v0,-41,25,-61,75,-61r495,0v195,-5,381,147,381,337v0,131,-86,232,-259,301xm527,-630v145,4,342,-87,342,-219v0,-114,-145,-212,-262,-212r-282,0r-2,431r204,0"},"S":{"d":"610,-1087v-139,0,-274,85,-274,217v0,89,61,149,183,179r340,83v122,54,183,155,183,303v0,199,-217,338,-429,338v-127,0,-234,-36,-319,-109v0,51,-20,77,-60,77v-40,0,-60,-25,-60,-74r0,-228v0,-49,20,-74,59,-74v63,-2,59,96,82,146v44,97,150,141,299,141v156,0,309,-93,309,-240v0,-95,-60,-165,-183,-195r-340,-84v-122,-49,-183,-138,-183,-267v0,-200,181,-335,389,-335v113,0,205,29,274,86r0,15v0,-49,19,-74,57,-74v42,0,63,25,63,74r0,209v8,84,-91,100,-116,35v-1,-21,-9,-54,-24,-98v-50,-83,-133,-125,-250,-125"},"T":{"d":"367,-60v0,-67,104,-70,180,-62r3,-939r-296,0v-1,76,0,202,-26,237v-50,40,-104,16,-102,-56r10,-302r950,0r-11,302v-2,50,-22,75,-60,75v-39,0,-58,-23,-58,-68v0,-2,3,-65,8,-188r-294,0r-2,939v74,-8,181,-8,181,60v0,41,-24,62,-73,62r-337,0v-49,0,-73,-20,-73,-60"},"U":{"d":"900,-1061v-109,-4,-163,7,-163,-59v0,-41,25,-62,74,-62r258,0v50,0,75,20,75,59v0,45,-41,66,-124,62r0,667v6,228,-185,427,-413,427v-234,0,-415,-193,-415,-427r0,-667v-85,-1,-123,-2,-123,-60v0,-16,6,-31,19,-45v17,-11,36,-16,55,-16r259,0v70,-6,91,62,54,105v-34,22,-63,16,-145,16r0,667v-4,161,130,306,292,306v159,0,297,-148,297,-306r0,-667"},"V":{"d":"955,-1061v-71,7,-165,5,-165,-60v0,-41,25,-61,74,-61r267,0v48,0,72,20,72,59v0,44,-41,65,-124,62r-406,1061r-143,0r-412,-1061v-80,3,-125,-2,-125,-59v0,-41,24,-62,73,-62r268,0v48,0,72,20,72,59v0,33,-21,54,-64,61v-13,2,-45,2,-97,1r373,959r-38,0"},"W":{"d":"1179,-1123v0,41,-29,62,-86,62r-117,1061r-161,0r-216,-757r-213,757r-164,0r-118,-1061v-58,0,-87,-20,-87,-60v0,-41,25,-61,75,-61r219,0v50,0,75,20,75,60v0,33,-21,53,-63,60v-3,1,-36,1,-98,1r95,844r198,-711r158,0r203,712r94,-845r-98,0v-41,-6,-62,-26,-62,-60v0,-41,24,-61,72,-61r219,0v50,0,75,20,75,59"},"X":{"d":"1018,-122v72,2,71,6,96,60v0,41,-25,62,-76,62r-220,0v-58,4,-101,-57,-56,-105v23,-11,58,-17,105,-17r-298,-383r-297,383v89,-1,124,-1,124,61v0,41,-25,61,-74,61r-218,0v-59,1,-83,-29,-73,-82v20,-28,34,-41,92,-40r370,-483r-349,-456v-64,0,-96,-20,-96,-60v0,-41,25,-61,74,-61r222,0v52,0,78,20,78,59v0,45,-43,66,-128,62r275,360r276,-360v-81,1,-129,-3,-129,-60v0,-41,25,-61,76,-61r224,0v48,0,72,20,72,59v0,41,-31,62,-94,62r-349,456"},"Y":{"d":"867,-1061v-78,1,-117,-4,-117,-60v0,-41,25,-61,74,-61r223,0v85,-6,96,89,33,117v-22,4,-46,5,-72,4r-342,532r-1,407v84,7,222,-29,222,60v0,41,-24,62,-73,62r-421,0v-51,0,-76,-20,-76,-60v0,-91,140,-55,225,-62r0,-406r-348,-533v-74,0,-111,-20,-111,-60v0,-41,24,-61,73,-61r223,0v87,-6,101,89,34,117v-23,4,-48,5,-76,4r269,409"},"Z":{"d":"931,0r-816,0r1,-146r676,-960r0,45r-520,0v-12,76,10,212,-71,212v-19,0,-32,-6,-39,-17v-13,-9,-20,-27,-20,-53v0,-1,3,-88,9,-263r737,0r-4,143r-664,950r-13,-33r604,0v2,-78,1,-195,26,-238v42,-36,113,-13,106,55v0,1,-4,102,-12,305"},"[":{"d":"741,-1282v26,-1,57,32,57,58v0,40,-18,60,-55,60r-181,0r0,1146v0,0,20,-1,71,-3v65,-2,123,-2,152,22v28,44,10,100,-44,100r-291,0r0,-1383r291,0"},"\\":{"d":"1074,-57v1,27,-33,58,-59,57v-17,0,-36,-15,-58,-44r-792,-1083v11,-37,33,-55,64,-55v15,0,34,15,56,46"},"]":{"d":"791,104r-293,0v-37,0,-56,-20,-56,-61v0,-38,19,-57,56,-57r180,0r0,-1148r-182,0v-31,0,-49,-20,-54,-59v8,-39,27,-59,56,-59r293,0r0,1384"},"^":{"d":"297,-498r-129,0r391,-671r111,0r391,671r-129,0r-318,-549","w":1229},"_":{"d":"1212,151v-11,33,-35,50,-72,50r-1037,0v-19,0,-35,-3,-47,-10v-15,-15,-24,-29,-27,-40v12,-33,36,-50,73,-50r1037,0v35,0,60,17,73,50"},"`":{"d":"800,-924v57,39,30,131,-36,132v-17,0,-37,-10,-60,-30r-270,-229v-39,-37,-46,-64,-14,-111v49,-30,67,-27,109,8"},"a":{"d":"610,-904v178,0,346,98,346,266r-1,520r99,0v44,6,66,25,66,58v0,41,-25,61,-74,61r-211,0r0,-95v-115,85,-234,127,-359,127v-175,0,-331,-107,-331,-274v0,-85,41,-156,117,-222v104,-90,387,-117,575,-66r0,-109v2,-98,-118,-149,-229,-146v-49,-9,-271,64,-306,64v-16,0,-30,-5,-42,-15v-12,-20,-18,-35,-18,-44v0,-73,277,-125,368,-125xm265,-241v0,105,93,154,207,154v120,0,242,-55,366,-164r-1,-155v-89,-20,-174,-30,-255,-30v-138,0,-317,71,-317,195"},"b":{"d":"668,-915v258,0,453,212,453,469v0,258,-200,479,-455,479v-133,0,-245,-53,-336,-158r0,125r-211,0v-49,0,-74,-20,-74,-60v0,-33,22,-53,65,-60v7,-1,40,-2,99,-2r0,-1024v-65,0,-98,0,-101,-1v-41,-5,-61,-26,-61,-62v0,-39,24,-59,73,-59r211,0r-1,512v97,-106,209,-159,338,-159xm665,-88v185,0,338,-169,338,-353v0,-186,-149,-352,-336,-352v-182,0,-336,171,-336,352v0,187,150,353,334,353"},"c":{"d":"245,-429v0,202,152,342,353,342v131,0,254,-43,356,-141v41,-39,107,-29,107,32v0,33,-36,73,-107,121v-109,72,-229,108,-362,108v-265,0,-467,-196,-467,-462v0,-271,203,-475,473,-475v125,0,223,30,296,89r0,14v0,-50,19,-75,58,-75v43,0,64,41,64,75r-2,184v9,81,-90,101,-112,39v-9,-26,-14,-53,-26,-79v-36,-81,-168,-127,-283,-127v-207,0,-348,147,-348,355"},"d":{"d":"26,-441v0,-251,208,-474,455,-474v129,0,241,53,338,160r0,-391r-102,0v-41,-6,-61,-27,-61,-63v0,-39,26,-59,77,-59r208,0r-1,1146v63,0,96,0,100,1v43,7,65,26,65,59v0,41,-25,62,-74,62r-213,0r0,-126v-91,106,-204,159,-341,159v-252,0,-451,-220,-451,-474xm484,-88v184,0,334,-169,334,-353v0,-189,-147,-352,-333,-352v-191,0,-338,162,-338,352v0,190,149,353,337,353"},"e":{"d":"1028,-212v30,-1,59,31,59,60v0,91,-295,185,-446,185v-277,0,-506,-212,-506,-489v0,-249,224,-448,475,-448v294,0,478,205,474,503r-827,0v32,186,175,314,386,314v112,0,240,-33,330,-98v27,-19,46,-27,55,-27xm960,-519v-27,-147,-177,-266,-350,-265v-183,1,-313,110,-349,265r699,0"},"f":{"d":"316,-990v-4,-164,153,-278,322,-278v171,0,277,15,318,46v11,8,17,22,17,42v0,46,-20,66,-61,61v-138,-18,-229,-27,-274,-27v-108,-1,-198,56,-199,156r-2,102r277,0v37,0,71,21,71,60v0,42,-24,63,-71,63r-277,0r0,643r253,0v48,0,72,20,72,61v0,41,-24,61,-72,61r-552,0v-49,0,-74,-20,-74,-60v0,-41,25,-62,74,-62r177,0r1,-643v-86,-8,-229,32,-229,-61v0,-95,143,-53,229,-62r0,-102"},"g":{"d":"25,-458v0,-235,196,-446,432,-446v129,0,235,48,319,144r0,-114r211,0v29,0,48,5,55,16v38,34,18,103,-44,104r-103,0r0,803v6,180,-169,348,-349,340v-82,-4,-191,17,-246,-17v-25,-33,-27,-60,2,-89v30,-30,195,-14,244,-14v129,0,229,-94,229,-233r0,-191v-86,98,-192,147,-318,147v-236,0,-432,-215,-432,-450xm462,-131v172,0,313,-156,313,-327v0,-172,-141,-325,-312,-325v-174,0,-317,152,-317,325v0,176,140,327,316,327"},"h":{"d":"661,-916v181,0,337,128,337,306r0,488v49,0,79,1,89,3v38,7,57,26,57,57v0,41,-25,62,-75,62r-241,0v-5,0,-18,-5,-39,-16v-8,-11,-14,-25,-19,-43v5,-43,40,-64,106,-63r1,-483v12,-188,-252,-241,-382,-136v-24,19,-65,61,-124,128r-3,491v55,0,85,1,92,2v37,7,56,26,56,58v0,41,-25,62,-74,62r-268,0v-68,8,-87,-64,-55,-105v23,-11,67,-17,130,-17r0,-1024r-101,0v-42,-5,-63,-26,-63,-62v0,-40,25,-60,75,-60r211,0r0,478v97,-84,193,-126,290,-126"},"i":{"d":"493,-1270v76,0,154,73,154,149v0,56,-43,101,-99,101v-76,0,-154,-72,-154,-148v0,-56,43,-102,99,-102xm941,-122v83,-4,95,86,32,118r-32,4r-667,-3v-27,0,-40,-19,-40,-57v0,-41,23,-62,70,-62r259,0r1,-643r-175,0v-73,2,-94,-54,-57,-105v22,-13,41,-19,56,-19r297,0r-2,767r258,0"},"j":{"d":"574,-1270v82,0,154,68,154,151v0,57,-41,100,-98,100v-74,0,-153,-76,-153,-150v0,-56,41,-101,97,-101xm507,268v116,3,207,-102,207,-220r0,-809r-327,0v-70,3,-93,-55,-58,-105v21,-13,39,-19,55,-19r448,0r0,939v4,182,-140,335,-323,335r-212,0v-49,0,-74,-20,-74,-61v0,-43,25,-64,74,-63"},"k":{"d":"1082,-62v0,41,-26,62,-77,62r-265,0v-47,0,-71,-20,-71,-60v0,-41,28,-62,85,-62r-306,-316r-72,62r-1,376r-170,0v-56,3,-94,-57,-53,-104v19,-13,54,-19,103,-18r2,-1024r-101,0v-43,-6,-64,-27,-64,-63v0,-39,24,-59,71,-59r213,0r0,736r276,-233v-43,-2,-64,-23,-64,-60v0,-42,24,-63,73,-63r223,0v47,0,71,20,71,61v0,45,-40,66,-119,62r-296,251r380,392v62,0,95,0,98,1v43,6,64,26,64,59"},"l":{"d":"231,-60v0,-107,217,-55,330,-62r1,-1024r-172,0v-49,0,-73,-21,-73,-63v0,-39,24,-59,72,-59r294,0r-3,1146r257,0v49,0,73,20,73,60v0,41,-24,62,-73,62r-633,0v-49,0,-73,-20,-73,-60"},"m":{"d":"1103,-121v84,-2,123,3,123,59v0,41,-25,62,-74,62r-170,0r1,-659v2,-64,-48,-125,-107,-125v-55,0,-118,50,-190,149r-1,514v88,-1,116,-1,123,59v4,31,-29,62,-73,62r-171,0r0,-655v2,-64,-44,-129,-105,-129v-57,0,-121,50,-192,149r-1,514v83,-2,118,2,124,59v3,32,-30,62,-75,62r-221,0v-70,9,-95,-67,-52,-101v7,-13,40,-20,101,-20r1,-635v-81,1,-123,-2,-123,-60v0,-40,25,-60,74,-60r172,0r0,56v122,-120,301,-114,385,35v72,-79,145,-119,220,-119v123,0,232,113,232,237"},"n":{"d":"998,-121v87,-1,123,0,123,60v0,20,-13,39,-40,57v-76,9,-169,4,-252,4v-50,0,-75,-20,-75,-60v0,-41,41,-61,124,-61r1,-477v2,-112,-97,-186,-213,-186v-62,0,-117,18,-166,54v-27,19,-68,62,-124,128r0,481v54,0,84,0,89,1v38,7,57,26,57,58v0,41,-24,62,-73,62r-265,0v-37,0,-76,-19,-76,-60v0,-31,19,-51,57,-58v10,-2,40,-3,91,-3r0,-635v-83,1,-123,0,-123,-59v0,-41,24,-61,73,-61r171,0r0,97v86,-83,183,-125,290,-125v175,0,331,124,331,293r0,490"},"o":{"d":"608,-904v262,0,476,207,476,469v0,256,-221,468,-476,468v-255,0,-473,-212,-473,-468v0,-254,220,-469,473,-469xm608,-87v189,0,356,-158,356,-348v0,-191,-165,-349,-356,-349v-187,0,-353,161,-353,349v0,192,162,348,353,348"},"p":{"d":"621,-904v252,0,458,197,458,446v0,246,-212,450,-458,450v-135,0,-246,-49,-334,-147r-1,424r179,0v49,0,73,20,73,59v0,41,-24,61,-73,61r-348,0v-73,7,-94,-67,-54,-108v17,-8,52,-12,103,-12r1,-1023r-100,0v-43,-6,-64,-26,-64,-60v0,-40,25,-60,74,-60r210,0r1,116v89,-97,200,-146,333,-146xm621,-131v180,0,335,-146,335,-327v0,-177,-157,-325,-334,-325v-175,0,-335,150,-335,325v0,180,155,327,334,327"},"q":{"d":"1045,-814v0,60,-40,61,-124,60r-1,1023v79,0,127,4,145,12v42,48,20,108,-54,108r-346,0v-40,0,-73,-19,-75,-61v-5,-84,129,-53,209,-59r1,-421v-87,96,-199,144,-335,144v-251,0,-456,-199,-456,-450v0,-248,212,-446,459,-446v131,0,242,48,332,144r1,-114r170,0v49,0,74,20,74,60xm467,-131v178,0,333,-149,333,-327v0,-176,-159,-325,-334,-325v-180,0,-335,146,-335,325v0,185,152,327,336,327"},"r":{"d":"828,-895v61,0,216,79,216,138v0,43,-21,65,-63,65v-28,0,-111,-96,-151,-84v-63,0,-186,80,-368,239r-1,416r216,0v50,0,75,20,75,59v0,41,-25,62,-75,62r-470,0v-49,0,-73,-19,-73,-58v0,-85,129,-53,209,-59r1,-639r-100,0v-43,-6,-65,-26,-65,-59v0,-39,25,-59,75,-59r208,0r-1,181v151,-135,273,-202,367,-202"},"s":{"d":"619,-784v-105,-4,-247,42,-247,129v0,51,49,85,146,103r290,53v137,45,217,107,223,249v13,293,-493,355,-705,203v-3,12,-11,25,-25,38v-41,21,-69,7,-88,-30v-3,-11,1,-79,-5,-201v-4,-85,100,-96,116,-26v12,52,22,78,23,79v44,67,142,100,294,100v123,0,211,-35,254,-110v53,-92,-12,-151,-127,-189v-57,-19,-272,-34,-367,-71v-73,-29,-149,-106,-151,-199v-5,-252,433,-311,624,-182v23,-64,121,-44,113,37v-8,81,27,213,-60,213v-27,0,-46,-17,-55,-53v-30,-117,-120,-137,-253,-143"},"t":{"d":"1075,-98v-21,72,-209,115,-321,115v-235,0,-352,-84,-352,-253r0,-527v-80,-5,-204,25,-204,-61v0,-85,124,-56,204,-61r0,-222v0,-50,20,-75,59,-75v41,0,61,25,61,75r0,222r189,0v51,0,76,20,76,60v0,41,-25,62,-76,62r-189,0r0,527v0,97,78,145,234,145v60,0,221,-64,259,-68v37,-4,57,14,60,61"},"u":{"d":"920,-118v80,-1,121,2,124,57v5,96,-155,53,-244,62r0,-95v-107,85,-221,127,-342,127v-169,0,-283,-113,-282,-282r2,-506v-83,1,-120,-1,-123,-59v-5,-93,155,-51,242,-60r-2,625v-2,90,70,162,160,162v128,0,243,-57,345,-170r0,-498r-98,0v-43,-6,-64,-25,-64,-58v0,-41,24,-61,73,-61r209,0r0,756"},"v":{"d":"451,-814v0,62,-48,65,-136,59r281,634r14,0r277,-634v-53,0,-82,-1,-87,-2v-34,-7,-51,-26,-51,-57v0,-40,25,-60,74,-60r264,0v51,0,76,20,76,59v0,61,-57,65,-146,60r-331,755r-165,0r-337,-755v-60,0,-77,1,-77,1v-32,-4,-64,-21,-67,-59v5,-41,30,-61,75,-61r265,0v47,0,71,20,71,60"},"w":{"d":"367,-815v0,56,-34,61,-111,60r123,553r159,-462r124,0r158,461r121,-552v-74,1,-73,0,-105,-37v-16,-48,11,-82,72,-82r180,0v51,0,76,20,76,59v0,45,-33,65,-98,60r-165,753r-132,2r-166,-483r-168,483r-131,-2r-170,-753v-90,7,-125,-56,-76,-101v7,-12,24,-18,53,-18r183,0v49,0,73,20,73,59"},"x":{"d":"801,-755v-84,1,-126,-1,-126,-59v0,-40,26,-60,78,-60r220,0v50,0,75,20,75,59v0,40,-27,60,-82,60r-313,297r357,337v54,0,81,20,81,59v0,41,-24,62,-73,62r-223,0v-59,8,-102,-63,-55,-101v7,-13,41,-20,100,-20r-269,-255r-268,255v78,-1,120,4,120,59v0,41,-25,62,-75,62r-223,0v-49,0,-74,-20,-74,-60v0,-36,27,-56,82,-61r355,-337r-312,-297v-46,0,-80,-17,-81,-59v0,-40,24,-60,71,-60r231,0v32,-1,73,27,70,59v-6,59,-40,61,-125,60r229,218"},"y":{"d":"179,328v0,-76,61,-56,193,-59r133,-277r-370,-746v-89,4,-112,-67,-55,-111v61,-20,150,-9,226,-9v49,0,73,20,73,60v0,44,-37,64,-112,60r304,614r299,-614r-96,0v-39,-6,-58,-26,-58,-60v0,-40,25,-60,76,-60r220,0v49,0,74,20,74,59v0,39,-31,68,-85,61r-500,1023v87,-2,137,3,150,14v39,52,16,107,-54,106r-343,0v-50,0,-75,-20,-75,-61"},"z":{"d":"965,-212r-2,212r-776,0r4,-98r574,-657r-438,0r0,101v-4,76,-90,84,-116,25v-9,-75,-1,-164,-3,-245r737,0r-6,97r-579,656r484,0v-1,-65,-1,-99,-1,-100v6,-43,26,-64,60,-64v42,0,63,24,62,73"},"{":{"d":"562,-1088v-7,-126,228,-194,376,-194v41,0,72,9,91,28v-5,13,-49,23,-131,37v-111,19,-179,33,-179,128r0,332v0,43,-22,79,-65,108v-12,7,-53,27,-122,59v59,21,100,40,123,55v43,29,64,65,64,110r0,332v5,101,127,134,243,134v36,0,57,14,65,30v-11,20,-42,30,-93,30v-158,0,-372,-63,-372,-194r0,-332v2,-74,-95,-131,-171,-131v-26,0,-133,0,-133,-34v0,-17,29,-29,88,-34v144,-13,216,-58,216,-133r0,-331"},"|":{"d":"669,-81v0,23,-4,40,-11,50v-3,14,-16,24,-38,31v-34,-12,-51,-45,-51,-98r4,-1025v0,-27,16,-47,47,-59v33,12,49,45,49,98r0,1003"},"}":{"d":"304,-1282v141,-3,373,73,373,194r0,331v-10,86,119,128,230,133v52,3,77,19,77,34v-7,34,-103,33,-147,37v-71,7,-160,64,-160,128r0,332v0,59,-42,108,-125,149v-63,30,-155,45,-276,45v-27,0,-48,-10,-63,-30v9,-21,41,-31,96,-31v92,1,213,-45,213,-133r0,-332v0,-46,21,-83,63,-110v10,-7,51,-25,123,-55v-64,-28,-104,-48,-121,-59v-43,-29,-65,-65,-65,-108r0,-331v-9,-92,-66,-109,-178,-127v-83,-13,-127,-25,-132,-40v18,-23,47,-26,92,-27"},"~":{"d":"1074,-632v0,46,-148,171,-186,183v-35,11,-62,20,-83,20v-58,0,-129,-34,-211,-103v-82,-69,-135,-103,-158,-103v-64,2,-137,92,-182,133v-41,15,-87,-2,-87,-49v0,-16,10,-35,31,-57v165,-174,267,-195,446,-42v79,67,130,103,156,103v36,0,75,-24,118,-71v43,-47,75,-71,96,-71v40,0,60,19,60,57"},"\u00c7":{"w":1479},"\u00d6":{"w":1593},"\u00dc":{"d":"840,-1510v55,0,101,47,101,102v0,54,-50,101,-103,101v-57,0,-98,-44,-98,-101v0,-68,33,-102,100,-102xm425,-1510v55,0,101,45,101,102v0,53,-49,101,-102,101v-54,0,-101,-48,-101,-101v0,-57,45,-102,102,-102xm629,-93v159,0,290,-147,290,-305r2,-666v-65,-1,-142,10,-184,-16v-44,-43,-21,-111,57,-111r299,0v51,0,77,21,77,63v0,49,-41,70,-123,64r-3,666v4,237,-177,431,-412,431v-229,0,-417,-199,-416,-431r2,-666v-82,3,-123,-18,-123,-64v0,-42,25,-63,76,-63r300,0v51,0,76,20,76,61v0,74,-121,75,-204,66r-1,666v-5,155,134,305,287,305"},"\u00e7":{"w":1024},"\u00f6":{"w":1139},"\u00fc":{"d":"727,-1241v53,0,103,49,103,102v0,52,-50,105,-102,105v-54,0,-100,-49,-100,-103v0,-57,41,-104,99,-104xm318,-1241v51,0,95,53,95,104v0,54,-48,103,-100,103v-53,0,-100,-50,-100,-103v0,-59,45,-104,105,-104xm901,-126v81,-1,120,5,123,64v5,97,-158,54,-249,63r2,-94v-106,84,-219,126,-338,126v-166,0,-284,-123,-284,-289r0,-504v-75,0,-122,-5,-141,-16v-43,-45,-22,-113,54,-113r212,0r-1,632v-2,89,66,164,155,164v122,0,235,-57,340,-171r4,-496v-83,-4,-206,25,-206,-65v0,-43,26,-64,77,-64r251,0"},"\u20ac":{"d":"647,31v-287,0,-454,-188,-500,-451r-147,0r53,-102r82,0v-3,-24,-2,-116,0,-137r-135,0r53,-103r97,0v46,-251,206,-435,477,-440v121,-1,263,49,315,115r0,-115r111,0r0,346r-99,0v-31,-143,-170,-236,-327,-236v-177,0,-288,110,-332,330r461,0r-54,103r-419,0v-2,22,-3,113,0,137r348,0r-53,102r-285,0v41,227,159,340,354,340v128,0,263,-50,404,-149r55,94v-154,99,-254,166,-459,166","w":1229},"\u0131":{"w":569},"\u20a3":{"w":1139},"\u011e":{"w":1593},"\u011f":{"w":1139},"\u0130":{"w":569},"\u015e":{"w":1366},"\u015f":{"w":1024},"\u20a4":{"w":1139},"\u20a7":{"w":2240}}}));
			self.registered_cufon_font = true;
			console.log("Cufon font", self.row.get_raphael().getFont("Pseudo APL"));
		}
		return self.row.get_raphael().getFont("Pseudo APL");
	}
	,
	setup_hover: function() {
		var self = this;
		if(!self.hover_attributes) return;
		jQuery.each(self.rapha_elems, function(ri, relem) {
			jQuery(relem.node).mouseenter( function(e) {
				jQuery.each(self.rapha_elems, function(ai, anelem) {
					if(!anelem.data('actual_attr')) {
						var pre_glow_attribs = {};
						for(var k in self.hover_attributes)
							pre_glow_attribs[k] = anelem.attr(k);
						anelem.data('actual_attr', pre_glow_attribs);
					}
					anelem.attr(self.hover_attributes);
				});
			} );
		});
		jQuery.each(self.rapha_elems, function(ri, relem) {
			jQuery(relem.node).mouseleave( function(e) {
				jQuery.each(self.rapha_elems, function(ai, anelem) {
					anelem.attr(anelem.data('actual_attr'));
				});
			} );
		});
	}
	,
	draw_sequence: function(zoom_from_index, zoom_till_index) {
		var self = this, conf = self.configs;
		// shd seq be shown at all at this zoom level?
		var seq_shd_be_shown_at_this_zoom = false;
		if(zoom_till_index-zoom_from_index-1 <= self.get_min_rangediff())
			seq_shd_be_shown_at_this_zoom = true;
		if(seq_shd_be_shown_at_this_zoom == false) {
			if(self.rapha_elems) self.rapha_elems.seq_elem.hide();
			return;
		}
		// is this subsequence already in current seq_elem?
		var subseq_in_seq_elem = false;
		if(self.rapha_elems && self.seq_stop && self.seq_start <= zoom_from_index && self.seq_stop >= zoom_till_index)
			subseq_in_seq_elem = true;
		// make seq_elem if necessary
		var fontsize = self.row.seq_font_size, upi = self.row.units_per_index;
		if(!self.rapha_elems || subseq_in_seq_elem==false) {
			var ofont = self.getCufonFont(), seq = self.sequence;
			if(!self.rapha_elems) self.rapha_elems = {'ticks':[]};
			var seq_delta = 10, seq_start = zoom_from_index - seq_delta , seq_stop = zoom_till_index + seq_delta;
			if(seq_start < 0) seq_start = 0;
			if(seq_stop >= seq.length) seq_stop = seq.length-1;
			var starts = [];
			for(var si=seq_start; si <= seq_stop; si++) {
				if(1==0) { // this is for debugging
					var tick_y = 25, tick_fontsize = 5, textstyle = "px Courier";
					var t = rapha.text(si*upi, tick_fontsize+20, si)
						.attr("text-anchor", "start")
						.attr("font", tick_fontsize+textstyle);
					//var c = rapha.circle((si+0.5)*upi, 16, upi/2);
					self.rapha_elems.ticks.push(t);
					//self.rapha_elems.ticks.push(c);
				}
				//console.log(si,upi,ofont.face["units-per-em"],fontsize);
				starts.push((si+0.25)*upi*ofont.face["units-per-em"]/fontsize);
			}
			//console.log("Start drawing sequence", self.rapha_elems.seq_elem);
			if(self.rapha_elems.seq_elem) {
				self.rapha_elems.seq_elem.remove();
				self.rapha_elems.seq_elem = null;
				console.log("REMOVED earlier sequence element-----------------------------------");//return;
			}
			var seq_y = self.baseline;
			self.rapha_elems.seq_elem =
					self.row.get_raphael().print_precise(0, self.baseline, seq.substring(seq_start,seq_stop+1), ofont, fontsize, "middle", starts)
					.attr(self.seq_attributes);
			self.seq_start = seq_start;
			self.seq_stop = seq_stop;
			//console.log("Finish drawing sequence", self.seq_start, self.seq_stop);
		}
		xyz = self.rapha_elems.seq_elem;
		self.rapha_elems.seq_elem.show();
	}
	,
	draw_zoombar: function() {
		var self = this;
		//self.rapha = Raphael(self.divid, self.width, self.height);
		var minval = 0, maxval = self.row.num_slots-1;
		if(self.zoom_minval) minval = self.zoom_minval;
		if(self.zoom_maxval) maxval = self.zoom_maxval;
		console.log("Rendering zoom bar with range", minval, maxval, "width", self.width, "pixels/slot", self.px_per_index);
		var tickorder = [10000,10000,1000,100,10,1];
		if(self.px_per_index > 1) {}
		else if(self.px_per_index > .1) { tickorder.splice(tickorder.length-1, 1); }
		else if(self.px_per_index > 0.01) { tickorder.splice(tickorder.length-2, 2); }
		else if(self.px_per_index > 0.001) { tickorder.splice(tickorder.length-3, 3); }
		else if(self.px_per_index > 0.0001) { tickorder.splice(tickorder.length-4, 4); }
		var tickinfo = {100000:'$', 10000:'*', 1000:"|", 100:"!", 10:':', 1:'.'}
        jQuery('#'+self.divid).rangeSlider({
			arrows:false,
			bounds:{min:minval,max:maxval}, wheelMode:true,
			defaultValues:{min:minval,max:maxval}, step:1, valueLabels:'show',
			scales : [
				{
					first: function(val) { return val; },
					next: function(val) { return val + tickorder[tickorder.length-1]; },
					stop: function(val){ return false; },
					label: function(val) {
						for(var ti=0; ti<tickorder.length; ti++) {
							var atick = tickorder[ti];
							if(val%atick==0) {
								if(val!=0 ||ti == tickorder.length-1) return tickinfo[atick];
							}
						}
					},
					format: function(tickContainer, val, tickEnd) {
						for(var ti=0; ti<tickorder.length; ti++) {
							var atick = tickorder[ti];
							if(val%atick==0) {
								if(val!=0 || ti==tickorder.length-1) { tickContainer.addClass("rangeslider_tick_"+atick); }
							}
						}
					}
				}
			],
			range:{min:self.get_min_rangediff()+1, max:false},
			formatter:function(seq_index) {
				if(self.zoom_no_seq_increments)
					return seq_index;
				return seq_index + 1 ; // because indices are 1 onwards for biologists
			}
		});
		jQuery('#'+self.divid).bind("valuesChanging", function(e,data) {
			var thestart = data.values.min, thestop = data.values.max; // these will always be between bounds.min,max both inclusive
			if(thestart > thestop) { temp = thestart; thestart = thestop; thestop = temp; }
			//console.log("broadcast Zoom range", thestart, thestop);
			jQuery.Topic("ZoomEvent").publish({start:thestart, stop:thestop});
		});
	}
	,
	react_to_zoom_event: function() {
		if(self.type == "zoom")
			return;
	}
	,
	get_index_from_mouse_event: function(node, mev) {
		var self = this;
		var trackdiv = jQuery(node).parent().parent();
		var mo = trackdiv.offset();
		return self.current_zoom_indices[0] + Math.floor(
			(mev.pageX-mo.left+1)/trackdiv.width() * (1+self.current_zoom_indices[1]-self.current_zoom_indices[0])
		);
	}
	,
	setup_tooltip: function() {
		var self = this;
		if(!self.tooltip || !self.rapha_elems) return;
		jQuery.each(self.rapha_elems, function(ri,relem) {
			jQuery(relem.node).attr("title","dummy tooltip"); //this is essential
			jQuery(relem.node).qtip({
				content:"PDBe Sequence Painter",
				position: { target: "mouse", adjust: {x:5, y:5} },
				style: { 'classes': 'qtip-bootstrap qtip-shadow qtip-rounded' },
				events: {
					move: function(ev,api) {
						var seqindex = self.get_index_from_mouse_event(relem.node, ev.originalEvent);
						var newtip = self.get_tooltip_text(seqindex);
						var qapi = jQuery(relem.node).data('qtip');
    	           		qapi.options.content.text = newtip; // update content stored in options
						qapi.elements.content.text(newtip); // update visible tooltip content
					}
				}
			});
		} );
	}
	,
	get_tooltip_text: function(index) {
		var self = this;
		var newtip = "";
		if(!self.tooltip) return;
		if(self.tooltip.func)
			return self.tooltip.func(self, index);
		else if(self.tooltip.text)
			return painter.tooltip.text;
	}
});


Biojs.PDB_timelines_viewer = Biojs.extend ({
	opt: {}
 	,
	constructor: function(options) {
		var self = this;
		jQuery(options.target).html("PDB timelines loading...");
		self.options = options;
		self.pdbids = [];
		var entries_promise = null;
		if(options.entries.search_url) {
			entries_promise = jQuery.ajax({
				url:options.entries.search_url, crossDomain: 'true', type: 'GET',
				success: function(data) {
					jQuery.each(data.response.docs, function(di,adoc) {
						self.pdbids.push(adoc.pdb_id);
					});
					self.pdbids = jQuery.unique(self.pdbids);
				}
			});
		}
		else
			throw "how do i get PDB entries for timelines?!";
		entries_promise.done(function() {
			self.prepare_entry_objects();
		});
	}
	,
	render: function() {
		var self = this;
		var dims = {
			widths:  {left:0, middle:800, right:0},
			heights: {top:50, bottom:50, middle:{min:100,max:400}},
		};
		var lm = new Biojs.PDB_Sequence_Layout_Maker({
			target:  self.options.target,
			dimensions: dims,
			markups: {
				top: "Timeline of PDB entries and associated publications",
				bottom: "Send comments to swanand@ebi.ac.uk"
			},
			seq_font_size:16, // this should be uniform across rows & painters
			units_per_index:16, // fiddle this
			num_slots:self.years.length
		});
		var row_height = 200;
		lm.add_row(new Biojs.PDB_Sequence_Layout_Row({
			height:50,
			markups: {
				left:"Z",
				middle: [ // single painter for zoom row
					new Biojs.PDB_Sequence_Layout_Painter({
						height:row_height, width:dims.widths.middle,
						type:"zoom",
						zoom_minval:self.years[0]-1+1, zoom_maxval:self.years[self.years.length-1]+1,
						zoom_no_seq_increments: true
					})
				]
			}
		}));
		lm.add_row(new Biojs.PDB_Sequence_Layout_Row({
			height:row_height,
			markups: {
				middle: [
					new Biojs.PDB_Sequence_Layout_Painter({
						height:row_height, width:dims.widths.middle,
						baseline:30, y_height:50, // y_height here is max heigt a histogram bar can be
						type:"histogram",
						histo_x_pos:{start:10, stop:90}, // start and stop positions of histo bar on X axis in terms of percentages
						heights: self.histo_entries,
						shape_attributes: {fill:"blue", stroke:null},
						hover_attributes: {fill:"lightgreen"},
						tooltip:{ func: function(painter, index) {
							var yr = self.years[index];
							return yr + " : " + self.year_to_pids[yr].length + " entries : " + self.year_to_pids[yr];
						}}
					}),
					new Biojs.PDB_Sequence_Layout_Painter({
						height:row_height, width:dims.widths.middle,
						baseline:130, y_height:50, // y_height here is max heigt a histogram bar can be
						histo_x_pos:{start:25, stop:45}, // start and stop positions of histo bar on X axis in terms of percentages
						type:"histogram",
						heights: self.histo_pubs,
						shape_attributes: {fill:"green", stroke:null},
						hover_attributes: {fill:"lightgreen"},
						tooltip:{ func: function(painter, index) {
							var yr = self.years[index];
							return yr + ": " + self.year_to_pubs[yr].length + " citations";
						}}
					}),
					new Biojs.PDB_Sequence_Layout_Painter({
						height:row_height, width:dims.widths.middle,
						baseline:130, y_height:50, // y_height here is max heigt a histogram bar can be
						histo_x_pos:{start:55, stop:75}, // start and stop positions of histo bar on X axis in terms of percentages
						type:"histogram",
						heights: self.histo_pubs,
						shape_attributes: {fill:"red", stroke:null},
						hover_attributes: {fill:"lightgreen"},
						tooltip:{ func: function(painter, index) {
							var yr = self.years[index];
							return yr + ": " + self.year_to_pubs[yr].length + " citations";
						}}
					}),
				]
			}
		}));
	}
	,
	uniqueify_publications: function(key_to_pubs) {
		jQuery.each(key_to_pubs, function(year, pubs) {
			var newpubs = {};
			jQuery.each(pubs, function(bi, apub) {
				//console.log("SEE", year, apub);
				newpubs[ Biojs.publication_key(apub) ] = apub;
			});
			var upubs = [];
			for(var pk in newpubs)
				upubs.push(newpubs[pk]);
			key_to_pubs[year] = upubs;
		});
	}
	,
	prepare_histo_data: function() {
		var self = this;
		var pdb = Biojs.get_PDB_instance();
		self.year_to_pids = {}; // prepare year vs pdbids
		jQuery.each(self.pdbids, function(pi,pid) {
			var year = pdb.get_pdb_entry(pid).get_release_year();
			if(!self.year_to_pids[year])
				self.year_to_pids[year] = [];
			self.year_to_pids[year].push(pid);
		});
		self.year_to_pubs = {}; // prepare publications
		jQuery.each(self.pdbids, function(pi,pid) {
			jQuery.each(pdb.get_pdb_entry(pid).get_publications("associated"), function(bi,pub) {
				var yr = pub.journal_info.year;
				if(!yr) // can happen e.g. to be published
					return;
				if(!self.year_to_pubs[yr])
					self.year_to_pubs[yr] = [];
				self.year_to_pubs[yr].push(pub);
			});
			jQuery.each(["cited_by","appears_without_citation"], function(ci,ct) {
				jQuery.each(pdb.get_pdb_entry(pid).get_publications(ct), function(at,articles) {
					jQuery.each(articles, function(bi,pub) {
						var yr = pub.year;
						if(!yr) // can happen e.g. to be published
							return;
						if(!self.year_to_pubs[yr])
							self.year_to_pubs[yr] = [];
						self.year_to_pubs[yr].push(pub);
					});
				});
			});
		});
		// uniquiefy publications in each year
		self.uniqueify_publications(self.year_to_pubs);
		// find min, max years
		self.years = [];
		var start_year = 10000, end_year = 1000;
		jQuery.each([self.year_to_pubs,self.year_to_pids], function(di,yrd) {
			for(var year in yrd) {
				if(start_year > year)
					start_year = year;
				if(end_year < year)
					end_year = year;
			}
		});
		// set empty lists where there is no data for an year
		jQuery.each([self.year_to_pubs,self.year_to_pids], function(di,yrd) {
			for(var yr = start_year; yr <= end_year; yr++)
				if(!yrd[yr])
					yrd[yr] = [];
		});
		self.histo_entries = {}; self.histo_pubs = {};
		for(var yr = start_year; yr <= end_year; yr++) {
			self.histo_entries[yr-start_year] = self.year_to_pids[yr].length;
			self.histo_pubs[yr-start_year] = -1 * self.year_to_pubs[yr].length;
			self.years.push(yr);
		}
	}
	,
	prepare_entry_objects: function() {
		var self = this;
		var pdb = Biojs.get_PDB_instance(), promises = [];
		jQuery.each(self.pdbids, function(pi,pid) {
			promises.push(pdb.make_pdb_entry(pid));
		});
		Biojs.when_no_deferred_pending(promises)
		.done(function() {
			var valid_pdbids = [];
			jQuery.each(self.pdbids, function(pi,pid) {
				try {
					var entry = pdb.get_pdb_entry(pid);
					valid_pdbids.push(pid);
				}
				catch(e) {
					console.warn("Could not create entry", pid, "...ignoring");
				}
			});
			self.pdbids = valid_pdbids;
			self.prepare_publications_data();
		});
	}
	,
	prepare_publications_data: function() {
		var self = this;
		var pdb = Biojs.get_PDB_instance(), promises = [];
		jQuery.each(self.pdbids, function(pi,pid) {
			promises.push(pdb.get_pdb_entry(pid).make_publications());
		});
		Biojs.when_no_deferred_pending(promises)
		.done(function() {
			self.prepare_histo_data();
			self.render();
		});
	}
});
