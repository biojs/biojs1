

// This is a PDB entry / map viewer from PDBe
// It defines the interface that is useful to inteact with other components from PDBe
Biojs.PDB3dviewer = Biojs.extend ( {
	constructor: function(options) {
		console.error("Call to unimplemented method in Biojs.PDB3dviewer!!");
	},
	common_init: function(options) {
		var self = this;
		self.colormaker = Biojs.theOnlyPDBcolourFactory;
		self.configs = options;
		self.pdb = Biojs.getPDBdatabroker(self.configs.api_url);
	},
	setup: function() { // add any divs etc
		console.error("Call to unimplemented method in Biojs.PDB3dviewer!!");
	},
	loadEDSmap: function(pdbid) {
		console.error("Call to unimplemented method in Biojs.PDB3dviewer!!");
	},
	loadPDBentry: function(pdbid) {
		console.error("Call to unimplemented method in Biojs.PDB3dviewer!!");
	},
	defaultEntryView: function(pdbid) { // show entry with protein/DNA/RNA chains as cartoons, waters hidden and rest as ball/stick
		console.error("Call to unimplemented method in Biojs.PDB3dviewer!!");
	},
	hideAll: function(pdbid) { // hide all representations of the entry
		console.error("Call to unimplemented method in Biojs.PDB3dviewer!!");
	},
	zoomLigNbrsView: function(pdbid, lig) { // zoom onto ligand represented by given list of residue addresses
		console.error("Call to unimplemented method in Biojs.PDB3dviewer!!");
	},
	subscribe_to_topics: function() {
		var self = this;
		if(!self.configs.listen_topics) return;
		for(var etype in Biojs.PDBeventHelper.event_types)
			jQuery.Topic(etype).subscribe( function(edata) {
				self.event_response(edata.event_type, edata);
			} );
	},
	event_response: function(evtype, evdata) {
		var self = this, conf = self.configs;
		if(evtype == Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_IN)
			; //self.respond_on_residue_hover(evdata, false);
		else if(evtype == Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_OUT)
			; //self.respond_on_residue_hover(evdata, true);
		else if(evtype == Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_CLICK)
			self.respond_on_residue_click(evdata);
		else if(evtype == Biojs.PDBeventHelper.event_types.MODELLED_CHAIN_DBL_CLICK)
			self.respond_on_chain_dblclick(evdata);
		else if(evtype == Biojs.PDBeventHelper.event_types.MODELLED_DOMAIN_CLICK)
			self.respond_on_domain_click(evdata);
		else if(evtype == Biojs.PDBeventHelper.event_types.SEQUENCE_DOMAIN_CLICK) {
			var ent = self.entry.getEntity(evdata.entity_id);
			var chains = []
			jQuery.each(ent.instances, function(ei,inst) { // respond to event using all pdb chain ids for entity
				chains.push(inst.getAuthAsymId());
			});
			evdata.pdb_chain_id = chains;
			self.respond_on_domain_click(evdata);
		}
		else
			; //console.error("Cannot handle event!", evtype, evdata);
	},
} );

