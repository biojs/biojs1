
Biojs.PDBentryTree = Biojs.extend ( {
	constructor: function(options) {
		var self = this;
		for(k in options) self[k] = options[k];
		self.setupPDBdatabrokerAndLaunch();
	},
	setupPDBdatabrokerAndLaunch: function() {
		var self = this;
		self.pdb = new Biojs.PDBdatabroker({apiURL:self.apiURL});
		var successCallback = function() {
			self.entry = self.pdb.makeEntry(self.pdbid, apidata);
			self.entry.makeEntities(apidata); 
			self.draw();
		};
		if(self.apidata) { apidata = self.apidata; successCallback(self.apidata) ; return; }
		var urlstr = '', apiURLs = [
			"/pdb/entry/summary/" + self.pdbid,
			"/pdb/entry/entities/" + self.pdbid,
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
				document.getElementById(self.divid).innerHTML = "Error!";
			}
		});
	},
	draw: function() {
		var self = this;
		//self.makeJqueryMenubasedTree();
		self.makeFancytree();
	},
	makeFancytree: function() {
		var self = this;
		jQuery('#'+self.divid).fancytree( {
			source:[],
			checkbox:true,
			select: function(event, data) {
				//console.log("hi " , data.node.title, data.node.data.pdbdata, data.node);
				if(data.node.data.pdbdata) {
					var pd = data.node.data.pdbdata; pd.selstate = data.node.isSelected();
					if(pd.pdbid && pd.entity && pd.chain) jQuery.Topic("PDBchainSelUnselEvent").publish(pd);
					else if(pd.pdbid && pd.entity) jQuery.Topic("PDBentitySelUnselEvent").publish(pd);
					else if(pd.pdbid) jQuery.Topic("PDBentrySelUnselEvent").publish(pd);
					else console.error("Cannot make event for this fancytree selection!");
				}
			}
		} );
		var node = jQuery('#'+self.divid).fancytree("getRootNode");
		var pnode = node.addChildren( {
			title:self.pdbid,
			pdbdata:{pdbid:self.pdbid}
		} );
		jQuery.each( self.entry.entities, function(ei,ent) {
			var enode = pnode.addChildren({
				title:'Entity ' + ent.getEid() + ": " + ent.getName(),
				pdbdata:{pdbid:self.pdbid, entity:ent.getEid()}
			});
			jQuery.each( ent.instances, function(ci,chain) {
				cnode = enode.addChildren({
					pdbdata:{pdbid:self.pdbid, entity:ent.getEid(), chain:chain.getAuthAsymId()},
					title:'Chain ' + chain.getAuthAsymId()
				});
			} );
		} );
	}
} );
