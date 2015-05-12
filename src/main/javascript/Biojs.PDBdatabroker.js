/** 
 * This is the description of the PDBdatabroker component.
 * This component is not graphical but provides a javascript representation of PDB objects.
 * 
 * @class
 * @extends Biojs
 * 
 * @author <a href="mailto:swanand@gmail.com">Swanand Gore</a>
 * @version 1.0.0
 * @category 0
 *
 * @requires <a href='http://code.jquery.com/jquery-1.7.2.js'>jQuery Core 1.7.2</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/jquery/jquery-1.7.2.min.js"></script>
 * 
 * @param {Object} options An object with the options for PDBdatabroker component.
 *    
 * @option {String} apiURL
 *    the PDBe API to consume
 *
 * @example 
 * var instance = new Biojs.PDBdatabroker({ apiURL:"http://www.ebi.ac.uk/pdbe/api" });	
 * 
 */


Biojs.PDBdatabroker = Biojs.extend (
/** @lends Biojs.PDBdatabroker# */
{
  /**
   *  Default values for the options
   *  @name Biojs.PDBdatabroker-opt
   */
	opt: {}
  
	constructor: function (options) {
		var self = this;
		self.apiURL = options.apiURL;
		self.entries = {};
	},

	makeEntry: function(pid, apidata) {
		var self = this;
		if(pid in self.entries) return self.entries[pid];
		return ajaxORapidataHelper(
			self.apiURL,
			"/pdb/entry/summary/"+pid,
			function(t) {
				self.entries[pid] = new Biojs.PDBdatabroker.Entry(t, self.apiURL);
			},
			apidata,
			function() { return self.entries[pid]; }
		);
	}, 

  /**
   * Array containing the supported event names
   * @name Biojs.PDBdatabroker-eventTypes
   */
  eventTypes : [
	/**
	 * @name Biojs.PDBdatabroker#onClick
	 * @event
	 * @param {function} actionPerformed A function which receives an {@link Biojs.Event} object as argument.
	 * @eventData {Object} source The component which did triggered the event.
	 * @eventData {string} type The name of the event.
	 * @eventData {int} selected Selected character.
	 * @example 
	 * instance.onClick(
	 *    function( objEvent ) {
	 *       alert("The character " + objEvent.selected + " was clicked.");
	 *    }
	 * ); 
	 * 
	 * */
	 "onClick",
	 
	/**
	 * @name Biojs.PDBdatabroker#onHelloSelected
	 * @event
	 * @param {function} actionPerformed A function which receives an {@link Biojs.Event} object as argument.
	 * @eventData {Object} source The component which did triggered the event.
	 * @eventData {string} type The name of the event.
	 * @eventData {int} textSelected Selected text, will be 'Hello' obviously.
	 * @example 
	 * instance.onHelloSelected(
	 *    function( objEvent ) {
	 *       alert("The word " + objEvent.textSelected + " was selected.");
	 *    }
	 * ); 
	 * 
	 * */
     "onHelloSelected"      
  ] 
});

function Callback(obj, method, preargs, postargs) {
	var me = this;
	me.run = function(args) {
		return method.apply(obj, preargs.concat(args.concat(postargs)));
	}
}

var ajaxORapidataHelper = function(apiurl, apipath, workfunc, apidata, resolvefunc) {
	var h = {
		apipath : apipath,
		varname : ("t" + Math.random()).replace(/\./g,""),
		callback : function(response, callOptions) {
			if(response != "APIdataAvailable") {
				eval("var t = " + h.varname + ";"); console.log("PDBdatabroker fetched " + h.apipath + " resulting in", t);
			}
			else { var t = apidata[h.apipath]; }
			h.realwork(t);
			if(response != "APIdataAvailable") d.resolve(resolvefunc(t));
		},
		realwork : workfunc
	};
	//console.log("SEEEE", apidata, h.apipath, apidata[h.apipath]);
	if(apidata && apidata[h.apipath]) { h.callback("APIdataAvailable"); return resolvefunc(apidata[h.apipath]); }
	var d = Q.defer();
	jQuery.ajax({
		url: apiurl + h.apipath,
		data: {varname:h.varname},
		dataType: 'script',
		crossDomain: true,
		type: 'GET', timeout:3000,
		success: h.callback,
		error: function(jqXHR, textStatus, errorThrown) {
			//alert("There was an error in communicating with API - please report to pdbehelp@ebi.ac.uk");
			d.reject("API call failed");
		}
	});
	return d.promise;
};

