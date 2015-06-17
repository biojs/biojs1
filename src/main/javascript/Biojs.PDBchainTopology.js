/** 
 * This is the description of the PDBchainTopology component. This component renders secondary structure topology for a protein chain in a PDB entry.
 * 
 * @class
 * @extends Biojs
 * 
 * @author <a href="mailto:swanand@gmail.com">Swanand Gore</a>
 * @version 1.0.0
 * @category 0
 *
 * @requires <a href='http://code.jquery.com/jquery-1.6.4.js'>Raphael 2.1.0</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/graphics/raphael-2.1.0.js"></script>
 * 
 * @requires <a href='http://code.jquery.com/jquery-1.6.4.js'>jQuery Core 1.6.4</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/jquery/jquery-1.4.2.min.js"></script>
 * 
 * @param {Object} options An object with the options for PDBchainTopology component.
 *    
 * @option {list}
 *    Following options are available to configure the component:
 *    <ul>
 *    <li>pdbid: PDB entry id containing the protein chain of interest.</li>
 *    <li>chain_id: Chain id of the protein chain.</li>
 *    <li>divid: Id of div in which the topology is to be rendered.</li>
 *    <li>size: Dimensions of the square canvas on which topology will be drawn.</li>
 *    </ul>
 *    
 * @example 
 * var instance = new Biojs.PDBchainTopology({
 * 		divid:"YourOwnDivId",   pdbid:"1cbs", chain_id:"A"
 * });	
 * 
 */
