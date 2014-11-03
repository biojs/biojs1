
Biojs.PDBvalidSeqviewer = Biojs.extend ( {
	constructor: function(options) {
		var self = this;
		for(k in options) self[k] = options[k];
		self.colormaker = Biojs.theOnlyPDBcolourFactory;
		self.chainids = {model:'1', chain:'A', entity:'1'};
		self.setupPDBdatabrokerAndLaunch();
	},
	setupPDBdatabrokerAndLaunch: function() {
		var self = this;
		self.pdb = new Biojs.getPDBdatabroker(self.apiURL);
		var successCallback = function() {
			self.entry = self.pdb.makeEntry(self.pdbid, apidata);
			self.entry.makeEntities(apidata); 
			self.entry.makeStructuralCoverage(apidata);
			self.entry.makeResidueListing(apidata);
			self.entry.makeRamaRotaListing(apidata);
			self.entry.makeGeomOutlierResiduesForRNAproteinDNA(apidata);
			self.draw();
		};
		if(self.apidata) { apidata = self.apidata; successCallback(self.apidata) ; return; }
		var urlstr = '', apiURLs = [
			"/pdb/entry/summary/" + self.pdbid,
			"/pdb/entry/entities/" + self.pdbid,
			"/pdb/entry/polymer_coverage/" + self.pdbid,
			"/pdb/entry/residue_listing/" + self.pdbid,
			"/validation/rama_sidechain_listing/entry/" + self.pdbid,
			"/validation/protein-RNA-DNA-geometry-outlier-residues/entry/" + self.pdbid
		];
		for(var ai=0; ai < apiURLs.length; ai++) urlstr += apiURLs[ai] + ",";
		urlstr = urlstr.replace(/,$/, "");
		jQuery.ajax({
			url: self.apiURL + '/callgroup/' + urlstr,
			data: {'varname':'apidata'},
			dataType: 'script',
			crossDomain: 'true',
			type: 'GET',
			success: successCallback,
			error: function(jqXHR, textStatus, errorThrown) {
				alert("There was an unidentified error in obtaining data from PDBe API - please report to pdbehelp@ebi.ac.uk");
				document.getElementById(self.raphadivid).innerHTML = "Error!";
			}
		});
	},
	draw: function() {
		var self = this;
		self.entity = null;
		jQuery.each(self.entry.entities, function(ei,ent) {
			if( !self.entity && (ent.isType("protein") || ent.isType("RNA") || ent.isType("DNA")) ) 
				self.entity = ent;
		});
		if(self.entity == null) {
			console.warn("No suitable entity found to render in validation sequence viewer for entry " + self.entry.getPdbid());
		}
		var eseq = self.entity.getSequence(); var elen = eseq.length;
		self.tracks = [ {
			height:25, painters:[
				{type:'Biojs.ZoombarPainter', seqlen:elen, numIndicesInRow:elen,
					pixelwidth:self.width*0.8, initleft:0, initright:elen-1, thumbwidth:20
				}
			]
		} ];
		self.addEntityTrack();
		jQuery.each(self.entity.instances, function(ci,chain) {
			self.chain = chain;
			self.addChainTrack();
		});
		new Biojs.PDBsequenceViewer({
			divid:self.divid, numrows:1, leftwidth:self.width*0.1, width:self.width*0.8, rightwidth:self.width*0.1, tracks:self.tracks
		});
	},
	addChainTrack: function() {
		var self = this;
		var chcol = self.colormaker.getChainColor(self.entity.getPdbid(), self.entity.getEid(), self.chain.getAuthAsymId());
		var eseq = self.entity.getSequence(); var elen = eseq.length;
		for(mid in self.chain.getRamaRotaListing()) { self.model = mid; break; }
		var rama = self.chain.getRamaRotaListing()[self.model], ramabaloons = []; // make rama/rota outier baloon data
		var geomout = self.chain.getGeomOutlierResiduesForRNAproteinDNA()[self.model];
		jQuery.each(self.chain.getResidueListing(), function(ri,rd) {
			if(!rama[rd.seq]) return;
			if(!rama[rd.seq].phi || !rama[rd.seq].psi) return;
			if(rama[rd.seq].rota=="OUTLIER") {
				ramabaloons.push( {at:rd.seq, ypos:{fromtop:70}, size:5, shape:"square", attribs:{stroke:"red",fill:"red"}, glowOnHover:{stroke:'silver',fill:'silver'}, tooltip:'Rota outlier'} );
			}
			var fillcolor = "yellow", bshape = "circle";
			if(rama[rd.seq].rama=="OUTLIER" || rama[rd.seq].rama=="Allowed") {
				var thecolor = {OUTLIER:"red",Allowed:"yellow"}[rama[rd.seq].rama];
				ramabaloons.push( {at:rd.seq, ypos:{fromtop:30}, size:5, shape:"circle", attribs:{stroke:thecolor,fill:thecolor}, glowOnHover:{stroke:'silver',fill:'silver'}, tooltip:'Rama outlier'} );
			}
			for(otype in geomout) {
				if(!geomout[otype][rd.seq]) continue;
				ramabaloons.push( {at:rd.seq, ypos:{fromtop:50}, size:5, shape:"diamond", attribs:{stroke:"red",fill:"red"}, glowOnHover:{stroke:'silver',fill:'silver'}, tooltip:'Geometry outlier'} );
			}
		});
		self.tracks.push({
			height:50, leftlabel:"Chain-"+self.chain.getAuthAsymId(), painters:[
				{ type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen,
					domains:self.makeObsDomsForChain(self.entity, self.chain).concat( [
						{
							ranges:[[0,elen-1]], ypos:{midpercent:80}, attribs:{fill:'none',stroke:'none'},
							tooltip:{common:'yes',text:'Sequence'}, sequence:eseq,
							baloons:ramabaloons
						}
					] ),
				}
			]
		});
	},
	makeObsDomsForChain: function(ent, chain) {
		var self = this;
		var obsranges = [], ret = [];
		jQuery.each(self.chain.getObservedRanges(), function(ri,rg) {
			obsranges.push([rg.pdb_start-1,rg.pdb_end-1]);
		});
		var chaincolor = self.colormaker.getChainColor(self.pdbid, ent.getEid(), self.chain.getAuthAsymId());
		ret.push( {
				ranges:obsranges, ypos:{midpercent:80}, attribs:{fill:chaincolor,stroke:null,opacity:0.3},
				tooltip:{common:'yes',text:'chain ' + self.chain.getAuthAsymId()}, glowOnHover:{fill:'silver'},
				fireResidueHoverEvent:function() { return {pdbid:ent.getPdbid(), entity:ent.getEid(), chain:self.chain.getAuthAsymId()}; },
				listenResidueHoverEvent:function(data) {
					if(data.pdbid != ent.getPdbid() || data.entity != ent.getEid() || data.chain != chain.getAuthAsymId()) return false;
					return true;
				}
		});
		return ret;
	},
	addEntityTrack: function() {
		var self = this;
		var ecol = self.colormaker.getDomainColor("entity",self.entity.getEid());
		var eseq = self.entity.getSequence(); var elen = eseq.length;
		self.tracks.push({
			height:50, leftlabel:'Entity', painters:[
				{ type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen, // entity
					domains:[
						{
							ranges:[[0,elen-1]], ypos:{midpercent:80}, attribs:{fill:ecol,stroke:null},
							tooltip:{common:'yes',text:'ent ' + self.entity.getEid()}, glowOnHover:{fill:'silver'},
							fireResidueHoverEvent:function() { return {pdbid:self.entity.getPdbid(), entity:self.entity.getEid()}; },
							listenResidueHoverEvent:function(data) {
								if(data.pdbid != self.entity.getPdbid() || data.entity != self.entity.getEid()) return false;
								return true;
							}
						},
					]
				},
				{ type:'Biojs.DomainPainter', seqlen:elen, numIndicesInRow:elen, // sequence of entity
					domains:[
						{
							ranges:[[0,elen-1]], ypos:{midpercent:80}, attribs:{fill:'none',stroke:'none'},
							tooltip:{common:'yes',text:'Sequence'}, sequence:eseq, seqattr:{stroke:'none',fill:'white'}
						},
					]
				}
			]
		});
	}
} );