Biojs.PDBdatabroker.Entry = Biojs.extend ( {
	constructor: function(data, apiURL) {
		var self = this;
		for(k in data) { // assuming there is only 1 entry in the data
			self.pid = k;
			self.data = data[k][0];
			break;
		}
		self.apiURL = apiURL;
	},
	makeExperiments: function(apidata) {
		var self = this;
		if(self.expts) return self.expts;
		return ajaxORapidataHelper(
			self.apiURL,
			"/pdb/entry/experiment/"+self.pid,
			function(t) {
				self.expts = [];
				if(t[self.pid]) self.expts = t[self.pid];
			},
			apidata,
			function() { return self.expts; }
		);
	},
	makeEntities: function(apidata) {
		var self = this;
		if(self.entities) return self.entities;
		return ajaxORapidataHelper(
			self.apiURL,
			"/pdb/entry/entities/"+self.pid,
			function(t) {
				self.entities = [];
				jQuery.each(t[self.pid], function(ei,edata) {
					self.entities.push(new Biojs.PDBdatabroker.Entity(edata, self.apiURL, self.pid));
				});
			},
			apidata,
			function() { return self.entities; }
		);
	},
	makeXrayRefinementStats: function(apidata) {
		var self = this;
		if(self.refinestats) return self.refinestats;
		return ajaxORapidataHelper(
			self.apiURL,
			'/validation/xray_refine_data_stats/entry/' + self.pid,
			function(t) {
				if(t[self.pid]) self.refinestats = t[self.pid];
			},
			apidata,
			function() { return self.refinestats; }
		);
	},
	makeValidationPercentiles: function(apidata) {
		var self = this;
		if(self.valpercentiles) return self.valpercentiles;
		return ajaxORapidataHelper(
			self.apiURL,
			'/validation/global-percentiles/entry/' + self.pid,
			function(t) {
				if(t[self.pid]) self.valpercentiles = t[self.pid];
			},
			apidata,
			function() { return self.valpercentiles; }
		);
	},
	makeLigandMonomerListing: function(apidata) {
		var self = this;
		if(self.ligmono) return self.ligmono;
		return ajaxORapidataHelper(
			self.apiURL,
			'/pdb/entry/ligand_monomers/' + self.pid,
			function(t) {
				if(t[self.pid]) self.ligmono = t[self.pid];
			},
			apidata,
			function() { return self.ligmono; }
		);
	},
	makeGeomOutlierResiduesForRNAproteinDNA: function(apidata) {
		var self = this;
		if(self.geomOutlierResiduesForRNAproteinDNAadded==true) return;
		return ajaxORapidataHelper(
			self.apiURL,
			"/validation/protein-RNA-DNA-geometry-outlier-residues/entry/"+self.pid,
			function(t) {
				jQuery.each(t[self.pid], function(eid,einfo) {
					jQuery.each(einfo, function(chid,chinfo) {
						self.getEntity(eid).getInstanceFromAuthAsym(chid).addGeomOutlierResiduesForRNAproteinDNA(chinfo);
					});
				});
				self.geomOutlierResiduesForRNAproteinDNAadded = true;
			},
			apidata,
			function() { return self.entities; }
		);
	},
	makeRamaRotaListing: function(apidata) {
		var self = this;
		if(self.ramarotaAdded) return self.ramarotaAdded;
		return ajaxORapidataHelper(
			self.apiURL,
			"/validation/rama_sidechain_listing/entry/"+self.pid,
			function(t) {
				jQuery.each(t[self.pid], function(eid,einfo) {
					jQuery.each(einfo, function(chid,chinfo) {
						self.getEntity(eid).getInstanceFromAuthAsym(chid).addRamaRotaListing(chinfo);
					});
				});
				self.ramarotaAdded = true;
			},
			apidata,
			function() { return self.entities; }
		);
	},
	makeResidueListing: function(apidata, chain_id) {
		var self = this;
		var url = "/pdb/entry/residue_listing/"+self.pid;
		//if(chain_id) url += "/chain/" + chain_id;
		if(self.hasResidueListing()) return self.hasResidueListing(); // TODO when chain given
		return ajaxORapidataHelper(
			self.apiURL,
			url,
			function(t) {
				jQuery.each(t[self.pid].molecules, function(ei,einfo) {
					jQuery.each(einfo.chains, function(chi,chinfo) {
						self.getEntity(einfo.entity_id)
							.getInstanceFromAuthAsym(chinfo.chain_id)
							.addResidueListing(chinfo.residues);
					});
				});
				self.reslistAdded = true;
			},
			apidata,
			function() { return self.hasResidueListing(); }
		);
	},
	makeSiftsMappings: function(apidata) {
		var self = this;
		return ajaxORapidataHelper(
			self.apiURL,
			"/mappings/"+self.pid,
			function(t) {
				var tt = t[self.pid];
				self.sifts_mappings = tt;
			},
			apidata,
			function() { return self.sifts_mappings; }
		);
	},
	getSiftsMappings: function() {
		var self = this;
		return self.sifts_mappings;
	},
	getSiftsMappingsInstanceRanges: function(domtype, range_predicate) {
		var self = this;
		var mappings = self.getSiftsMappings();
		if(!mappings || !mappings[domtype]) return []; // do we have this domain type?
		var instances = [];
		jQuery.each(mappings[domtype], function(unp,mapdata) { // do we have instances in this entity?
			var ranges = [];
			jQuery.each(mapdata.mappings, function(ari,arange) {
				if(range_predicate(arange))
					ranges.push( [arange.start.residue_number, arange.end.residue_number] );
			});
			if(ranges.length > 0) // change here once instance id is available
				instances.push( {
					ranges:ranges, id:unp, description:mapdata.identifier
				} );
		});
		return instances;
	},
	getValidationPercentiles: function() {
		var self = this;
		return self.valpercentiles;
	},
	getTitle: function() {
		var self = this;
		return self.data.title;
	},
	getExperiments: function() {
		var self = this;
		return self.expts;
	},
	getEntity: function(eid) {
		var self = this;
		for(var ei=0; ei < self.entities.length; ei++) {
			if(self.entities[ei].getEid() == eid) return self.entities[ei];
		}
		return null;
	},
	makeValidationResidueSummary: function(apidata) {
		var self = this;
		return ajaxORapidataHelper(
			self.apiURL,
			"/validation/residuewise_outlier_summary/entry/" + self.pid,
			function(t) {
				if(!t || !t[self.pid])  {}
				else {
					self.setValidationResidueSummary(t[self.pid]);
				}
			},
			apidata,
			function(t) { return t; }
		);
	},
	makeBindingSites: function(apidata) {
		var self = this;
		return ajaxORapidataHelper(
			self.apiURL,
			"/pdb/entry/binding_sites/" + self.pid,
			function(t) {
				if(!t || !t[self.pid])  {}
				else {
					self.setBindingSitesInfo(t[self.pid]);
				}
			},
			apidata,
			function(t) { return t; }
		);
	},
	makeSecondaryStructure: function(apidata) {
		var self = this;
		return ajaxORapidataHelper(
			self.apiURL,
			"/pdb/entry/secondary_structure/" + self.pid,
			function(t) {
				if(!t || !t[self.pid])  {}
				else {
					jQuery.each(t[self.pid].molecules, function(ei,einfo) {
						jQuery.each(einfo.chains, function(chi,chinfo) {
							self.getEntity(einfo.entity_id)
								.getInstanceFromAuthAsym(chinfo.chain_id).addSecStr(chinfo.secondary_structure);
						});
					});
				}
			},
			apidata,
			function(t) { return t; }
		);
	},
	makeStructuralCoverage: function(apidata) {
		var self = this;
		// TODO!!! add a check for already initiated
		return ajaxORapidataHelper(
			self.apiURL,
			"/pdb/entry/polymer_coverage/"+self.pid,
			function(t) {
				if(t[self.pid]) {
					jQuery.each(t[self.pid].molecules, function(ei,einfo) {
						jQuery.each(einfo.chains, function(chi,chinfo) {
							self.getEntity(einfo.entity_id)
								.getInstanceFromAuthAsym(chinfo.chain_id).addStructuralCoverage(chinfo);
						});
					});
				}
			},
			apidata,
			function(t) { return t; }
		);
	},
	make2Dtopology: function(apidata, chain_id) {
		var self = this;
		var url = "/topology/entry/"+self.pid;
		//if(chain_id) url += "/chain/" + chain_id;
		return ajaxORapidataHelper(
			self.apiURL,
			url,
			function(t) {
				if(self.pid in t) {
					tt = t[self.pid];
					jQuery.each(tt, function(eid,einfo) {
						jQuery.each(einfo, function(chid,chinfo) {
							self.getEntity(eid).getInstanceFromAuthAsym(chid).addTopologyAnnot(chinfo);
						});
					});
				}
			},
			apidata,
			function() { return self.strmap; }
		);
	},
	getValidationResidueDataForChain: function(entity_id, pdb_chain_id) {
		var self = this;
		// do we have validation info for this chain at all?
		var vsum = self.getValidationResidueSummary(), vdata = null, elen = null;
		jQuery.each(vsum.molecules, function(ei,einfo) { // do we have the validation summary for this chain?
			if(einfo.entity_id != entity_id) return;
			elen = self.getEntity(einfo.entity_id).getLength();
			jQuery.each(einfo.chains, function(chi,chinfo) {
			//for(var chinfo in vsum[einfo.entity_id].chains) {
				if(chinfo.chain_id != pdb_chain_id) return;
				for(var mi=0; mi < chinfo.models.length; mi++) {
					var amodel = chinfo.models[mi];
					if((vdata==null) || (amodel.model_id == 1))
						{ modelid = amodel.model_id; vdata = amodel.residues; }
				}
			} );
		} );
		if(!vdata) { // abort when validation summary absent
			console.warn("No validation summary for this chain!");
			return vdata;
		}
		var vdata1 = {}; // convert to a more convenient data structure
		for(var vi=0; vi < vdata.length; vi++)
			vdata1[ vdata[vi].residue_number ] = vdata[vi];
		return vdata1;
	},
	hasSecstrInfo: function() {
		var self = this;
		return self.ssinfo;
	},
	getRamaRotaListing: function() {
		var self = this;
		return self.ramalist;
	},
	hasResidueListing: function() {
		var self = this;
		return self.reslistAdded;
	},
	getHelices: function() {
		var self = this;
		return self.ssinfo['helices'];
	},
	getSheets: function() {
		var self = this;
		return self.sheets;
	},
	getLigandMonomerListing: function() {
		var self = this;
		return self.ligmono;
	},
	isXrayEntry: function() {
		var self = this;
		return (self.data.experimental_method=="x-ray diffraction" && self.data.experimental_method_class=="x-ray");
	},
	hasXrayData: function() {
		var self = this;
		if(!self.expts) return false;
		if(!self.isXrayEntry()) return false;
		var data_available = false;
		for(var ei=0; ei < self.expts.length; ei++) {
			if(self.expts[ei].structure_factors_available)
				data_available = true;
		}
		return data_available;
	},
	setBindingSitesInfo: function(binfo) {
		var self = this;
		self.binding_site_info = binfo;
	},
	getBindingSitesInfo: function() {
		var self = this;
		return self.binding_site_info;
	},
	getValidationResidueSummary: function(rinfo) {
		var self = this;
		return self.val_residue_summary;
	},
	setValidationResidueSummary: function(rinfo) {
		var self = this;
		self.val_residue_summary = rinfo;
	}
} );