Biojs.PDBchainTopology = Biojs.extend (
/** @lends Biojs.PDBchainTopology# */
{
	/**
	*  Default values for the options
	*  @name Biojs.PDBchainTopology-opt
	*/
	opt: { target: "YourOwnDivId", chain_id:"A", pdbid:"1cbs", size:700 },

	constructor: function (options) {
		var self = this;

		// internal config options - not to be exposed to end-user as of now
		var defconf = {size:700, apiURL:"wwwdev.ebi.ac.uk/pdbe/api" };

		self.config = options;
		for(var akey in defconf) {
			if(!self.config[akey]) self.config[akey] = defconf[akey];
		}

		PDBchainTopologyRegistry[self.config.target] = self;

		self.colormaker = Biojs.theOnlyPDBcolourFactory;

		self.config.menudiv = 'topo_menu_'+self.config.target;
		self.config.resdiv = 'topo_resinfo_'+self.config.target;
		self.config.domseldiv = 'topo_domsel_'+self.config.target;
		self.config.ascheckbox = 'topo_ascheckbox_'+self.config.target;
		self.config.raphadiv = 'topo_rapha_'+self.config.target;
		self.config.navigator_div = 'topo_navigator_'+self.config.target;
		self.config.status_div = 'topo_status_'+self.config.target;
		var help_icon_div = self.config.target + "_help_icon_div";
		// make dropdown for domains
		var selstr = "<select id='"+self.config.domseldiv+"' onchange=topoSelectorChanged('"+self.config.target+"')>";
		for(domtype in {Annotations:1}) selstr += "<option value='"+domtype+"'>"+domtype+"</option>"
		selstr += "</select>";
		// make markup
		var some_html = Handlebars.compile(" \
				<div style='position:relative;'> \
					<div style='position:absolute;z-index:1000;' id='{{navigator}}'></div> \
					<div style='position:absolute;z-index:1000;opacity:0.5;margin:{{margin}}px;background-color:lightgrey;padding:{{padding}}px;height:{{width}}px;width:{{width}}px;' id={{statusdiv}}> \
					</div> \
					<div style='position:relative;' class='topology_raphael_canvas' id='{{raphadiv}}'></div> \
				</div> \
				<div style='position:relative;' class='topology_menu' id='{{menudiv}}'> \
					<span style='padding-right:5px;' id='{{resdiv}}'>{{pdbid}}</span> \
					<span>{{{selstr}}}</span> \
					{{{controls}}} \
				</div> \
			")({
				raphadiv:self.config.raphadiv, menudiv:self.config.menudiv,
				resdiv:self.config.resdiv, pdbid:self.config.pdbid,
				selstr:selstr, controls:"<div style='float:right;' id='"+help_icon_div+"'></div>",
				width:self.config.size*0.6, padding:self.config.size*0.1, margin:self.config.size*0.1,
				navigator:self.config.navigator_div, statusdiv:self.config.status_div
			});
		jQuery("#"+self.config['target']).html(some_html);
		self.make_help_icon(help_icon_div);

		self.show_message("Loading....");
		self.show_waiting("",false);

		self.previousDomainElems = null; // for clearing out any previous domain rendering
		self.previousActivsiteElems = null;
		self.respaths = []; // essential to store hoverable residue elems so that they can be brought 'up' after rendeing domain
		self.resi2paths = {};
		self.thinssXscale = 1.0; self.allYscale = 1.0; self.allXscale = 1.5;
		self.curvyloops = true; //true;
		self.loopdip = 'useArea';

		self.pdb = Biojs.getPDBdatabroker(self.config["apiURL"]);
		var topodata = null;
		var successCallback = function() {
			console.log('Starting PDBchainTopology callback');
			topodata = (!self.apidata) ?  Biojs.PDBajaxData : self.apidata;
			self.entry = self.pdb.makeEntry(self.config["pdbid"], topodata);
			self.entry.makeEntities(topodata);
			self.entry.makeSiftsMappings(topodata);
			self.entry.makeStructuralCoverage(topodata);
			if(!self.decide_entity_chain_id()) {
				self.show_message("Sorry, no suitable chain can be decided from given input: " + self.get_ch_ent_pid_str() + ".");
				return;
			}
			if(self.apidata) {
				topodata = self.apidata ; successCallback_1();
			}
			else {
				Biojs.PDB_API_AJAX_Helper(
					self.config.apiURL,
					[
						"/topology/entry/" + self.config["pdbid"]// + "/chain/" + self.config.chain_id
					],
					successCallback_1,
					function() {
						self.show_message("Sorry, there is a problem getting data from the PDBe API.");
					}
				);
			}
		};
		var successCallback_1 = function() {
			topodata = (!self.apidata) ?  Biojs.PDBajaxData : self.apidata;
			console.log(topodata, Biojs.PDBajaxData);
			self.entry.make2Dtopology(topodata, self.config.chain_id);
			self.topodata = self.chain.get2Dtopology();
			jQuery('#'+self.config.resdiv).html('');
			jQuery('#'+self.config.resdiv).html(self.config.pdbid+":"+self.config.chain_id);
			if(!self.topodata) {
				self.show_message("Sorry, there is no topology information for " + self.get_ch_ent_pid_str() + ".");
				return;
			}
			self.startResInfoCall();
			self.startResValidationCall();
			self.make_topodata_domains();
			self.topoLayout();
			self.make_navigator();
		};

		if(self.apidata) {
			topodata = self.apidata ; successCallback();
		}
		else {
			Biojs.PDB_API_AJAX_Helper(
				self.config.apiURL,
				[
					"/pdb/entry/summary/" + self.config["pdbid"],
					"/pdb/entry/entities/" + self.config["pdbid"],
					"/pdb/entry/polymer_coverage/" + self.config["pdbid"],
					"/mappings/" + self.config["pdbid"]
					//"/topology/entry/" + self.config["pdbid"]
				],
				successCallback,
				function() {
					self.show_message("Sorry, there is a problem getting data from the PDBe API.");
				}
			);
		}
	},

	make_help_icon: function(help_icon_div) {
		var zoom_pan_msg = "In addition to graphical controls for zoom and pan, you can also drag the mouse for panning the camera or drag the mouse with Shift key pressed for zoom. More help to follow.";
		jQuery("#"+help_icon_div).append("<div style='width:50%;margin:0 auto;font-size:18px;'>?</div>");
		jQuery("#"+help_icon_div).css("width","20px");
		jQuery("#"+help_icon_div).css("height","20px");
		//jQuery("#"+help_icon_div).css("background","rgba(0,0,0,0.1)");
		jQuery("#"+help_icon_div).css("border-radius","10px");
		jQuery("#"+help_icon_div).css("-moz-border-radius","10px");
		jQuery("#"+help_icon_div).css("-webkit-border-radius","10px");
		jQuery("#"+help_icon_div).qtip({
			content:zoom_pan_msg,
			position: { target: "mouse", adjust: {x:5, y:5} },
			style: { 'classes': 'qtip-bootstrap qtip-shadow qtip-rounded' },
		});
	},

	make_navigator: function() {
		var self = this;
		jQuery("#"+self.config.navigator_div).Zoom_Pan_Dial({
			size:50,
			click_handlers: {
				"down"     : function() { self.config.rapha_canvas["pan_up"]() },
				"up"   : function() { self.config.rapha_canvas["pan_down"]() },
				"right"   : function() { self.config.rapha_canvas["pan_left"]() },
				"left"  : function() { self.config.rapha_canvas["pan_right"]() },
				"zoomin" : function() { self.config.rapha_canvas["zoom_in"]() },
				"zoomout": function() { self.config.rapha_canvas["zoom_out"]() },
			}
		});
	},

	make_topodata_domains: function() {
		var self = this;
		self.topodata.domains = {};
		for(var domtype in {"CATH":1, "SCOP":1, "Pfam":1}) {
			var instances = self.entry.getSiftsMappingsInstanceRanges(
				domtype,
				function(arange) {
					return arange.entity_id == self.chain.getEntityId() && arange.struct_asym_id == self.chain.getStructAsymId();
				}
			);
			if(instances.length == 0) continue;
			var domdata = {};
			jQuery.each(instances, function(ii,inst) {
				if(!domdata[inst.id]) domdata[inst.id] = [];
				var adj_ranges = [];
				jQuery.each(inst.ranges, function(ri,rg) {
					adj_ranges.push( [rg[0]-1,rg[1]-1] );
				});
				domdata[inst.id].push(adj_ranges);
			});
			self.topodata.domains[domtype] = domdata;
		}
	},

	get_ch_ent_pid_str: function() {
		var self = this;
		return "chain_id " + self.config.chain_id + " of molecule_id " + self.config.entity_id + " in entry " + self.config.pdbid;
	},

	decide_entity_chain_id: function() {
		// if entity_id is provided, choose best chain therein
		// if entity_id is not provided, find entity id
		var self = this;
		for(var ei=0; ei < self.entry.entities.length; ei++) {
			var ent = self.entry.entities[ei];
			self.entity = ent;
			if(!ent.isType("protein")) continue;
			if(self.config.entity_id && ent.getEid() != self.config.entity_id) continue;
			if(!self.config.entity_id) // first protein entity
				self.config.entity_id = ent.getEid();
			for(var chi=0; chi < ent.instances.length; chi++) {
				if(!self.config.chain_id) {
					self.chain = ent.getBestModelledInstance();
					self.config.chain_id = self.chain.getAuthAsymId();
					return true;
				}
				else if(self.config.chain_id == ent.instances[chi].getAuthAsymId()) {
					self.chain = ent.instances[chi];
					//if(!self.chain.get2Dtopology()) {
					//	self.show_message("Sorry, no topology info for chain: " + self.get_ch_ent_pid_str() + ".");
					//	return false;
					//}
					return true;
				}
			}
		}
		self.config.chain_id = null;
		self.config.entity_id = null;
		return false;
	},

	show_message: function(msg) {
		var self = this;
		var textwidth = self.config.size;//*0.98;
		document.getElementById(self.config.raphadiv).innerHTML = "<textarea style='width:"+textwidth+"px;height:"+textwidth+"px;'>"+msg+"</textarea>";
		//alert("Sorry, there is no topology information for this chain of the entry.");
	},

	changeTooltip: function(content, e) {
		var self = this;
		if(self.ttdiv == undefined) {
			jQuery("#"+self.config.target).append( "<div id='tooltip' style='border:1px solid black;background-color:white;display:none;position:absolute;left:100px;top:100px;font-family:Helvetica Neue, Helvetica, Arial, sans-serif;'></div>" );
			self.ttdiv = document.getElementById("tooltip");
		}
		if(content==false) { self.ttdiv.style.display = "none"; return; }
		// find tooltip x,y - this is tricky...
		posx = e.pageX - jQuery(document).scrollLeft()+10;// - jQuery('#'+self.config.target).offset().left;
		posy = e.pageY - jQuery(document).scrollTop()-10;// - jQuery('#'+self.config.target).offset().top;
		if (e.pageX || e.pageY) {
		  posx = e.pageX;
		  posy = e.pageY;
		}
		else if (e.clientX || e.clientY) {
		  posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
		  posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
		}
		posx += 10;
		posy -= 10;
		// set tooltip
		self.ttdiv.style.display = "block";
		self.ttdiv.style.left = posx+"px";
		self.ttdiv.style.top =  posy+"px";
		self.ttdiv.innerHTML = content;
	},

	intervalIntersection: function(ssstart,ssstop, fromresindex,tillresindex) {
		var start = ssstop + 10, stop = ssstart - 10;
		for(var ri=ssstart; ri<=ssstop; ri++) {
			if(ri < fromresindex || ri > tillresindex) continue;
			if(start > ri) start = ri;
			if(stop < ri) stop = ri;
		}
		var fracstart = (start-ssstart) *100.00 / (ssstop-ssstart+1)
		var fracstop  = (stop+1-ssstart)*100.00 / (ssstop-ssstart+1)
		return [start, stop, fracstart, fracstop];
	},

	// fill any strands in this range, both ends inclusive
	fillStrands: function(strands, fromresindex, tillresindex) {
		var self = this;
		for(var si=0; si < strands.length; si++) {
			var ass = strands[si];
			if(ass.start > tillresindex || ass.stop < fromresindex) continue;
			var startstop = self.intervalIntersection(ass.start, ass.stop, fromresindex, tillresindex);
			var start = startstop[0], stop = startstop[1], fracstart = startstop[2], fracstop = startstop[3];
			if(ass.direction=="down") { fracstart1 = 100-fracstop; fracstop1 = 100-fracstart; fracstart = fracstart1; fracstop = fracstop1; } 
			var color = self.domcolor, bgcol = '#fff';//, fracstart = 20, fracend = 60;
			var halfgradattrib = {'fill-opacity':0.5, 'fill':'90-'+bgcol+':0-'+bgcol+':'+fracstart+'-'+color+':'+fracstart+'-'+color+':'+fracstop+'-'+bgcol+':'+fracstop+'-'+bgcol+':100'};
			ass.gelem.clone().attr(halfgradattrib);
		}
	},

	// fill any loops in this range, both ends inclusive
	fillLoops: function(coils, fromresindex, tillresindex) {
		var self = this;
		for(var si=0; si < coils.length; si++) {
			var ass = coils[si];
			var startstop = self.intervalIntersection(ass.start, ass.stop, fromresindex, tillresindex);
			var fstart = startstop[2], fstop = startstop[3];
			var looppath = self.makeLoopPathArray(ass.path);
			var fulllength = Raphael.getTotalLength(looppath);
			subpath = Raphael.getSubpath(looppath, fstart*fulllength/100., fstop*fulllength/100.);
			var broadstrokeattr = {'stroke-width':4,'stroke':self.domcolor};
			self.config.rapha.path(subpath).attr(broadstrokeattr);
		}
	},

	showActivesite: function(marktype) {
		var self = this;
		var topodata = self.topodata;
		if(self.previousActivsiteElems != null) { self.previousActivsiteElems.remove(); self.previousActivsiteElems = null; }
		if(document.getElementById(self.config.ascheckbox).checked == false) return;
		self.config.rapha.setStart();
		var dim = 0.6*self.basicwidth;
		for(var ri in self.resi2paths) {
			if(Math.random() > 0.05) continue;
			for(var rpi=0; rpi < self.resi2paths[ri].length; rpi++) {
				var rpk = self.resi2paths[ri][rpi];
				var rp = self.respaths[rpk];
				var xyd = rp.getPointAtLength( rp.getTotalLength()/2 );
				var x = xyd.x, y = xyd.y, alpha = Math.PI/180 * xyd.alpha;
				var ca = Math.cos(alpha), sa = Math.sin(alpha);
				if(marktype=="square")
					self.config.rapha.path(["M",x-dim,y-dim,"L",x-dim,y+dim,"L",x+dim,y+dim,"L",x+dim,y-dim,"Z"]).attr({fill:'blue'});
				else if(marktype=="diamond")
					self.config.rapha.path(["M",x-dim,y,"L",x,y+dim,"L",x+dim,y,"L",x,y-dim,"Z"]).attr({fill:'green'});
				else if(marktype=="triangle")
					self.config.rapha.path(["M",x-1.2*dim,y,"L",x+0.6*dim,y+dim,"L",x+0.6*dim,y-dim,"Z"]).attr({fill:self.colormaker.getRandomColor()});
					//self.config.rapha.path(["M",x,y-1.2*dim,"L",x+dim,y+0.6*dim,"L",x-dim,y+0.6*dim,"Z"]).attr({fill:self.colormaker.getRandomColor()});
					//self.config.rapha.path(["M",x,y+0.6*dim,"L",x+dim/2,y-0.3*dim,"L",x-dim/2,y-0.3*dim,"Z"]).attr({fill:self.colormaker.getRandomColor()});
				else
					self.config.rapha.circle(x,y,dim).attr({fill:'red'});
			}
		}
		self.previousActivsiteElems = self.config.rapha.setFinish();
		return;
	},

	show_waiting: function(message, on) {
		var self = this, conf = self.config, topodata = self.topodata;
		if(!conf.waiting_image) {
			var scripts = document.getElementsByTagName("script");
			jQuery.each(scripts, function(si,scr) {
				if(scr.src.match(/Biojs.PDBchainTopology.js$/))
					conf.waiting_image = scr.src.replace(
						/Biojs.PDBchainTopology.js/,
						"../resources/data/pdb/images/ajax-loader.gif");
			});
		}
		jQuery("#"+self.config.status_div).html(message + "<br><img width=50% src='"+conf.waiting_image+"'/>");
		if(on)
			jQuery("#"+self.config.status_div).show();
		else
			jQuery("#"+self.config.status_div).hide();
	},

	show_validation_domain: function() {
		var self = this, conf = self.config, topodata = self.topodata;
		if(!self.validation_api_called) {
			console.error("Unexpected to find uninitialized variable validation_api_called");
			return;
		}
		if(self.validation_api_called == "in_progress") {
			self.show_waiting("Obtaining validation data from the PDBe API", true);
			setTimeout( function() { self.show_validation_domain(); }, 1000 );
			return;
		}
		else if(self.validation_api_called == "failed") {
			self.show_waiting("Failed to obtain validation data from the PDBe API", true);
			setTimeout( function() { self.show_waiting("",false); }, 3000 );
			jQuery("#"+self.config.domseldiv+" option[value='Quality']").remove();
		}
		var vdata = self.entry.getValidationResidueDataForChain(conf.entity_id, conf.chain_id);
		if(!vdata) {
			var msg = "No validation info available for molecule " + conf.entity_id + " chain " + conf.chain_id;
			console.warn(msg);
			setTimeout( function() { self.show_waiting(msg,false); }, 3000 );
			return;
		}
		self.config.rapha.setStart(); // remember all elements created for display of annotation so that they can be removed later
		var sstypes = {coils:"red", strands:"green", helices:"blue", terms:'purple'};
		for(var ast in sstypes) {
			jQuery.each(topodata[ast], function(asi, ass) {
				if(ass.start <= 0 || ass.stop <= 0)
					return;
				var sslen = ass.stop - ass.start + 1, rstep = 100.0/sslen;
				var gradstr = "";
				for(var ri=ass.start; ri <= ass.stop; ri++) {
					var color = "#0f0";
					if(vdata[ri] && vdata[ri].outlier_types) {
						var is_rsrz_outlier = vdata[ri].outlier_types.indexOf("RSRZ") > -1;
						var num_geom_outliers = vdata[ri].outlier_types.length;
						if(is_rsrz_outlier)
							num_geom_outliers -= 1;
						if(num_geom_outliers==1) color = "#ff0";
						if(num_geom_outliers==2) color = "#f90";
						if(num_geom_outliers>=3) color = "#f00";
						if(is_rsrz_outlier) {
							var reselem = self.resi2paths[ri];
							if(!reselem) return;
							reselem = self.respaths[ reselem[0] ];
							reselem = reselem.clone();
							reselem.attr( {'stroke-opacity':0.5, 'stroke-width':10, 'stroke':'brown'} );
						}
					}
					var fstart = (100.0*(ri-ass.start))/sslen;
					var fstop = fstart + rstep;
					if(ast=="coils") {
						var looppath = self.makeLoopPathArray(ass.path);
						var fulllength = Raphael.getTotalLength(looppath);
						var subpath = Raphael.getSubpath(looppath, fstart*fulllength/100., fstop*fulllength/100.);
						var broadstrokeattr = {'stroke-width':4,'stroke':color};
						self.config.rapha.path(subpath).attr(broadstrokeattr);
						continue;
					}
					if(ass.direction=="down") {
						var fracstart1 = 100-fstop, fracstop1 = 100-fstart;
						fstart = fracstart1; fstop = fracstop1;
						gradstr = "-"+color+":"+fstart+"-"+color+":"+fstop + gradstr;
					}
					else
						gradstr += "-"+color+":"+fstart+"-"+color+":"+fstop;
				}
				if(ast!="coils")
					ass.gelem.clone().attr({'fill-opacity':0.5, 'fill':"90"+gradstr});
			});
		}
		self.previousDomainElems = self.config.rapha.setFinish();
		self.respaths_to_front();
	},

	respaths_to_front: function() {
		var self = this, conf = self.config;
		if(self.previousActivsiteElems!=null) // bring to front any point annotations
			self.previousActivsiteElems.toFront();
		for(var spi=0; spi < self.respaths.length; spi++) // bring to front all respaths
			self.respaths[spi].toFront();
	},

	showDomains: function(domtype) {
		var self = this, conf = self.config;
		var topodata = self.topodata;
		if(self.previousDomainElems != null) { self.previousDomainElems.remove(); self.previousDomainElems = null; }
		var dstart = null, dstop = null;
		if(!domtype) domtype = document.getElementById(self.config.domseldiv).value;
		self.change_domain_in_selector(domtype);
		if(domtype=="Annotations")
			return;
		if(domtype=="Quality") {
			self.show_validation_domain();
		}
		else { // scop/cath/pfam domain
			self.config.rapha.setStart(); // remember all elements created for display of annotation so that they can be removed later
			var domdata = self.topodata.domains[domtype];
			if(!domdata) { console.error("Sorry, data not available for domain type " + domtype + "."); return; }
			for(domid in domdata) {
				var dominfo = domdata[domid];
				for(di=0; di < dominfo.length; di++) { // domain instance
					self.domcolor = self.colormaker.getDomainColor(domtype,domid);
					for(si=0; si < dominfo[di].length; si++) { // segment in instance
						dstart = dominfo[di][si][0]; dstop = dominfo[di][si][1];
						try { dstart = parseInt(dstart); }
						catch(err) {}
						try { dstop = parseInt(dstop); }
						catch(err) {}
						dstart += 1; dstop += 1;
						self.fillLoops  (topodata.coils,   dstart, dstop);
						self.fillStrands(topodata.strands, dstart, dstop);
						self.fillStrands(topodata.helices, dstart, dstop);
						self.fillStrands(topodata.terms,   dstart, dstop);
					}
				}
			}
			self.previousDomainElems = self.config.rapha.setFinish();
			self.respaths_to_front();
		}
	},
		// some sample code for gradient fill
		//var halfgradattrib = {'fill':'90-#000-#000:50-#fff:50-#fff'};
		//var attrib1 = {'stroke-width':1, 'fill':'45-#fff:0-#fff:60-#00f:60-#00f:100-145-#fff:0-#fff:60-#00f:60-#00f:100', 'fill-opacity':0.1, 'opacity':0.1};
		//fstr = '45';
		//for(fi=0; fi < 5; fi++) {
			//fk = 20*fi;
			//fstr += '-#f00:'+(fk+2)+"-#f00:"+(fk+7)
			//fstr += '-#0f0:'+(fk+12)+"-#0f0:"+(fk+17)
		//}
		//var attrib = {'stroke-width':1, 'fill':fstr, 'fill-opacity':0.2, 'opacity':0.1};

	joinDicts: function(d1,d2) {
		var newd = {};
		for(k in d1) newd[k] = d1[k];
		for(k in d2) newd[k] = d2[k];
		return newd;
	},

	makeLoopPathArray: function(origpath) {
		var self = this;
		var path = []; // copy given path - do not modify it
		for(var pi=0; pi < origpath.length; pi++) { path.push(origpath[pi]); }
		// return immediately if curved loops are not to be drawn
		if(self.curvyloops == false) return self.spliceMLin(path,"L");
		var looppath = [];
		// get rid of points with same x coordinate
		for(var pi=0; pi < path.length; pi+=2) {
			if(pi < path.length-2 && looppath.length >= 2 && Math.abs(path[pi+2]-path[pi]) < 1e-3 && Math.abs(path[pi]-looppath[looppath.length-2]) < 1e-3) {
				continue;
			}
			looppath.push(path[pi]); looppath.push(path[pi+1]);
		}
		//for(var pi=0; pi < looppath.length; pi+=2) self.config.rapha.circle(looppath[pi], looppath[pi+1], 2);
		// make curves depending on how many points in path
		var IST = "S"; scheme = 5;
		if(looppath.length == 4)
			looppath = self.spliceMLin(looppath,"L");
		else if(looppath.length == 6)
			//looppath = self.spliceMLin(looppath,"L");
			looppath = self.spliceMLin(looppath,IST);
		else if(looppath.length == 8) {
			if(scheme==1) { // residue numbering is screwed in this scheme
				newpath = []
				midx = (looppath[2]+looppath[4])/2; midy = (looppath[3]+looppath[5])/2;
				newpath = newpath.concat(["M",midx,midy]);
				newpath = newpath.concat([IST,looppath[2],looppath[3],looppath[0],looppath[1]])
				newpath = newpath.concat(["M",midx,midy]);
				newpath = newpath.concat([IST,looppath[4],looppath[5],looppath[6],looppath[7]])
				looppath = newpath;
			}
			else if(scheme==2) { // residue numbering is screwed in this scheme
				newpath = []
				midx = (looppath[2]+looppath[4])/2; midy = (looppath[3]+looppath[5])/2;
				newpath = newpath.concat(["M",looppath[0],looppath[1]]);
				newpath = newpath.concat([IST,looppath[2],looppath[3],midx,midy])
				newpath = newpath.concat(["M",looppath[6],looppath[7]]);
				newpath = newpath.concat([IST,looppath[4],looppath[5],midx,midy])
				looppath = newpath;
			}
			else if(scheme==3) {
				newpath = []
				midx = (looppath[2]+looppath[4])/2; midy = (looppath[3]+looppath[5])/2;
				newpath = newpath.concat(["M",looppath[0],looppath[1]]);
				newpath = newpath.concat([IST,looppath[2],looppath[3],midx,midy])
				newpath = newpath.concat([IST,looppath[4],looppath[5],looppath[6],looppath[7]])
				looppath = newpath;
			}
			else if(scheme==4) { 
				looppath = self.spliceMLin(looppath,"C");
			}
			else if(scheme==5) {
				looppath = self.scheme5(looppath);
			}
		}
		else if(looppath.length == 12) {
			if(scheme==5) {
				looppath = self.scheme5(looppath);
			}
			else {
				//looppath = self.spliceMLin(looppath,"L");
				//looppath = self.insertMidpoints(looppath);
				newpath = [];
				newpath = ["M",looppath[0],looppath[1]];
				midx = (looppath[2]+looppath[4])/2; midy = (looppath[3]+looppath[5])/2;
				newpath = newpath.concat([IST,looppath[2],looppath[3],midx,midy]);
				midx = (looppath[4]+looppath[6])/2; midy = (looppath[5]+looppath[7])/2;
				newpath = newpath.concat([IST,looppath[4],looppath[5],midx,midy]);
				midx = (looppath[6]+looppath[8])/2; midy = (looppath[7]+looppath[9])/2;
				newpath = newpath.concat([IST,looppath[6],looppath[7],midx,midy]);
				newpath = newpath.concat([IST,looppath[8],looppath[9],looppath[10],looppath[11]]);
				looppath = newpath;
				//looppath = self.spliceMLin(looppath,"S");
				//midx = (looppath[2]+looppath[4])/2; midy = (looppath[3]+looppath[5])/2;
				//newpath = newpath.concat([IST,looppath[2],looppath[3],midx,midy])
				//midx = (looppath[6]+looppath[8])/2; midy = (looppath[7]+looppath[9])/2;
			}
		}
		else {
			alert("unexpected path legth!! " + looppath.length);
			looppath = self.spliceMLin(looppath,"L");
		}
		return looppath;
	},

	scheme5: function(looppath) {
		var self = this;
		if(looppath.length == 8)
			looppath = self.insertMidpoints(looppath);
		else if(looppath.length == 12) {
			looppath = self.insertMidpoints(looppath);
			midx = (looppath[8]+looppath[10])/2;
			midy = (looppath[9]+looppath[11])/2;
			looppath.splice(10, 0, midx, midy);
			midx = (looppath[12]+looppath[14])/2;
			midy = (looppath[13]+looppath[15])/2;
			looppath.splice(14, 0, midx, midy);
		}
		else alert("unexpected path length!! error");
		looppath.splice( 0,0,"M");
		looppath.splice( 3,0,"C");
		looppath.splice(10,0,"C");
		if(looppath.length > 17) looppath.splice(17,0,"C");
		return looppath;
	},

	scheme5_old: function(looppath) {
		newpath = ["M"]; // add mid points to all segments
		for(var pi=0; pi < looppath.length; pi+=2) {
			newpath.push(looppath[pi]); newpath.push(looppath[pi+1]);
			if(pi==looppath.length-2) break;
			if(newpath.length==3) newpath.push("C");
			newpath.push( (looppath[pi+0]+looppath[pi+2])/2 );
			newpath.push( (looppath[pi+1]+looppath[pi+3])/2 );
		}
		looppath = newpath;
		return looppath;
	},

	insertMidpoints: function(path) {
		var newpath = [];
		for(var pi=0; pi < path.length; pi+=2) {
			newpath.push( path[pi] ); newpath.push( path[pi+1] );
			if(pi < path.length-2) {
				newpath.push( (path[pi+0]+path[pi+2])/2 );
				newpath.push( (path[pi+1]+path[pi+3])/2 );
			}
		}
		return newpath;
	},

	scaleX: function(x1,x2) {
		var self = this;
		// thin down along X axis
		var xdiff = (x1-x2)/2. * (1-self.thinssXscale);
		return [x1-xdiff, x2+xdiff];
	},

	findExtents: function() {
		var self = this;
		var sstypes = {coils:"red", strands:"green", helices:"blue", terms:'purple'};
		var minx=1e10, miny=1e10, maxx=-1e10, maxy=-1e10;
		for(var st in sstypes) {
			eval("var sselems = self.topodata."+st+";");
			for(var ci=0; ci < sselems.length; ci++) {
				var ass = sselems[ci];
				for(var pi=0; pi < ass.path.length; pi+=2) {
					if(minx > ass.path[pi+0]) minx = ass.path[pi+0];
					if(miny > ass.path[pi+1]) miny = ass.path[pi+1];
					if(maxx < ass.path[pi+0]) maxx = ass.path[pi+0];
					if(maxy < ass.path[pi+1]) maxy = ass.path[pi+1];
				}
			}
		}
		return [minx,miny,maxx,maxy];
	},
	scaleXall: function() {
		var self = this;
		var sstypes = {coils:"red", strands:"green", helices:"blue", terms:'purple'};
		for(var st in sstypes) {
			eval("var sselems = self.topodata."+st+";");
			for(var ci=0; ci < sselems.length; ci++) {
				var ass = sselems[ci];
				if(st == "coils") {
					for(var pi=0; pi < ass.path.length; pi+=2) ass.path[pi] *= self.allXscale;
				}
				else {
					var midx = 0;
					for(var pi=0; pi < ass.path.length; pi+=2) midx += ass.path[pi];
					midx = midx * (self.allXscale-1) / (ass.path.length/2);
					for(var pi=0; pi < ass.path.length; pi+=2) ass.path[pi] += midx;
				}
			}
		}
	},
	scaleYall: function() {
		var self = this;
		var sstypes = {coils:"red", strands:"green", helices:"blue", terms:'purple'};
		for(var st in sstypes) {
			eval("var sselems = self.topodata."+st+";");
			for(var ci=0; ci < sselems.length; ci++) {
				var ass = sselems[ci];
				for(var pi=0; pi < ass.path.length; pi+=2) {
					ass.path[pi+1] = ass.path[pi+1] * self.allYscale;
				}
			}
		}
	},
	findPathExtents: function(path) {
		var minx=1e10, miny=1e10, maxx=-1e10, maxy=-1e10;
		for(var pi=0; pi < path.length; pi+=2) {
			if(maxx < path[pi+0]) maxx = path[pi+0];
			if(maxy < path[pi+1]) maxy = path[pi+1];
			if(minx > path[pi+0]) minx = path[pi+0];
			if(miny > path[pi+1]) miny = path[pi+1];
		}
		return [minx, miny, maxx, maxy];
	},

	editLoopsHorizontals: function() {
		var self = this;
		for(var ci=0; ci < self.topodata.coils.length; ci++) {
			var ass = self.topodata.coils[ci];
			var ext = self.findPathExtents(ass.path);
			var minx=ext[0], miny=ext[1], maxx=ext[2], maxy=ext[3];
			var area = (maxx-minx) * (maxy-miny);
			for(var pi=0; pi < ass.path.length; pi+=2) {
				if(pi > ass.path.length-4 || pi < 2) continue; // must have 1 point before, 2 after
				if( Math.abs(ass.path[pi+1]-ass.path[pi+3]) > 1e-3 ) continue; // must be in horizontal segment, same Y
				if( Math.abs(ass.path[pi+0]-ass.path[pi-2]) > 1e-3 ) continue; // segment should have vertical nbrs, same X
				if( Math.abs(ass.path[pi+2]-ass.path[pi+4]) > 1e-3 ) continue; // segment should have vertical nbrs, same X
				if( (ass.path[pi+1]-ass.path[pi-1])*(ass.path[pi+3]-ass.path[pi+5]) < 0 ) continue; // nbrs shd go in same Y direction
				var dy = self.loopdip;
				if(self.loopdip == 'useArea') dy = area/2500;
				if( (ass.path[pi+1]-ass.path[pi-1]) < 0 ) { // nbrs go up
					ass.path[pi+1] = ass.path[pi+1] - dy;
					ass.path[pi+3] = ass.path[pi+3] - dy;
				}
				else {
					ass.path[pi+1] = ass.path[pi+1] + dy;
					ass.path[pi+3] = ass.path[pi+3] + dy;
				}
			}
		}
	},

	errorLayout: function() {
		var self = this;
		document.getElementById(self.config['target']).innerHTML = "ERROR!!";
	},

	populate_domain_selector: function() {
		var self = this;
		function add(dt) {
			var dom_selector = document.getElementById(self.config.domseldiv);
			var opt = document.createElement("option");
			opt.value = dt; opt.innerHTML = dt;
			dom_selector.appendChild(opt);
		}
		for(var dt in self.topodata.domains)
			add(dt);
		add("Quality");
	},

	change_domain_in_selector: function(domtype) {
		var self = this;
		var dom_selector = document.getElementById(self.config.domseldiv);
		jQuery.each(dom_selector.options, function(oi, opt) {
			if(opt.value == domtype) opt.selected = true;
		});
	},

	topoLayout: function() {
		var self = this, conf = self.config;
		//self.config['rapha'] = Raphael('topo_rapha_'+self.config['target'], self.config['size']+"px", self.config['size']+"px");
		document.getElementById(self.config.raphadiv).innerHTML = "";
		self.config['rapha_canvas'] = new Biojs.RaphaelCanvas({target:self.config.raphadiv, dimension:self.config['size']});
		self.config['rapha'] = self.config['rapha_canvas'].rapha;
		self.config.rapha.setViewBox(0,0, self.config['size'], self.config['size']);
		//self.sanitycheckLayout(); return;
		var topodata = self.topodata;
		self.populate_domain_selector();
		self.scaleYall();
		self.scaleXall();
		self.editLoopsHorizontals();
		self.fitToBox();
		if(self.checkDataSanity(topodata) == false) { alert("Data error!! Cannot continue."); return; }
		var stroke_color = self.colormaker.getChainColor(conf.pdbid, conf.entity_id, conf.chain_id);
		var ssattrib = {'stroke-width':1,'stroke':stroke_color};
		var unmappedattrib = {'stroke-dasharray':'- .','stroke':stroke_color}; // ["", "-", ".", "-.", "-..", ". ", "- ", "--", "- .", "--.", "--.."]
		// loops
		for(var ci=0; ci < topodata.coils.length; ci++) {
			var ass = topodata.coils[ci];
			var looppath = [], attribs = {};
			if(ass.start == -1 && ass.stop == -1) attribs = unmappedattrib;
			else attribs = ssattrib;
			var looppath = self.makeLoopPathArray(ass.path);
			self.config.rapha.path(looppath).attr(attribs);
			if(ass.start != -1 && ass.stop != -1) self.makeResidueSubpaths(looppath, ass.start, ass.stop);
		}
		// strand
		for(var ci=0; ci < topodata.strands.length; ci++) {
			var ass = topodata.strands[ci];
			var looppath = [];
			for(var xi=0; xi < 3; xi++) {
				xj = 2*xi; xk = 12-2*xi;
				var sxex = self.scaleX(ass.path[xj],ass.path[xk]);
				ass.path[xj] = sxex[0] ; ass.path[xk] = sxex[1];
			}
			for(var pi=0; pi < ass.path.length; pi+=2) {
				looppath.push(ass.path[pi]); looppath.push(ass.path[pi+1]);
			}
			looppath = self.spliceMLin(looppath); looppath.push("Z");
			ass.gelem = self.config.rapha.path(looppath).attr(ssattrib);
			var respath = [ "M", ass.path[6], ass.path[7], "L",
				(ass.path[0]+ass.path[12])/2, (ass.path[1]+ass.path[13])/2 ];
			if (ass.path[1] > ass.path[7]) ass.direction = "up";
			else ass.direction = "down";
			self.makeResidueSubpaths(respath, ass.start, ass.stop, "yes");
		}
		// helices
		for(var ci=0; ci < topodata.helices.length; ci++) {
			var ass = topodata.helices[ci];
			var sxex = self.scaleX(ass.path[0],ass.path[2]);
			var sx = sxex[0] , ex = sxex[1];
			var sy = ass.path[1]; var ey = ass.path[3];
			var rx = ass.majoraxis*self.thinssXscale; var ry = ass.minoraxis*1.3*self.allYscale;
			lf1 = 0; lf2 = 0; lf3 = 0; // flags for proper elliptical arcs
			sf1 = 0; sf2 = 0; sf3 = 0;
			if(sy < ey) {
				lf1 = 1; lf2 = 1; lf3 = 1;
				sf1 = 1; sf2 = 1; sf3 = 1;
			}
			cylpath = ["M", sx, ey, "L", sx, sy, "A", rx, ry, 180, lf1, sf1, ex, sy, "L", ex, ey,"A", rx, ry, 180, lf3, sf3, sx, ey , "Z"];
			ass.gelem = self.config.rapha.path(cylpath).attr(ssattrib);
			if(sy < ey) { resy1 = sy-ry; resy2 = ey+ry; ass.direction="down"; }
			else        { resy1 = sy+ry; resy2 = ey-ry; ass.direction="up"; }
			var respath = [ "M", (sx+ex)/2, resy1, "L", (sx+ex)/2, resy2 ];
			self.makeResidueSubpaths(respath, ass.start, ass.stop);
		}
		// terms
		var fontattr = {'font':(self.basicwidth)+'px "Arial"','text-anchor':'middle'};
		for(var ci=0; ci < topodata.terms.length; ci++) {
			var ass = topodata.terms[ci];
			var looppath = [];
			for(var pi=0; pi < ass.path.length; pi+=2) {
				looppath.push(ass.path[pi]); looppath.push(ass.path[pi+1]);
			}
			looppath = self.spliceMLin(looppath); looppath.push("Z");
			// ass.gelem = self.config.rapha.path(looppath).attr(ssattrib).attr({'stroke-width':0}); // do not need shape anymore
			// var respath = [ "M", (ass.path[0]+ass.path[2]+ass.path[4]+ass.path[6])/4, ass.path[7],
			//                "L", (ass.path[0]+ass.path[2]+ass.path[4]+ass.path[6])/4, ass.path[3] ];
			// if(ass.start != -1 && ass.stop != -1) self.makeResidueSubpaths(respath, ass.start, ass.stop);
			if(ass.type == "N") ass.gelem = self.config.rapha.text(looppath[4],looppath[2],"N").attr(fontattr).attr({stroke:'blue',fill:'blue'});
			if(ass.type == "C") ass.gelem = self.config.rapha.text((looppath[1]+looppath[6])/2,(looppath[2]+looppath[7])/2,"C").attr(fontattr).attr({stroke:'red',fill:'red'});
		}
		self.subscribe_to_topics();
	},

	subscribe_to_topics: function() {
		var self = this;
		if(!self.config.listen_topics) return;
		for(var etype in Biojs.PDBeventHelper.event_types) {
			jQuery.Topic(etype).subscribe( function(edata) {
				self.event_response(edata.event_type, edata);
			} );
		}
	},

	event_response: function(etype, edata) {
		var self = this;
		if(edata.source && edata.source == self) return;
		if     (etype == Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_IN)
			self.residue_hover_listener(edata, false);
		else if(etype == Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_OUT)
			self.residue_hover_listener(edata, true);
		else if(etype == Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_CLICK)
			self.make_residue_selection(edata);
		else if(etype == Biojs.PDBeventHelper.event_types.MODELLED_DOMAIN_MOUSE_IN)
			self.domain_hover_listener(edata, false);
		else if(etype == Biojs.PDBeventHelper.event_types.MODELLED_DOMAIN_MOUSE_OUT)
			self.domain_hover_listener(edata, true);
		else if(etype == Biojs.PDBeventHelper.event_types.SEQUENCE_DOMAIN_MOUSE_IN)
			self.domain_hover_listener(edata, false);
		else if(etype == Biojs.PDBeventHelper.event_types.SEQUENCE_DOMAIN_MOUSE_OUT)
			self.domain_hover_listener(edata, true);
		else
			; //console.error("Topology component could not handle event", etype, edata.event_type, edata);
	},

	domain_hover_listener: function(data, fade) {
		var self = this;
		if(!self.check_event_pdbid_chain(data)) return;
		//if(!fade && self.topodata.domains[data.domain_type])
		//	self.showDomains(data.domain_type);
		self.residue_hover_fade(null, data.seq_id_ranges, fade);
		//if(fade && self.topodata.domains[data.domain_type])
		//	self.showDomains("Annotations");
	},
	residue_hover_listener: function(data, fade) {
		var self = this;
		if(!self.topodata) return;
		if(data.pdb_id != self.config.pdbid || data.pdb_chain_id != self.config.chain_id) return;
		//console.log("heard", data, data.seq_id, typeof(data.seq_id), self.resi2paths, self.resi2paths[data.seq_id]);
		//console.log("heard", data, self.resi2paths[data.seq_id], self.respaths[ self.resi2paths[data.seq_id][0] ]);
		self.residue_hover_fade(data.seq_id, null, fade);
	},
	check_event_pdbid_chain: function(data) {
		var self = this;
		if(data.pdb_id != self.config.pdbid) return false;
		if(data.pdb_chain_id && data.pdb_chain_id != self.config.chain_id) return false;
		return true;
	},
	clear_residue_selection: function() {
		var self = this;
		if(self.selected_elems)
			for(var si=0; si < self.selected_elems.length; si++)
				self.selected_elems[si].remove();
		self.selected_elems = [];
	},
	make_residue_selection: function(data) {
		var self = this;
		self.clear_residue_selection();
		if(!self.check_event_pdbid_chain(data)) return;
		var reselem = self.resi2paths[data.seq_id];
		if(!reselem) return;
		reselem = self.respaths[ reselem[0] ];
		reselem = reselem.clone();
		reselem.attr( {'stroke-opacity':0.5, 'stroke':'#FBB917', 'stroke-width':reselem.attr('stroke-width')*2} );
		self.selected_elems.push(reselem);
	},
	make_ranges_from_index_if_required: function(index,ranges) {
		var theranges = [];
		if(index) theranges.push([index,index]);
		else theranges = ranges;
		return theranges;
	},
	residue_hover_fade: function(index, ranges, fade) { // provide either of index or ranges
		var self = this;
		var theranges = self.make_ranges_from_index_if_required(index, ranges);
		if(theranges == null) {
			console.error("index error", theranges, index, ranges);
			return;
		}
		for(var ai=0; ai < theranges.length; ai++) {
			for(var ri = theranges[ai][0]; ri <= theranges[ai][1]; ri++) {
				if(!self.resi2paths[ri]) continue;
				var reselem = self.respaths[ self.resi2paths[""+ri][0] ];
				//var re = reselem.glow({width:15, fill:true, opacity:1});
				//re.animate( {opacity:0}, 1000, function() { this.remove(); }  );
				if(!fade) reselem.attr( {'stroke-width':10, 'stroke-opacity':0.5,} );
				else      reselem.attr( {'stroke-opacity':0.01} ); // animating problematic when too many events are coming in
				//else      reselem.animate( {'stroke-opacity':0.01}, 100, function() {} );
			}
		}
	},

	fitToBox: function() {
		var self = this;
		// find transform to go from p,q to a,b
		var margin = 10;
		var ax=margin, ay=margin, bx=self.config.size-margin, by=self.config.size-margin;
		var extents = self.findExtents();
		var px=extents[0] ,py=extents[1], qx=extents[2], qy=extents[3];
		// find scale
		self.fitscale = (bx-ax)/(qx-px);
		if(self.fitscale > (by-ay)/(qy-py))
			self.fitscale = (by-ay)/(qy-py);
		// transform
		var sstypes = {coils:"red", strands:"green", helices:"blue", terms:'purple'};
		for(var st in sstypes) {
			eval("var sselems = self.topodata."+st+";");
			for(var ci=0; ci < sselems.length; ci++) {
				var ass = sselems[ci];
				for(var pi=0; pi < ass.path.length; pi+=2) {
					ass.path[pi+0] = (ass.path[pi+0]-px) * self.fitscale + ax;
					ass.path[pi+1] = (ass.path[pi+1]-py) * self.fitscale + ay;
				}
				if(st=="helices") {
					ass.majoraxis *= self.fitscale; ass.minoraxis *= self.fitscale;
					self.basicwidth = ass.majoraxis;
				}
				if(st=="strands") {
					self.basicwidth = Math.abs(ass.path[4]-ass.path[8]);
				}
			}
		}
		// center
		extents = self.findExtents();
		dx = (extents[0]+extents[2])/2 - (ax+bx)/2 ;
		dy = (extents[1]+extents[3])/2 - (ay+by)/2 ;
		// transform
		for(var st in sstypes) {
			eval("var sselems = self.topodata."+st+";");
			for(var ci=0; ci < sselems.length; ci++) {
				var ass = sselems[ci];
				for(var pi=0; pi < ass.path.length; pi+=2) {
					ass.path[pi+0] -= dx;
					ass.path[pi+1] -= dy;
				}
			}
		}
	},

	makeResidueSubpaths: function(fullpath, startresi, stopresi, reverse) {
		var self = this, conf = self.config;
		self.glowstyle = {width:0.1*self.basicwidth};
		var unitlen = Raphael.getTotalLength(fullpath)/(stopresi-startresi+1);
		var coilextents = [];
		var stroke_color = self.colormaker.getChainColor(conf.pdbid, conf.entity_id, conf.chain_id);
		for(var ri=0; ri < stopresi-startresi+1; ri++) {
			var subpathattr = {'stroke':stroke_color, 'stroke-width':self.basicwidth, 'stroke-opacity':0.01}; // keep opacity > 0 so that mouse events are detected! can use self.colormaker.getRandomColor() for color
			var subpath = Raphael.getSubpath(fullpath, unitlen*ri, unitlen*(ri+1));
			var resindex = startresi + ri;
			if(reverse=="yes") resindex = stopresi - ri;
			//var incoil = false;
			//for(var ci=0; ci < self.topodata.coils.length; ci++) {
			//	if(self.topodata.coils[ci].start <= resindex && resindex <= self.topodata.coils[ci].stop) { incoil = true; break; }
			//}
			var incoil = true; // lets make all ss glow, not just coils. let's keep the above code in case we reverse this idea
			var rp = self.config.rapha.path(subpath).toFront().attr(subpathattr).data("resindex",resindex).data("topowidget",self).data("doGlow",incoil)
			.click( function(e) {
				var resinfo = this.data("topowidget").getResInfo(this.data("resindex"));
				if(resinfo != "in_progress")
					self.fire_event(
						Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_CLICK,
						Biojs.PDBeventHelper.event_makers.MODELLED_RESIDUE_CLICK(self.entity.getPdbid(), self.entity.getEid(), self.chain.getAuthAsymId(), resinfo.residue_number)
					);
			})
			.mouseover( function(e) {
				if(this.data("doGlow")==true) this.glowelem = this.glow(self.glowstyle);
				var resinfo = this.data("topowidget").getResInfo(this.data("resindex"));
				if(resinfo != "in_progress")
					self.fire_event(
						Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_IN,
						Biojs.PDBeventHelper.event_makers.MODELLED_RESIDUE_MOUSE_IN(self.entity.getPdbid(), self.entity.getEid(), self.chain.getAuthAsymId(), resinfo.residue_number)
					);
			})
			.mouseout( function(e) {
				//self.changeTooltip(false);
				if(this.data("doGlow")==true) this.glowelem.remove();
				var resinfo = this.data("topowidget").getResInfo(this.data("resindex"));
				if(resinfo != "in_progress")
					self.fire_event(
						Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_OUT,
						Biojs.PDBeventHelper.event_makers.MODELLED_RESIDUE_MOUSE_OUT(self.entity.getPdbid(), self.entity.getEid(), self.chain.getAuthAsymId(), resinfo.residue_number)
					);
			});
			jQuery(rp.node).data("resindex", resindex);
			jQuery(rp.node).qtip({
				content: {
					text: function(api) { return self.getTooltipText( jQuery(api.target).data("resindex") ); }
				},
				position: { target: "mouse", adjust: {x:5, y:5} },
				style: { 'classes': 'qtip-bootstrap qtip-shadow qtip-rounded' },
				show: { delay: 1 }
			});
			self.respaths.push(rp);
			if(!self.resi2paths[resindex]) self.resi2paths[resindex] = [];
			self.resi2paths[resindex].push( self.respaths.length-1 );
		}
	},

	fire_event: function(et,ed) {
		var self = this;
		self.raiseEvent(et, ed);
		if(self.config.fire_topics) {
			ed.source = self;
			jQuery.Topic(et).publish(ed);
		}
	},

	getTooltipText: function(resindex) {
		var self = this, ttext = null;
		var resinfo = self.getResInfo(resindex);
		if(resinfo == "in_progress")
			ttext = "Residue information being obtained";
		else {
			var icode = resinfo.author_insertion_code;
			if(!resinfo.author_insertion_code) icode = "";
			ttext = (resinfo.residue_name+"("+resinfo.author_residue_number+icode+")").replace(/ /g,'');
		}
		return ttext;
	},

	startResValidationCall: function() {
		var self = this, conf = self.config, topodata = self.topodata;
		if(self.validation_api_called) return;
		self.validation_api_called = "in_progress";
		Biojs.PDB_API_AJAX_Helper(
			self.config.apiURL,
			[ "/validation/residuewise_outlier_summary/entry/" + self.config["pdbid"] ],
			function() {
				self.entry.makeValidationResidueSummary(Biojs.PDBajaxData);
				self.validation_api_called = "finished";
			},
			function() {
				self.validation_api_called = "failed";
				console.warn("There is a problem in obtaining residuewise validation information.");
			}
		);
	},

	startResInfoCall: function() {
		var self = this, ttext = null;
		if(self.topodata.reslist) return;
		self.topodata.reslist = "in_progress";
		Biojs.PDB_API_AJAX_Helper(
			self.config.apiURL,
			[ "/pdb/entry/residue_listing/" + self.config["pdbid"] + "/chain/" + self.config.chain_id ],
			function() {
				self.entry.makeResidueListing(Biojs.PDBajaxData, self.config.chain_id);
				self.topodata.reslist = self.chain.getResidueListing();
				return self.topodata.reslist;
			},
			function() {
				console.warn("There is a problem in obtaining residue listing.");
				self.topodata.reslist = "failed";
			}
		);
	},

	getResInfo: function(resindex) {
		var self = this;
		if(self.topodata.reslist == "in_progress")
			return "in_progress";
		return self.topodata.reslist[resindex];
	},

	checkDataSanity: function(topodata) {
		var sstypes = {coils:"red", strands:"green", helices:"blue", terms:'purple'};
		// using only start, stop, path properties of ss elements in json
		var sortedcoils = [];
		for(var st in sstypes) { // just join all sec str elems in an array
			eval("var sselems = topodata."+st+";");
			for(var ci=0; ci < sselems.length; ci++) {
				var ass = topodata['coils'][ci];
				if(ass.start == -1 && ass.stop == -1) ;
				else if(ass.start == -1 || ass.stop == -1) { alert(ass.start + " " + ass.stop); return false; }
			}
		}
		return true;
	},

	spliceMLin: function(apath, style) {
		if(!style) {
			apath.splice(0,0,"M"); apath.splice(3,0,"L");
		}
		else {
			apath.splice(0,0,"M"); apath.splice(3,0,style);
		}
		return apath;
	},

	sanitycheckLayout: function() {
		// just draw  few things for sanity check.... not directly useful in topology layout
		var self = this;
		var sanityAttribs = {"checksanity":1};
		self.config['rapha'].setStart();
		if(sanityAttribs.checksanity == 1) {
			self.config['rapha'].text(5,5,"Under construction").attr({'text-anchor':'start'});
			self.config['rapha'].path([ "M", 0, 0, "L", self.config["size"], self.config["size"] ]);
			self.config['rapha'].path([ "M", 0, self.config["size"], "L", self.config["size"], 0 ]);
			// check if an arbit path be drawn to go through a set of points
			self.config.rapha.circle(100,100,10);
			self.config.rapha.circle(150,50,10);
			self.config.rapha.circle(200,100,10);
			mypath = ["M", 100, 100, "T", 150, 50, "T", 200, 100];
			mypath = self.config.rapha.path(mypath);
			//mypath.glow({width:2, offsetx:10, offsety:10});
			c1 = self.config.rapha.path(["M", 100, 100, "L", 100, 150, 150, 150, 150, 100]);
			c2 = self.config.rapha.path(["M", 110, 110, "L", 110, 160, 160, 160, 160, 110]).attr({fill:'red','fill-opacity':0.1})
				.mouseover(function() {
					alert("hello");
				});
		}
		var sanityset = self.config['rapha'].setFinish();
		sanityset.attr(sanityAttribs);
	},

  /**
   * Array containing the supported event names
   * @name Biojs.PDBchainTopology-eventTypes
   */
  eventTypes : [
	/**
	 * @name Biojs.PDBchainTopology#onClick
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
	 * @name Biojs.PDBchainTopology#onHelloSelected
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
     "onHelloSelected",
     Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_IN,
     Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_OUT,
     Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_CLICK
  ] 
});


if(typeof PDBchainTopologyRegistry == 'undefined') PDBchainTopologyRegistry = {};
var topoSelectorChanged = function(divid) {
	var topowidget = PDBchainTopologyRegistry[divid];
	topowidget.showDomains();
}
var activesiteClicked = function(divid) {
	var topowidget = PDBchainTopologyRegistry[divid];
	topowidget.showActivesite("triangle");
	//topowidget.showActivesite("square");
	//topowidget.showActivesite("diamond");
	//topowidget.showActivesite("circle");
}

