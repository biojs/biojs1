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

Biojs.PDB.jasmine_tests = function() {
	describe("PDB data broker", function() {
		it("is always defined if you include necessary javascript", function() {
			expect(Biojs.PDB).toBeDefined();
		});
		it("is instantiated with a default API URL, but can take API URL as parameter too", function() {
			var pdb_dev = new Biojs.PDB({api_url:"http://wwwdev.ebi.ac.uk/pdbe/api"});
			var pdb = new Biojs.PDB();
			expect(pdb).not.toBeNull();
			expect(pdb_dev).not.toBeNull();
			expect(pdb_dev).not.toBe(pdb);
		});
		it("has a unique instance per API URL", function() {
			var pdb             = Biojs.get_PDB_instance();
			var another_pdb     = Biojs.get_PDB_instance();
			var yet_another_pdb = Biojs.get_PDB_instance();
			expect(pdb).toEqual(another_pdb);
			expect(pdb).toEqual(yet_another_pdb);
		});
		it("throws exception if multiply instantiated off the same URL", function() {
			var pdb = Biojs.get_PDB_instance();
			var pdb1 = Biojs.get_PDB_instance();
			var instantiate_again = function() { var pdb2 = Biojs.PDB(); }
			expect(instantiate_again).toThrow();
		});
		it("can create unique PDB_Entry object with expected title", function(async_tag) {
			var pdb = Biojs.get_PDB_instance();
			// same promise for multiple make-entry calls
			var x = pdb.make_pdb_entry("1aac");
			var y = pdb.make_pdb_entry("1aac");
			expect(x).toBe(y);
			// unique entry object with correct title
			var pdbid = "1cbs", entry_title = "CRYSTAL STRUCTURE OF CELLULAR RETINOIC-ACID-BINDING PROTEINS I AND II IN COMPLEX WITH ALL-TRANS-RETINOIC ACID AND A SYNTHETIC RETINOID";
			pdb.make_pdb_entry(pdbid)
			.done(function(entry) {
				expect(entry.get_title()).toEqual(entry_title);
				var same_entry = pdb.get_pdb_entry(pdbid);
				expect(entry).toBe(same_entry);
				async_tag();
			})
			.fail(function() {
				expect(true).toBe(false);
				async_tag();
			});
		});
		it("can create expected PDB_Entity-s inside the PDB_Entry object", function(async_tag) {
			var pdbid = "2qcu", expected_num_ents = 9;
			var pdb = Biojs.get_PDB_instance();
			pdb.make_pdb_entry(pdbid)
			.done(function(entry) {
				entry.make_entities()
				.done(function(entities) {
					var same_ents = entry.get_entities();
					expect(entities).toBe(same_ents);
					var num_ents = 0;
					for(var eid in entities)
						num_ents += 1;
					expect(num_ents).toEqual(expected_num_ents);
					async_tag();
				});
			});
		});
		it("can create entity objects that provide info about uniprot & pfam mappings", function(async_tag) {
			var pdbid = "2qcu";
			var pdb = Biojs.get_PDB_instance();
			pdb.make_pdb_entry(pdbid)
			.done(function(entry) {
				entry.make_entities()
				.done(function(entities) {
					jQuery.each(entities, function(eid,ent) {
						if(!ent.is_protein())
							return;
						ent.make_sequence_mappings()
						.done(function() {
							for(var dt in {"Pfam":1, "UniProt":1}) {
								var domains = ent.get_sequence_mappings(dt);
								expect(1).toEqual(domains.length);
								expect(1).toEqual(domains[0].ranges.length);
							}
							async_tag();
						});
					});
				});
			});
		});
		it("can create expected number of instances of entities", function(async_tag) {
			var pdbid = "2qcu", expected_num_inst = {1:2, 2:6, 3:4, 4:2, 5:2, 6:3, 7:30, 8:2, 9:2};
			var pdb = Biojs.get_PDB_instance();
			pdb.make_pdb_entry(pdbid)
			.done(function(entry) {
				entry.make_entities()
				.done(function(entities) {
					var promises = [];
					jQuery.each(entities, function(eid,ent) {
						promises.push(ent.make_instances());
					});
					Biojs.when_no_deferred_pending(promises)
					.done(function() {
						var num_inst = {};
						jQuery.each(entities, function(eid,ent) {
							var same_instances = ent.get_instances();
							var instances = ent.get_instances();
							expect(instances).toBe(same_instances);
							num_inst[ent.entity_id] = instances.length;
						});
						expect(num_inst).toEqual(expected_num_inst);
						async_tag();
					});
				});
			});
		});
		it("can create chain objects that provide info about cath, scop", function(async_tag) {
			var pdbid = "1cbs";
			var pdb = Biojs.get_PDB_instance();
			pdb.make_pdb_entry(pdbid)
			.done(function(entry) {
				entry.make_entities()
				.done(function(entities) {
					jQuery.each(entities, function(eid,ent) {
						ent.make_instances()
						.done(function(instances) {
							var same_instances = ent.get_instances();
							if(!ent.is_protein())
								return;
							jQuery.each(instances, function(ii,inst) {
								inst.make_sequence_mappings()
								.done(function() {
									expect(instances).toBe(same_instances);
									for(var dt in {"SCOP":1, "CATH":1}) {
										var domains = inst.get_sequence_mappings(dt);
										expect(1).toEqual(domains.length);
										expect(1).toEqual(domains[0].ranges.length);
									}
									async_tag();
								});
							});
						});
					});
				});
			});
		});
		it("can create chain objects that provide info about residue-modelling, residue-validation, binding site, sec-str", function(async_tag) {
			var pdbid = "1aac";
			var pdb = Biojs.get_PDB_instance();
			pdb.make_pdb_entry(pdbid)
			.done(function(entry) {
				entry.make_entities()
				.done(function(entities) {
					jQuery.each(entities, function(eid,ent) {
						ent.make_instances()
						.done(function(instances) {
							if(!ent.is_protein_DNA_RNA())
								return;
							jQuery.each(instances, function(ii,inst) {
								Biojs.when_no_deferred_pending([
									inst.make_structural_features(),
									inst.make_validation_info()
								])
								.done(function() {
									var bsites = inst.get_binding_sites();
									var secstr = inst.get_secondary_structure();
									var reslist = inst.get_residue_listing();
									var valinfo = inst.get_validation_info();
									expect(1).toEqual(bsites.length);
									expect(4).toEqual(bsites[0].residue_numbers.length);
									expect(1).toEqual(secstr.helices.length);
									expect(11).toEqual(secstr.strands.length);
									expect(105).toEqual(reslist.length);
									expect(6).toEqual(valinfo.length);
									async_tag();
								});
							});
						});
					});
				});
			});
		});
	});
};