Biojs.PDBdatabroker.EntityInstance = Biojs.extend ( {
	constructor: function(data, apiURL, pid) {
		var self = this;
		self.apiURL = apiURL; self.pid = pid;
		self.eid = data.eid; self.chid = data.auth_asym_id;
		self.said = data.struct_asym_id;
	},
	addStructuralCoverage: function(info) {
		var self = this;
		self.observed = info.observed;
	},
	addTopologyAnnot: function(info) {
		var self = this;
		self.topology = info;
	},
	getObservedRanges: function() {
		var self = this;
		return self.observed;
	},
	getNumObservedResidues: function() {
		var self = this;
		var sum = 0;
		jQuery.each(self.observed, function(ari, arange) {
			sum += arange.end.residue_number - arange.start.residue_number + 1;
		});
		return sum;
	},
	get2Dtopology: function() {
		var self = this;
		return self.topology;
	},
	getScopRanges: function() {
		var self = this;
		try { return self.strmap.scop; }
		catch(e) { return null; }
	},
	getCathRanges: function() {
		var self = this;
		try { return self.strmap.cath; }
		catch(e) { return null; }
	},
	getStructAsymId: function() {
		var self = this;
		return self.said;
	},
	getEntityId: function() {
		var self = this;
		return self.eid;
	},
	getAuthAsymId: function() {
		var self = this;
		return self.chid;
	},
	addResidueListing: function(reslist) {
		var self = this;
		self.reslist = {};
		for(var ri=0; ri < reslist.length; ri++) { // make seq the key and reslist a dictionary
			self.reslist[ reslist[ri].residue_number ] = reslist[ri];
		}
	},
	addGeomOutlierResiduesForRNAproteinDNA: function(geomoutliers) {
		var self = this;
		self.geomOutlierRes = {};
		for(var mid in geomoutliers) {
			self.geomOutlierRes[mid] = {};
			for(otype in geomoutliers[mid]) {
				self.geomOutlierRes[mid][otype] = {};
				for(var ri=0; ri < geomoutliers[mid][otype].length; ri++) { // make seq the key
					self.geomOutlierRes[mid][otype][ geomoutliers[mid][otype][ri].seq ] = geomoutliers[mid][otype][ri];
				}
			}
		}
	},
	addRamaRotaListing: function(ramalist) {
		var self = this;
		self.ramalist = {};
		for(var mid in ramalist) {
			self.ramalist[mid] = {};
			for(var ri=0; ri < ramalist[mid].length; ri++) // make seq the key and reslist a dictionary
				self.ramalist[mid][ ramalist[mid][ri].seq ] = ramalist[mid][ri];
		}
	},
	addSecStr: function(ssinfo) {
		var self = this;
		self.ssinfo = ssinfo;
		self.sheets = {};
		if(self.ssinfo.strands)
			jQuery.each(self.ssinfo.strands, function(si, strand) {
				if(self.sheets[strand.sheet_id] == undefined) self.sheets[strand.sheet_id] = [];
				self.sheets[strand.sheet_id].push(strand);
			});
	},
	getRamaRotaListing: function() {
		var self = this;
		return self.ramalist;
	},
	getGeomOutlierResiduesForRNAproteinDNA: function() {
		var self = this;
		return self.geomOutlierRes;
	},
	hasSecstrInfo: function() {
		var self = this;
		return self.ssinfo;
	},
	getResidueListing: function() {
		var self = this;
		return self.reslist;
	},
	getHelices: function() {
		var self = this;
		return self.ssinfo['helices'];
	},
	getSheets: function() {
		var self = this;
		return self.sheets;
	}
} );