Biojs.PDB3dviewerJSmol = Biojs.PDB3dviewer.extend ( {
	constructor: function(options) {
		var self = this;
		self.common_init(options);
		var conf = self.configs;
		var success_callback = function() {
			console.log("Start callback of PDB3dviewerJSmol");
			self.setup();
			if(!conf.apidata) conf.apidata = Biojs.PDBajaxData;
			self.entry = self.pdb.makeEntry(conf.pdbid, conf.apidata);
			self.entry.makeEntities(conf.apidata);
			self.color_chains();
			self.subscribe_to_topics();
		}
		if(conf.apidata) success_callback();
		else {
			Biojs.PDB_API_AJAX_Helper(
				conf.api_url,
				[
					"/pdb/entry/summary/" + conf.pdbid,
					"/pdb/entry/entities/" + conf.pdbid,
				],
				success_callback,
				function() {
					document.getElementById(conf.target).innerHTML = "Sorry, an error occurred.";
				}
			);
		}
	},
	color_chains: function() {
		var self = this, conf = self.configs;
		if(!conf.component_loaded) {
			window.setTimeout( function() {
				self.color_chains();
			}, 1000 );
			return;
		}
		var color_script = "", cm = self.colormaker;
		jQuery.each(self.entry.entities, function(ei,ent) {
			if(!ent.is_protein_RNA_DNA()) return;
			var eid = ent.getEid();
			jQuery.each(ent.instances, function(ei,inst) {
				var chid = inst.getAuthAsymId();
                color_script += " select :"+chid+" and not hetero; color backbone '"+ cm.to8bitColor(cm.getChainColor(conf.pdbid,eid,chid))+"'; "
			});
		});
		Jmol.script(conf.jmol3d, color_script);
	},
	guess_j2spath: function() {
		var ret = null;
		jQuery.each(jQuery('script'), function(si,sn) {
			if(!sn.src) return;
			var index = sn.src.toLowerCase().search(/jsmol\/jsmol.*js/i);
			if(index <= 0) return;
			ret = sn.src.substring(0,index) + "jsmol/j2s"
			console.log("j2s path guessed : ", ret);
			return false;
		});
		if(ret==null) {
			var msg = "Sorry, cannot guess j2s path, JSmol will not work.";
			console.error(msg); alert(msg);
		}
		return ret;
	},
	setup: function() {
		var self = this, conf = self.configs;
		Jmol.setDocument(0); // THIS IS CRUCIAL!!!
		delete Jmol._tracker // prevent analytics loading by default in Jmol
		Jmol.db._DirectDatabaseCalls["pdbe.org"] = "%URL"; // Do not delete!
		Jmol.db._DirectDatabaseCalls["www.ebi"] = "%URL"; // Do not delete!
        Jmol.getApplet(conf.target, {
            addSelectionOptions: false,
            color: "#ffffff",
            debug: false,
            height: conf.size,
            width: conf.size,
            j2sPath: self.guess_j2spath(), //"../../main/resources/dependencies/jsmol/j2s",              // HTML5 only
            readyFunction: function() {
				console.log("Jmol loaded in div " + conf.target);
				conf.component_loaded = true;
			},
            script:
                //'load ='+conf.pdbid+' filter "*.CA,*.P";cartoons only'
				"load 'http://www.ebi.ac.uk/pdbe/entry-files/download/pdb"+conf.pdbid+".ent';"
				+" backbone only; backbone 0.2; select hetero and not water; wireframe 0.2; select all; zoom 100;"
				//+"set antialiasDisplay ON;"
                //"set antialiasTranslucent ON;"+
                //"set debugScript OFF;"+
                //"set showScript OFF;"+
                //"set chainCaseSensitive;",
            //serverURL: "",  // Example only!
            ,
	    serverURL: "http://chemapps.stolaf.edu/jmol/jsmol/php/jsmol.php",
            src: null,
            use: "HTML5", // JAVA HTML5 WEBGL IMAGE  are all otions // Autoswitching (not recommended)
            deferApplet: false,
            deferUncover: false,
            progressbar: true,
            progresscolor: '#66666'
        });
		eval("conf.jmol3d = "+conf.target+";");
        jQuery("#"+conf.target).html(Jmol.getAppletHtml(conf.jmol3d));
	},
	get_jsmol_residue_selection: function(chain, seq_id, seq_id2) {
		var self = this;
		var res = self.get_res_info(chain, seq_id), res2 = null;
		if(!res) return null;
		if(seq_id2) {
			res2 = self.get_res_info(chain, seq_id2);
			if(!res2) return null;
		}
		var inscoded_resnum = function(r) {
			var ret = r.author_residue_number;
			if(r.author_insertion_code) ret += "^"+r.author_insertion_code;
			return ret;
		}
		var sel = ":"+chain.getAuthAsymId();
		sel += " and " + inscoded_resnum(res);
		if(res2)
			sel += "-" + inscoded_resnum(res2);
		return sel;
	},
	get_hover_atomsel_string: function(evdata, do_ranges) {
		var self = this, conf = self.configs;
		var ent = self.entry.getEntity(evdata.entity_id);
		var chains = [];
		if(typeof(evdata.pdb_chain_id) != typeof([]))
			chains.push(evdata.pdb_chain_id);
		else
			jQuery.each(evdata.pdb_chain_id, function(chi,chid) {
				chains.push(chid);
			});
		var sels = []
		for(var chi=0; chi < chains.length; chi++) {
			var chain = ent.getInstanceFromAuthAsym(chains[chi]);
			if(!do_ranges) {
				sels.push( "(" + self.get_jsmol_residue_selection(chain, evdata.seq_id) + ")" );
			}
			else {
				sels.push( "(" +  self.get_jsmol_residue_selection(chain, evdata.seq_id_ranges[0][0], evdata.seq_id_ranges[0][1]) + ")" );
			}
		}
		return "(" + sels.join(" or ") + ")" ;
	},
	get_res_info: function(chain, seq_id) {
		var self = this, conf = self.configs;
		if(self.entry.hasResidueListing()) {
			return chain.getResidueListing()[seq_id];
		}
		else {
			if(!self.residue_listing_call_made) {
				self.entry.makeResidueListing(conf.apidata);
				self.residue_listing_call_made = true;
			}
			return null;
		}
	},
	respond_on_chain_dblclick: function(evdata, fade) {
		var self = this, conf = self.configs;
		var sel = ":" + evdata.pdb_chain_id;
		Jmol.script(conf.jmol3d, "cartoon off; zoom 0; zoom {"+sel+"};");
	},
	respond_on_domain_click: function(evdata) {
		var self = this, conf = self.configs;
		var sel = self.get_hover_atomsel_string(evdata, true);
		if(!sel) return; // in case ajax call ongoing
		var dom_color = "grey", cm = self.colormaker;
		try        { dom_color = cm.to8bitColor( cm.getDomainColor(evdata.domain_type, evdata.domain_id) ); }
		catch(err) { console.log(err); }
		Jmol.script(conf.jmol3d, "select all; cartoon off; select "+sel+"; color cartoon '"+dom_color+"'; cartoon on; zoom {selected} 0;");
	},
	respond_on_residue_click: function(evdata, fade) {
		var self = this, conf = self.configs;
		var sel = self.get_hover_atomsel_string(evdata);
		if(!sel) return; // in case ajax call ongoing
		var jmol_script = "select all and not hetero; wireframe off; select all; halos off; select "+sel+"; zoom {selected} 0 ; zoom out ; halos on; wireframe 0.2;";
		//console.log( jmol_script );
		Jmol.script(conf.jmol3d, jmol_script);
	},
	respond_on_residue_hover: function(evdata, fade) {
		var self = this, conf = self.configs;
		var sel = self.get_hover_atomsel_string(evdata);
		if(!sel) return; // in case ajax call ongoing
		if(!fade)
			Jmol.script(conf.jmol3d, "select all and not hetero; wireframe off; select "+sel+"; wireframe 0.5;");
		else
			Jmol.script(conf.jmol3d, "select "+sel+"; wireframe off;");


		return;
		Jmol.script(conf.jmol3d, "zoomto 0.1 {"+sel+"} * 3 ; select "+sel+"; spacefill on;");
		window.setTimeout( function() {
			Jmol.script(conf.jmol3d, "zoomto 0.1 {all} / 3 ; select "+sel+"; spacefill off;");
		}, 1000 );
	}
} );
// By default, it uses Openastexviewer3 - it should be extended to suit other 3d viewers
Biojs.PDB3dviewerOAV = Biojs.PDB3dviewer.extend ( {
	constructor: function(options) {
		var self = this;
		self.common_init(options);
		self.loadedPdbids = {}; self.grobs = {};
		self.setup();
	},
	setup: function() { // add any divs etc
		var self = this, conf = self.configs;
		conf.appletdivid = conf.target + "_appletid";
		conf.jarpath = "http://www.ebi.ac.uk/pdbe-apps/widgets/applets/OAV/jar/OpenAstexViewer.jar";
		conf.appletclass = "MoleculeViewerApplet.class";
		var regret = "The browser cannot show this applet.";
		document.getElementById(conf.target).innerHTML = "Hello OAV 3D";
		document.getElementById(conf.target).innerHTML =
			'<applet id="'+conf.applet_divid+'" name="'+conf.applet_divid+'"\
			width="'+conf.size+'" height="'+conf.size+'" alt="'+regret+'" archive="'+conf.jarpath+'" code="'+conf.appletclass+'" mayscript="1">';
		console.log("loaded " + document[conf.applet_divid]);
		conf.applet = document[conf.applet_divid];
		self.appletExec("set symmetry off;");
		self.setup_events();
		conf.OAVwidgetID = 'PDB3dviewerOAV_'+self.target; // to listen to commands coming from applet
		conf.applet.setjso(conf.OAVwidgetID);
		if(conf.default_view_pdbid) self.loadPDBentry(conf.default_view_pdbid);
	},
	setup_events: function() {
		return;
		jQuery.Topic("ResidueHoverEvent").subscribe( function(data) { // listen to hover event
			console.log("event ", data);
			self.zoomRes(data.pdbid, data);
		} );
	},
	appletAtomSelected: function(atom) {
		var self = this;
		console.log("appletAtomSelected", atom);
	},
	loadEDSmap: function(pdbid, diffmap) {
		var self = this;
		var mapfile = "http://www.ebi.ac.uk/~swanand/ValidationFiles/" + pdbid.slice(1,3).toUpperCase() + "/" + pdbid.toUpperCase() + "/";
		if(diffmap) mapfile +=  "mFoDFc.map.ccp4";
		else        mapfile += "2mFoDFc.map.ccp4";
		var mapname = pdbid + "_map";
		if(diffmap) mapname +=  "_diff";
		var cmd = "map load "+mapname+" '" + mapfile + "';";
		if(diffmap) { cmd += "map " + mapname + " contour 1 off;"; }
		else        { cmd += "map " + mapname + " contour 1 off; map " + mapname + " contour 2 off;"; }
		self.appletExec(cmd);
	},
	loadPDBentry: function(pdbid) {
		var self = this;
		if(!self.loadedPdbids[pdbid]) {
			self.grobs[pdbid] = {'cartoons':[], 'surfaces':[]};
			cmd = "molecule load "+pdbid+" 'http://www.ebi.ac.uk/pdbe-apps/widgets/PDBfiles/pdb"+pdbid+".ent';";
			self.appletExec(cmd);
			console.log(cmd);
			self.loadPDBentry[pdbid] = 1;
			self.defaultEntryView(pdbid);
		}
	},
	defaultEntryView: function(pdbid) { // cartoons, ball+stick
		var self = this;
		self.hideAll(pdbid);
		self.displayAANAcartoon(pdbid);
		self.displayLigands(pdbid);
	},
	displayLigands: function(pdbid) {
		var self = this;
		// TODO this is very approx... whatever is not protein/AA/NA/water is a ligand...
		self.appletExec("display sticks on (molecule "+pdbid+" and (not solvent) and (not aminoacid) and (not dna));");
	},
	displayAANAcartoon: function(pdbid) {
		var self = this;
		// TODO get API data before calling schematic, make chain-specific cartoon with chain-specific colors
		cname = pdbid+"_schematic";
		self.appletExec("secstruc molecule "+pdbid+" ; schematic -alltube false -name "+cname+" molecule "+pdbid+" ;");
		self.grobs[pdbid].cartoons.push(cname);
	},
	hideAll: function(pdbid) { // hide all representations of the entry id, including lines, sticks, balls; surfaces, cartoons are deleted
		var self = this;
		for(var repr in {"lines":1, "spheres":1, "sticks":1, "cylinders":1}) {
			self.appletExec("display "+repr+" off molecule "+pdbid+" ;");
		}
		for(var pid in self.grobs) {
			for(var obtype in self.grobs[pid]) {
				for(var obi=0; obi < self.grobs[pid][obtype].length; obi++) {
					self.appletExec("object remove "+self.grobs[pid][obtype][obi]+" ;");
				}
			}
		}
	},
	zoomLigNbrsView: function(pdbid, ligres) {
		var self = this;
		self.loadPDBentry(pdbid); self.hideAll(pdbid);
		self.displayAANAcartoon(pdbid);
		self.displayLigands(pdbid);
		self.appletExec("center name REA;");
	},
	zoomRes: function(pdbid, ares) {
		var self = this;
		self.loadPDBentry(pdbid); self.hideAll(pdbid);
		self.displayAANAcartoon(pdbid);
		self.displayLigands(pdbid);
		var ressel = "molecule "+pdbid+" and chain A and residue " + ares.seq;
		if(ares.icode && ares.icode != ' ' && ares.icode != '') ressel += " and insertion " + ares.icode;
		var cmd = "display cylinders on " + ressel + "; center " + ressel + "; radius 6; display lines, molecule " + pdbid + " ;";
		self.appletExec(cmd);
	},
	appletExec: function(cmd) {
		var self = this, conf = self.configs;
		conf.applet.execute(cmd);
		//self.applet.execute("clip 100 -100;");
		console.log("EXECUTED " + cmd);
	}
} );
