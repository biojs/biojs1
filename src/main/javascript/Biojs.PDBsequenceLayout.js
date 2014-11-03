/** 
 * This is the description of the PDBsequenceLayout component. It prepares PDBsequenceViewer's input data using PDBdatabroker.
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
 * @param {Object} options An object with the options for PDBsequenceLayout component.
 *    
 * @option {String} apiURL
 *    the PDBe API to consume
 *
 * @example 
 * var instance = new Biojs.PDBsequenceLayout({ apiURL:"http://www.ebi.ac.uk/pdbe/api" });	
 * 
 */


Biojs.PDBsequenceLayout = Biojs.extend (
/** @lends Biojs.PDBsequenceLayout# */
{
  /**
   *  Default values for the options
   *  @name Biojs.PDBsequenceLayout-opt
   */
	opt: { apiURL:"http://www.ebi.ac.uk/pdbe/api", divid:'your-divid', pdbid:'1cbs', entity:'1', width:800 },

	miniConstructor: function(options) {
		var self = this;
		Q.fcall( function() {
			return self.pdb.makeEntry(self.pdbid);
		} )
		.then( function(entry) {
			return entry.makeEntities();
		} )
		.then( function(entities) {
			return self.pdb.makeEntry(self.pdbid).makeStructuralMappings();
		} )
		.then( function(strmap) {
			return self.pdb.makeEntry(self.pdbid).makeStructuralCoverage();
		} )
		.then( function(strcover) {
			var entry = self.pdb.makeEntry(self.pdbid);
			var done = false;
			jQuery.each(entry.entities, function(ei,ent) {
				//if( ((typeof self.entity == 'string') && ent.getEid() != self.entity) || ((typeof self.entity == 'array') && -1 == jQuery.inArray(ent.getEid(), self.entity)) ) return;
				if(typeof self.entity == 'string') {
					if(ent.getEid() != self.entity) return;
					thedivid = self.divid;
					theheight = options.height; thewidth = self.width; theurl = options.clickURL;
				}
				else {
					if( (-1 == jQuery.inArray(ent.getEid(), self.entity)) && (-1 == jQuery.inArray(""+ent.getEid(), self.entity)) ) return;
					theindex = jQuery.inArray(ent.getEid(),self.entity);
					if(theindex==-1) theindex = jQuery.inArray(""+ent.getEid(),self.entity);
					thedivid = self.divid[theindex];
					theheight = options.height[theindex];
					thewidth = self.width[theindex];
					theurl = options.clickURL[theindex];
				}
				//if(ent.getEid() != self.entity) return;
				//if(! (ent.isType("protein") || ent.isType("RNA") || ent.isType("DNA") )) return;
				//if(! ent.isType("DNA") ) return; // TODO allow DNA RNA too!!
				var bestchain = null, chainids = [];
				jQuery.each(ent.instances, function(chi,chain) {
					//console.log(chain, chain.getAuthAsymId(), chain.getNumObservedResidues());
					if(bestchain == null || bestchain.getNumObservedResidues() < chain.getNumObservedResidues()) bestchain = chain;
					chainids.push( chain.getAuthAsymId() );
				});
				var obsranges = [];
				jQuery.each(bestchain.getObservedRanges(), function(ari,arange) {
					obsranges.push([arange.pdb_start-1, arange.pdb_end-1]);
				});
				var ttip = "Entry "+self.pdbid+" has Entity " + ent.getEid() + " (" + ent.getName() + ") " ;
				if(chainids.length > 1) ttip += " best";
				ttip += " modelled in chain " + bestchain.getAuthAsymId();
				new Biojs.PDBsequenceViewer({
					divid:thedivid, numrows:1, leftwidth:0, width:thewidth, rightwidth:0,
					tracks : [
						{
							height:theheight,
							painters:[
								{
									type:'Biojs.ObservedSequencePainter',
									observed:obsranges,
									seqlen:ent.getSequence().length,
									numIndicesInRow:ent.getSequence().length,
									midribAttrib:{fill:'#CCC',stroke:null},
									obsbarAttrib:{fill:'#666',stroke:null},
									tooltip:ttip,
									clickURL:theurl
								}
							]
						}
					]
				});
				done = true;
			});
			if(done == false) document.getElementById(self.divid).innerHTML = "Sorry - this could not be rendered.";
		} );
	},

	constructor: function (options) {
		var self = this;
		self.colormaker = Biojs.theOnlyPDBcolourFactory;
		jQuery.each(['apiURL','pdbid','divid','width','entity'], function(ki,kk) {
			self[kk] = options[kk];
		});
		self.pdb = Biojs.getPDBdatabroker(self.apiURL);
		if(options.mini == "yes") return self.miniConstructor(options);
		var successCallback = function() {
			console.log("API data to use:", datafromAPI);
			var entry = self.pdb.makeEntry(self.pdbid, datafromAPI);
			entry.makeEntities(datafromAPI);
			entry.makeUniprotPfamMappings(datafromAPI);
			entry.makeStructuralMappings(datafromAPI);
			entry.makeStructuralCoverage(datafromAPI);
			entry.makeSecondaryStructure(datafromAPI);
			var llwidth = 80, rlwidth = 10; // label widths
			var track_height = 25;
			var notdrawn = true;
			for(var ei=0; ei < entry.entities.length; ei++) {
				if(notdrawn == false) continue;
				var ent = entry.entities[ei];
				//console.log("Considering entity for track creation", ent.getEid(), ent.isType("protein"), self.entity);
				if(ent.isType("protein")==false || ent.getEid() != self.entity) continue;
				console.log("Will create tracks for entity", ent.getEid());
				notdrawn = false;
				var mytracks = [];
				var eseq = ent.getSequence(); var elen = eseq.length;
				//for(esi=0; esi<elen; esi++) eseq += 'A';
				mytracks.push({
					height:track_height, painters:[
						{type:'Biojs.ZoombarPainter', seqlen:elen, numIndicesInRow:elen,
							pixelwidth:self.width-rlwidth-llwidth, initleft:0, initright:elen-1, thumbwidth:0
						}
					]
				});
				console.log("Zoom track added");
				var ecol = self.colormaker.getDomainColor("entity",ent.getEid());
				mytracks.push({
					height:track_height, leftlabel:'Entity', painters:[
						{ type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen, // entity
							domains:[
								{
									ranges:[[0,elen-1]], ypos:{midpercent:80}, attribs:{fill:ecol,stroke:null},
									tooltip:{
										tfunc: function(tto, seqind) { // tto is this tooltip dictionary, seqind is seq index where tooltip is hovering
											return 'Entity ' + tto.entity.getEid() + ": Index " + (seqind+1) + ": Residue " + tto.entity.getSequence()[seqind];
										},
										entity: ent,
										text:'ent ' + ent.getEid()
									},
									glowOnHover:{fill:'silver'},
									fireResidueHoverEvent:function() { return {pdbid:ent.getPdbid(), entity:ent.getEid()}; }
									//listenResidueHoverEvent:function(data) {
									//	if(data.pdbid != ent.getPdbid() || data.entity != ent.getEid()) return false;
									//	return true;
									//}
								},
							]
						},
						{ type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen, // sequence of entity
							domains:[
								{
									ranges:[[0,elen-1]], ypos:{midpercent:80}, attribs:{fill:'none',stroke:'none'},
									tooltip:{text:'Sequence'}, sequence:eseq, seqattr:{stroke:'none',fill:'white'}
								},
							]
						}
					]
				});
				console.log("Entity track added");
				var pfdoms = self.makePfamDomsForEntity(ent)
				if(pfdoms.length > 0)
					mytracks.push({
						height:track_height, leftlabel:"PFAM", painters:[
							{ type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen, domains:pfdoms }
						]
					});
				console.log("Pfam track created");
				var unpdoms = self.makeUnpdomForEntity(ent);
				if(unpdoms.length > 0)
					mytracks.push({
						height:track_height, leftlabel:"UNP", painters:[
							{ type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen, domains:unpdoms }
						]
					});
				console.log("Unp track created");
				//try {
				for(var chi=0; chi < ent.instances.length; chi++) { // chain-based tracks begin...
					var chain = ent.instances[chi];
					// observed parts of chain
					mytracks.push({
						height:track_height, leftlabel:"Chain-"+chain.getAuthAsymId(), painters:[
							{ type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen,
								domains:self.makeObsDomsForChain(ent, chain).concat( [{
									ranges:[[0,elen-1]], ypos:{midpercent:80}, attribs:{fill:'none',stroke:'none'},
									tooltip:{text:'Sequence'}, sequence:eseq
								}] ),
							}
						]
					});
					console.log("Chain track created", chain.getAuthAsymId());
					// cath, scop domains
					var cathdoms = self.makeCathDomsForChain(ent,chain);
					if(cathdoms.length > 0)
						mytracks.push({
							height:track_height, leftlabel:"CATH", painters:[
								{ type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen, domains:cathdoms }
							]
						});
					var scopdoms = self.makeScopDomsForChain(ent,chain);
					if(scopdoms.length > 0)
						mytracks.push({
							height:track_height, leftlabel:"SCOP", painters:[
								{ type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen, domains:scopdoms }
							]
						});
					console.log("SCOP/CATH tracks created", chain.getAuthAsymId());
					// secondary structure
					if(chain.hasSecstrInfo()) {
						var helices = chain.getHelices(), sheets = chain.getSheets(), helixdoms = [], sheetdoms = [], sspainters = []; 
						if(helices)
							jQuery.each(chain.getHelices(), function(hi,helix) {
								helixdoms.push( {
									ranges:[[helix.pdb_start-1,helix.pdb_end-1]], ypos:{'helix':1}, attribs:{fill:self.colormaker.getSecstrColor("helix"),stroke:'none'}, glowOnHover:{fill:'silver'},
									tooltip:{text:'Helix'}
								} );
							});
						if(sheets)
							jQuery.each(sheets, function(shi,sheet) {
								var sheetranges = [];
								jQuery.each(sheet, function(stri,strand) {
									sheetranges.push( [strand.pdb_start-1, strand.pdb_end-1] );
								});
								sheetdoms.push( {
									ranges:sheetranges, ypos:{'strand':1}, attribs:{fill:self.colormaker.getSecstrColor("sheet"),stroke:'none'}, glowOnHover:{fill:'silver'},
									tooltip:{text:'Sheet'}
								} );
							});
						if(helixdoms.length > 0) sspainters.push( {type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen, domains:helixdoms} );
						if(sheetdoms.length > 0) sspainters.push( {type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen, domains:sheetdoms} );
						if(sspainters.length > 0) mytracks.push({ height:track_height, leftlabel:"SecStr", painters:sspainters });
						console.log("Secstr track created", chain.getAuthAsymId());
					}
				}
				//} catch(err) { console.log("Error stack", err.stack); }
				var adivid = self.divid+"_"+ei;
				jQuery("#"+self.divid).append("<div id='"+adivid+"'></div>");
				new Biojs.PDBsequenceViewer({divid:adivid, numrows:1, leftwidth:llwidth, width:self.width-llwidth-rlwidth, rightwidth:rlwidth, tracks:mytracks});
			}
		};
		if(self.apidata) { datafromAPI = self.apidata ; successCallback(); }
		else {
			var urlstr = '', apiURLs = [
				"/pdb/entry/summary/" + self.pdbid,
				"/pdb/entry/entities/" + self.pdbid,
				"/pdb/entry/residue_listing/" + self.pdbid,
				"/mappings/sequence_domains/entry/" + self.pdbid,
				"/mappings/structural_domains/entry/" + self.pdbid,
				"/pdb/entry/secondary_structure/" + self.pdbid,
				"/pdb/entry/polymer_coverage/" + self.pdbid
			];
			for(var ai=0; ai < apiURLs.length; ai++) urlstr += apiURLs[ai] + ",";
			urlstr = urlstr.replace(/,$/, "");
			jQuery.ajax({
				url: self.apiURL + '/callgroup/' + urlstr,
				data: {'varname':'datafromAPI', 'pdbid':self.pdbid},
				dataType: 'script',
				num_retries:3, try_index:0,
				crossDomain: 'true',
				type: 'GET', timeout:20000,
				success: successCallback,
				error: function(jqXHR, textStatus, errorThrown) {
					if(this.num_retries > this.try_index) {
						this.try_index += 1;
						console.log("Retrying API call " + this.url + " --- which failed due to " + textStatus + " --- " + errorThrown);
						jQuery.ajax(this); // http://stackoverflow.com/questions/10024469/whats-the-best-way-to-retry-an-ajax-request-on-failure-using-jquery
						return;
					}
					alert("There was an error in communicating with PDBe API - please report to pdbehelp@ebi.ac.uk");
					document.getElementById(self.divid).innerHTML = "Sorry, an error occurred.";
				}
			});
		}
	},

	makeObsDomsForChain: function(ent, chain) {
		var self = this;
		var obsranges = [], ret = [];
		jQuery.each(chain.getObservedRanges(), function(ri,rg) {
			obsranges.push([rg.pdb_start-1,rg.pdb_end-1]);
		});
		var chaincolor = self.colormaker.getChainColor(self.pdbid, ent.getEid(), chain.getAuthAsymId());
		ret.push( {
				ranges:obsranges, ypos:{midpercent:80}, attribs:{fill:chaincolor,stroke:null,opacity:0.3},
				tooltip:{
					tfunc: function(tto,resind) {
						var resstr = "";
						try {
							var resinfo = chain.getResidueListing()[""+(resind+1)];
							resstr = ": " + resinfo.resname + "-" + resinfo.resnum + resinfo.inscode;
						} catch(err) { resstr = " ?! No residue address for " + resind;}
						return 'Chain-' + chain.getAuthAsymId() + resstr;
					}
				},
				glowOnHover:{fill:'silver'},
				fireResidueHoverEvent:function() { return {pdbid:ent.getPdbid(), entity:ent.getEid(), chain:chain.getAuthAsymId()}; },
				listenResidueHoverEvent:function(data) {
					if(data.pdbid != ent.getPdbid() || data.entity != ent.getEid() || data.chain != chain.getAuthAsymId()) return false;
					return true;
				}
		});
		return ret;
	},

	makeCathDomsForChain: function(ent, chain) {
		var self = this;
		var cathranges = chain.getCathRanges(), ret = [];
		if(cathranges) {
			jQuery.each(cathranges, function(ci,cdata) {
				var cranges = [];
				jQuery.each( cdata.ranges, function(ri,rd) {
					cranges.push( [rd.pdb_start.residue_number-1, rd.pdb_end.residue_number-1] );
				} );
				var domcolor = self.colormaker.getDomainColor("CATH", cdata.cath_superfamily);
				ret.push( {
					ranges:cranges, ypos:{rangepercent:[10,90]}, attribs:{fill:domcolor,stroke:null,opacity:0.3},
					tooltip:{
						cath_superfamily: cdata.cath_superfamily,
						tfunc: function(tto,seqind) { return 'CATH ' + tto.cath_superfamily; }
					},
					glowOnHover:{fill:'silver'}, displayname:cdata.cath_superfamily
				} );
			} );
		}
		return ret;
	},

	makeScopDomsForChain: function(ent, chain) {
		var self = this;
		var scopranges = chain.getScopRanges(), ret = [];
		if(scopranges) {
			jQuery.each(scopranges, function(ci,cdata) {
				var cranges = [];
				jQuery.each( cdata.ranges, function(ri,rd) {
					cranges.push( [rd.pdb_start.residue_number-1, rd.pdb_end.residue_number-1] );
				} );
				var domcolor = self.colormaker.getDomainColor("SCOP", cdata.scop_family);
				ret.push( {
					ranges:cranges, ypos:{rangepercent:[10,90]}, attribs:{fill:domcolor,stroke:null},
					tooltip:{
						scop_family: cdata.scop_family,
						tfunc: function(tto,seqind) { return 'SCOP ' + tto.scop_family; }
					},
					glowOnHover:{fill:'silver'}, displayname:cdata.scop_family
				} );
			} );
		}
		return ret;
	},

	makePfamDomsForEntity: function(ent) {
		var self = this;
		var pfmap = ent.getPfamMapping(), pfdoms = [];
		for(pfid in pfmap) {
			var pfranges = [];
			if(pfid == null) continue;
			jQuery.each(pfmap[pfid], function(ui,ur) {
				if(ur.pdb_start == null || ur.pdb_end == null) return;
				pfranges.push([ur.pdb_start-1,ur.pdb_end-1]);
			});
			var domcolor = self.colormaker.getDomainColor("PFAM", pfid);
			pfdoms.push( {
				ranges:pfranges, ypos:{midpercent:80}, attribs:{fill:domcolor,stroke:null,opacity:0.3},
				tooltip: {
					pfam_id: pfid,
					tfunc: function(tto, seqind) { return 'Pfam '+tto.pfam_id; }
				},
				glowOnHover:{fill:'silver'}, displayname:pfid
			} );
		}
		return pfdoms;
	}, 
	makeUnpdomForEntity: function(ent) {
		var self = this;
		var unpmap = ent.getUnpMapping(), unpdoms = [];
		for(unp in unpmap) {
			var uranges = [];
			if(unp == null) continue;
			jQuery.each(unpmap[unp], function(ui,ur) {
				if(ur.pdb_start == null || ur.pdb_end == null) return;
				uranges.push([ur.pdb_start-1,ur.pdb_end-1]);
			});
			var domcolor = self.colormaker.getDomainColor("UNIPROT", unp);
			unpdoms.push( {
				ranges:uranges, ypos:{midpercent:80}, attribs:{fill:domcolor,stroke:null,opacity:0.3},
				tooltip:{
					unp_accession:unp,
					tfunc: function(tto,seqind) { return 'Uniprot '+tto.unp_accession; },
				},
				displayname:unp, glowOnHover:{fill:'silver'}
			} );
		}
		return unpdoms;
	}, 

  /**
   * Array containing the supported event names
   * @name Biojs.PDBsequenceLayout-eventTypes
   */
  eventTypes : [
	/**
	 * @name Biojs.PDBsequenceLayout#onClick
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
	 * @name Biojs.PDBsequenceLayout#onHelloSelected
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