Biojs.PDBdatabroker.Entity = Biojs.extend ( {
	constructor: function(data, apiURL, pid) {
		var self = this;
		self.data = data;
		self.pid = pid;
		self.apiURL = apiURL;
		self.instances = [];
		jQuery.each(self.data.in_chains, function(ci,chid) {
			self.instances.push( new Biojs.PDBdatabroker.EntityInstance(
				{eid:self.getEid(), auth_asym_id:chid, struct_asym_id:self.data.in_struct_asyms[ci]},
			self.apiURL, self.pid) );
		});
	},
	is_protein_RNA_DNA: function() {
		var self = this;
		if(self.data.molecule_type == 'polypeptide(L)') return true;
		if(self.data.molecule_type == 'polyribonucleotide') return true;
		if(self.data.molecule_type == 'polydeoxyribonucleotide') return true;
		return false;
	},
	isType: function(type) {
		var self = this;
		if(self.data.molecule_type == 'polypeptide(L)' && type == "protein") return true;
		if(self.data.molecule_type == 'polyribonucleotide' && type == "RNA") return true;
		if(self.data.molecule_type == 'polydeoxyribonucleotide' && type == "DNA") return true;
		if(self.data.molecule_type == 'Water' && type == "water") return true;
		return false;
	},
	getPdbid: function() {
		var self = this;
		return self.pid;
	},
	getEid: function() {
		var self = this;
		return self.data.entity_id;
	},
	getName: function() {
		var self = this;
		return self.data.description;
	},
	getInstanceFromAuthAsym: function(chid) {
		var self = this;
		for(var ii=0; ii < self.instances.length; ii++) {
			if(self.instances[ii].getAuthAsymId() == chid) return self.instances[ii];
		}
		return null;
	},
	getLength: function() {
		var self = this;
		if( jQuery.isNumeric(self.data.length) ) return parseInt(self.data.length);
		return self.data.length;
	},
	getSequence: function() {
		var self = this;
		return self.data.sequence;
	},
	getEntry: function() {
		var self = this;
		return Biojs.getPDBdatabroker(self.apiURL).makeEntry(self.pid);
	},
	getBestModelledInstance: function() {
		var self = this;
		var bestchain = null;
		jQuery.each(self.instances, function(chi,chain) {
			//console.log(chain, chain.getAuthAsymId(), chain.getNumObservedResidues());
			if(bestchain == null || bestchain.getNumObservedResidues() < chain.getNumObservedResidues())
				bestchain = chain;
		});
		return bestchain;
	},
	getChains: function() {
		var self = this;
		return self.instances;
	},
	convert2int: function(numstr) {
		if(numstr==null) return numstr;
		if( jQuery.isNumeric(numstr) ) return parseInt(numstr);
		return numstr;
	}
} );

