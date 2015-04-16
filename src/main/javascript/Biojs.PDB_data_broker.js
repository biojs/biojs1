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
		return Handlebars.compile(jQuery("#"+template_id).html(), {strict:true});
	};
	Biojs.string_or_func_eval = function(markup) {
		if(!markup)
			return "";
		else if(typeof(markup) == typeof("astring"))
			return markup;
		else
			return markup();
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
		self.dimensions.widths.total_width = 0;
		for(var wt in self.dimensions.widths) {
			self.dimensions.widths.total_width += self.dimensions.widths[wt];
		}
		self.markups = options.markups ? options.markups : {top:"", bottom:""};
		self.id2row = {};
		jQuery("#"+self.target).html(self.get_markup());
	}
	,
	get_markup: function(which) {
		var self = this;
			console.log(self.dimensions.widths.total_width, "HIIIII");
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
			console.log(ret);
			return ret;
		}
	}
	,
	add_row: function(arow) {
		var self = this;
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
		self.id = options.id ? options.id : "row_"+Math.random().toString().replace(/^0./,"");
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
			return Biojs.string_or_func_eval(self.markups[layout]);
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
			console.log(ret);
			return ret;
		}
	}
	,
	toggle_waiting_display: function() {
		var self = this;
		//if(self.waiting)
			//jQuery("#"+self.id+" .cell_cover").css("opacity", "0");
		//else
			//jQuery("#"+self.id+" .cell_cover").css("opacity", "0.5");
		jQuery("#"+self.id+" .cell_cover").toggle();
		self.waiting = ! self.waiting;
	}
});


Biojs.PDB_Sequence_Layout_Painter = Biojs.extend ({
	opt: {}
 	,
	constructor: function(options) {
	}
});
