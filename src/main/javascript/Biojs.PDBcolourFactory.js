
Biojs.PDBcolourFactory = Biojs.extend ( {
	constructor: function(options) {
		var self = this;
		self.charB16 = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
		self.colintervals = {
			'SCOP':[[0,0],[11,15],[11,15]],
			'CATH':[[0,5],[7,15],[0,0]],
			'PFAM':[[7,15],[0,0],[0,0]],
			'UNIPROT':[[7,15],[7,11],[0,0]],
			"entity":[[0,4],[0,4],[0,4]], // can be squeezed further
			"chain":[[6,10],[6,10],[6,10]]
		};
		for(k in options) self[k] = options[k];
		self.domcols = {"SCOP":{}, "CATH":{}, "PFAM":{}, "entity":{}, "chain":{}, "UNIPROT":{}};
	},
	getChainColor: function(pdbid, entityid, chainid) {
		var self = this;
		var chid = pdbid + "_" + entityid + "_" + chainid;
		return self.getDomainColor("chain", chid);
	},
	getDomainColor: function(domtype, domid) {
		if(!domid) throw("Domtype, domid should be defined " + domtype + " " + domid);
		var self = this;
		if(domtype == "SecStr") {
			return self.getSecstrColor(domid);
		}
		if(domtype == "Pfam") domtype = "PFAM";
		if(!self.domcols[domtype]) console.error("domain type unknown!! " + domtype);
		if(!self.domcols[domtype][domid]) {
			self.domcols[domtype][domid] = self.getRandomColor( self.colintervals[domtype] );
		}
		//console.log("!color", domtype, domid, self.domcols[domtype][domid]);
		return self.domcols[domtype][domid];
	},
	getRandomColor: function(colspec) {
		var self = this;
		var retcol = '#';
		if(!colspec) colspec = [ [0,15], [0,15], [0,15] ];
		for (var ci=0; ci<colspec.length; ci++) {
			randind = Math.floor( colspec[ci][0] + Math.random()*(colspec[ci][1]-colspec[ci][0]+1)*0.999 )
			retcol += self.charB16[ randind ];
		}
    	return retcol;
	},
	to8bitColor: function(colstr) {
		return (colstr[0]+colstr[1]+colstr[1]+colstr[2]+colstr[2]+colstr[3]+colstr[3]).toLowerCase();
	},
	getSecstrColor: function(sstype) {
		var self = this;
		if(sstype == "sheet") return '#5AA';
		else if(sstype == "helix") return '#A5A';
		else {
			console.error("unknown sec str type - dont know colour!");
			return "#AAA";
		}
	}
} );

if(!Biojs.theOnlyPDBcolourFactory)
	Biojs.theOnlyPDBcolourFactory = new Biojs.PDBcolourFactory();