Biojs.getPDBdatabroker = function(apiurl) {
	if(!Biojs.allPDBdataBrokers) Biojs.allPDBdataBrokers = {};
	if(!Biojs.allPDBdataBrokers[apiurl])
		Biojs.allPDBdataBrokers[apiurl] = new Biojs.PDBdatabroker({apiURL:apiurl});
	return Biojs.allPDBdataBrokers[apiurl];
};



// dont make multiple ajax for same api call
// when an ajax call is in progress and another request comes in to make the same call, dont make the same call, and poll to check progress before calling callback

//YUI().use('get', function(Y) {
//Biojs.PDB_API_AJAX_Helper_single_yui = function(api_url, partial_api_urls, success_callback, error_callback) {
//	var varnames = {};
//	jQuery.each(partial_api_urls, function(pi,papi) {
//		var varname = 'data_from_api_'+ (""+Math.random()).replace("0.","");
//		varnames[papi] = varname;
//	});
//	var mark_absent_as_failed = function() {
//		jQuery.each(partial_api_urls, function(pi, papi) {
//			if(!(papi in Biojs.PDBajaxData))
//				Biojs.PDBajaxData[papi] = "failed";
//		});
//		return [any_in_progress, any_failed, any_absent];
//	};
//	var find_calls_status = function() {
//		var any_in_progress = [], any_failed = [], any_absent = [];
//		jQuery.each(partial_api_urls, function(pi, papi) {
//			if(!(papi in Biojs.PDBajaxData)) any_absent.push(papi);
//			else if(Biojs.PDBajaxData[papi] == "in_progress") any_in_progress.push(papi);
//			else if(Biojs.PDBajaxData[papi] == "failed") any_failed.push(papi);
//		});
//		return [any_in_progress, any_failed, any_absent];
//	};
//	var attach_successful_results = function() {
//		jQuery.each(partial_api_urls, function(pi, papi) {
//			//console.log("SEEEEE", papi, Biojs.PDBajaxData[papi]);
//			if(Biojs.PDBajaxData[papi] == "in_progress") {
//				try {
//					eval("var x = " + varnames[papi] + ";");
//				} catch(e) {
//					delete Biojs.PDBajaxData[papi];
//					return;
//				}
//				eval("var x = " + varnames[papi] + ";");
//				Biojs.PDBajaxData[papi] = x;
//				console.log("Successful call : ", papi, x);
//			}
//		});
//	};
//	var prepare_URLs = function() {
//		var urls = [];
//		jQuery.each(partial_api_urls, function(pi,papi) {
//			//console.log("check", papi, Biojs.PDBajaxData[papi], papi in Biojs.PDBajaxData);
//			if(papi in Biojs.PDBajaxData) return;
//			//console.log("prepare", papi, Biojs.PDBajaxData[papi], papi in Biojs.PDBajaxData);
//			Biojs.PDBajaxData[papi] = "in_progress";
//			urls.push(api_url + papi + "?varname=" + varnames[papi]);
//		});
//		return urls;
//	};
//	var trial_num = 0, num_trials = 3, poll_period = 2000;
//	var trial_func = function() {
//		var urls = prepare_URLs();
//		jQuery.each(urls, function(ui,url) {
//			console.log("Ajax call queued:", url);
//		});
//		Y.Get.js(urls, function (err, tx) {
//			if(err) {
//				Y.Array.each(err, function(error) {
//					var papi = error.request.url.replace(/.varname=.*/,"").replace(api_url, "");
//					console.warn("Error loading : ", papi);
//					delete Biojs.PDBajaxData[papi];
//				});
//			}
//			attach_successful_results();
//			var call_status = find_calls_status();
//			var any_in_progress = call_status[0], any_failed = call_status[1], any_absent = call_status[2];
//			//console.log(any_in_progress, any_failed, any_absent);
//			if(any_in_progress.length > 0)
//				window.setTimeout( trial_func , poll_period );
//			else if(any_absent.length > 0) {
//				trial_num += 1;
//				if(trial_num >= num_trials)
//					error_callback();
//				else
//					trial_func();
//			}
//			else if(any_failed.length > 0)
//				error_callback();
//			else
//				success_callback();
//		});
//	};
//	trial_func();
//};
//});

Biojs.when_no_deferred_is_pending = function(deferreds, all_resolved, any_rejected) {
	var num_pending = 0, num_rejected = 0, num_resolved = 0, timeout = 100;
	jQuery.each(deferreds, function(di,adef) {
		var state = adef.state();
		//console.log("SEE", adef);
		if(state == "pending") num_pending += 1;
		if(state == "rejected") num_rejected += 1;
		if(state == "resolved") num_resolved += 1;
	});
	//console.log("pending", num_pending, "rejected", num_rejected, "resolved", num_resolved);
	if(num_pending > 0) {
		window.setTimeout(function() {
			Biojs.when_no_deferred_is_pending(deferreds, all_resolved, any_rejected)
		}, timeout);
		return;
	}
	else if(num_rejected > 0)
		any_rejected();
	else
		all_resolved();
};
Biojs.PDB_API_AJAX_Helper_single = function(api_url, partial_api_urls, success_callback, error_callback) {
	var poll_period = 2000;
	if(!Biojs.PDBajaxData) Biojs.PDBajaxData = {};
	var find_calls_status = function() {
		var any_in_progress = [], any_failed = [], any_absent = [];
		jQuery.each(partial_api_urls, function(pi, papi) {
			if(!(papi in Biojs.PDBajaxData)) any_absent.push(papi);
			else if(Biojs.PDBajaxData[papi] == "in_progress") any_in_progress.push(papi);
			else if(Biojs.PDBajaxData[papi] == "failed") any_failed.push(papi);
		});
		return {progress:any_in_progress, failed:any_failed, absent:any_absent};
	};
	// if all calls already failed, just call error_callback
	//console.log(partial_api_urls, find_calls_status()['failed'].length, " FAILED OF ", partial_api_urls.length);
	if(find_calls_status()['failed'].length == partial_api_urls.length) {
		error_callback();
		return;
	}
	var create_deferreds = function() {
		var deferreds = [];
		jQuery.each(partial_api_urls, function(pi, papi) {
			if(papi in Biojs.PDBajaxData) return;
			console.log("AJAX_CALL_QUEUED", papi);
			Biojs.PDBajaxData[papi] = "in_progress";
			var jx = jQuery.ajax({
				url: api_url + papi, dataType: 'json', crossDomain: 'true', type: 'GET',
				success: function(data, textStatus, jqXHR) { Biojs.PDBajaxData[papi] = data; }
			});
			jx.fail( function(jqXHR, textStatus, errorThrown) {
				delete Biojs.PDBajaxData[papi];
			});
			deferreds.push(jx);
		});
		return deferreds;
	};
	var mark_absent_as_failed = function() {
		jQuery.each(partial_api_urls, function(pi, papi) {
			if(!(papi in Biojs.PDBajaxData)) {
				Biojs.PDBajaxData[papi] = "failed";
				console.log("MARK_FAILED", papi);
			}
		});
	};
	var trial_num = 0, max_trials = 3;
	var check_deferreds = function() {
		console.log("Ajax_trial", trial_num);
		Biojs.when_no_deferred_is_pending(create_deferreds(),
			function() {
				var poll_calls = function() {
					var call_status = find_calls_status();
					var any_in_progress = call_status['progress'], any_failed = call_status['failed'], any_absent = call_status['absent'];
					console.log("Ajax call status: absent, failed, in_progress :", any_absent, any_failed, any_in_progress);
					if(any_in_progress.length > 0 || any_absent.length > 0) {
						console.log("Polling API calls in progress.", any_in_progress, any_absent);
						window.setTimeout( poll_calls , poll_period );
					}
					else if(any_failed.length > 0)
						error_callback();
					else
						success_callback();
				};
				poll_calls();
			},
			function() {
				console.log("At least one call failed...");
				trial_num ++;
				if(trial_num >= max_trials) {
					mark_absent_as_failed();
					error_callback();
				}
				else
					check_deferreds();
			}
		);
	};
	check_deferreds();
	return;
//	for(int trial=0; trial < 3; trial++) {
//		create deferreds for failed or absent calls
//		when deferreds are resolved
//			call 
//						Biojs.PDBajaxData[papi] = "failed";
//	}
//	var when_success = function() { // success in all ajax requestes created above
//		var polling_callback = function() {
//			// do we have any calls in progress?
//			var call_status = count_call_status();
//			var in_progress = call_status[0], failed = call_status[1], num_absent = call_status[2];
//			if(any_failed.length > 0) {
//				console.error("Polling API calls. Failed!", any_failed);
//				error_callback();
//			}
//			else if(any_in_progress.length > 0) { // requests not created above, but already ongoing due to previous calls to this function
//				console.log("Polling API calls in progress.", any_in_progress);
//				window.setTimeout( polling_callback , poll_period );
//			}
//			else {
//				console.log("Polling API calls DONE.");
//				success_callback();
//			}
//		};
//		polling_callback();
//	};
//	var when_failed = function() { // failure in any of the ajax requests created above
//		console.log("CHECK", this.try_index , this.num_retries);
//		if(this.try_index >= this.num_retries) {
//			error_callback();
//			return;
//		}
//		else check_deferreds();
//	};
//	var check_deferreds = function() {
//		console.log("DEFERREDS-hiiiiiiiiiiiii", deferreds.length);
//		jQuery.when.apply(window, deferreds).then( when_success, when_failed );
//	};
//	check_deferreds();
};

Biojs.PDB_API_AJAX_Helper_group = function(api_url, partial_api_urls, success_callback, error_callback) {
	// un-issued partials
	var callgroup_url = api_url + "/callgroup/", callgroup = [];
	var ajax_timeout = 2000, poll_period = 1000;
	jQuery.each(partial_api_urls, function(pi, papi) {
		if(!(papi in Biojs.PDBajaxData)) {
			console.log("AJAX_CALL_QUEUED", papi);
			Biojs.PDBajaxData[papi] = "in_progress";
			callgroup.push(papi);
		}
	});
	var polling_callback = function() {
		// do we have any calls in progress?
		var any_in_progress = [], any_failed = [];
		jQuery.each(partial_api_urls, function(pi, papi) {
			if(Biojs.PDBajaxData[papi] == "in_progress") any_in_progress.push(papi);
			if(Biojs.PDBajaxData[papi] == "failed") any_failed.push(papi);
		});
		if(any_failed.length > 0) {
			console.error("Polling API calls. Failed!", any_failed);
			error_callback();
		}
		else if(any_in_progress.length > 0) {
			console.log("Polling API calls progress.", any_in_progress);
			window.setTimeout( polling_callback , poll_period );
		}
		else success_callback();
	};
	if(callgroup.length == 0) {
		polling_callback();
		return;
	}
	var varname = 'data_from_api_'+ (""+Math.random()).replace("0.","");
	callgroup_url += callgroup.join(",");
	jQuery.ajax({
		url: callgroup_url,
		data: {'varname':varname},
		dataType: 'script',
		num_retries:3, try_index:0,
		crossDomain: 'true',
		type: 'GET', timeout:ajax_timeout,
		success: function(data, textStatus, jqXHR) {
			eval("var x = " + varname + ";");
			jQuery.each(callgroup, function(pi, papi) {
				Biojs.PDBajaxData[papi] = "failed";
			});
			for(var k in x)
				Biojs.PDBajaxData[k] = x[k];
			polling_callback();
		},
		error: function(jqXHR, textStatus, errorThrown) {
			if(this.num_retries > this.try_index) {
				this.try_index += 1;
				console.warn("Retrying API call " + this.url + " --- which failed due to " + textStatus + " --- " + errorThrown);
				jQuery.ajax(this); // http://stackoverflow.com/questions/10024469/whats-the-best-way-to-retry-an-ajax-request-on-failure-using-jquery
				return;
			}
			jQuery.each(callgroup, function(pi, papi) {
				Biojs.PDBajaxData[papi] = "failed";
			});
		}
	});
};

Biojs.PDB_API_AJAX_Helper_default = function(api_url, partial_api_urls, success_callback, error_callback) {
	// un-issued partials
	var ajax_timeout = 1000;
	var callgroup_url = api_url + "/callgroup/" + partial_api_urls.join(",");
	var varname = 'data_from_api_'+ (""+Math.random()).replace("0.","");
	jQuery.ajax({
		url: callgroup_url,
		data: {'varname':varname},
		dataType: 'script',
		num_retries:3, try_index:0,
		crossDomain: 'true',
		type: 'GET', timeout:ajax_timeout,
		success: function(data, textStatus, jqXHR) {
			eval("var x = " + varname + ";");
			for(var k in x)
				Biojs.PDBajaxData[k] = x[k];
			success_callback();
		},
		error: function(jqXHR, textStatus, errorThrown) {
			if(this.num_retries > this.try_index) {
				this.try_index += 1;
				console.warn("Retrying API call " + this.url + " --- which failed due to " + textStatus + " --- " + errorThrown);
				jQuery.ajax(this); // http://stackoverflow.com/questions/10024469/whats-the-best-way-to-retry-an-ajax-request-on-failure-using-jquery
				return;
			}
			error_callback();
		}
	});
};

Biojs.PDB_API_AJAX_Helper = Biojs.PDB_API_AJAX_Helper_single;


function test_ajax_helper() {
	var batch1 = [
		"/pdb/entry/summary/1cbs",
		"/pdb/entry/molecules/1cbs",
	];
	var batch2 = [
		"/pdb/entry/summary/1tcy",
		"/pdb/entry/citations/1cbs",
	];
	Biojs.PDB_API_AJAX_Helper(
		//"http://puck.ebi.ac.uk:10000",
		"http://wwwdev.ebi.ac.uk/pdbe/api",
		batch1,
		function() {
			console.log("finished batch 1", Biojs.PDBajaxData);
			jQuery.each(jQuery("script"), function(ni,node) {
				console.log("HIIIIIIIIIIIIIIIiiiI", node);
				console.log("HIIIIIIIIIIIIIIIiiiI", node.src, jQuery(node).html());
			});
		},
		function() { console.log("failed batch 1"); }
	);
	Biojs.PDB_API_AJAX_Helper(
		//"http://puck.ebi.ac.uk:10000",
		"http://wwwdev.ebi.ac.uk/pdbe/api",
		batch2,
		function() { console.log("finished batch 2", Biojs.PDBajaxData); },
		function() { console.log("failed batch 2"); }
	);
}
