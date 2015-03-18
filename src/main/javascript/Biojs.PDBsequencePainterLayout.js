
Biojs.PDBsequencePainterLayout = Biojs.extend (
{
	constructor: function (options) {
		var self = this;
		self.check_indexOf();
		self.colormaker = Biojs.theOnlyPDBcolourFactory;
		self.configs = options;
		self.pdb = Biojs.getPDBdatabroker(self.configs.api_url);
		if(self.configs.style == "mini")
			return self.mini_layout();
		else if(self.configs.style == "modelled_domains")
			return self.modelled_domains_layout();
		else if(self.configs.style == "valid_summary")
			return self.valid_summary_layout();
		else {
			console.error("Layout style not implemented....", self.configs.style);
		}
		return;
	},
	check_indexOf: function() {
		if(Array.prototype.indexOf) return;
		Array.prototype.indexOf = function(elem, startFrom) {
			var startFrom = startFrom || 0;
			if (startFrom > this.length) return -1;
			for (var i = 0; i < this.length; i++) {
				if (this[i] == elem && startFrom <= i) {
					return i;
				} else if (this[i] == elem && startFrom > i) {
					return -1;
				}
			}
			return -1;
		};
	},
	make_single_api_url: function(api_urls) {
		var self = this, conf = self.configs;
		var urlstr = '';
		for(var ai=0; ai < api_urls.length; ai++) urlstr += api_urls[ai] + ",";
		urlstr = urlstr.replace(/,$/, "");
		return conf.api_url + '/callgroup/' + urlstr;
	},
	valid_summary_layout: function() {
		var self = this, conf = self.configs;
		var api_urls = [
			"/pdb/entry/summary/" + conf.pdbid,
			"/pdb/entry/experiment/" + conf.pdbid,
			"/validation/summary_quality_scores/entry/" + conf.pdbid
		];
		// make arrays of entity info
		if(! (conf.entity_id instanceof Array) ) {
			for(var atn in {entity_id:1, target:1, width:1, height:1, click_url:1})
				conf[atn] = [conf[atn]];
		}
		// show layout in each div
		jQuery.each(conf.target, function(di,adivid) {
			jQuery("#"+adivid).html("Loading validation summary scores...");
		});
		self.get_api_data_then_layout(api_urls, 'valid_summary_layout_callback');

	},
	valid_summary_layout_callback: function() {
		var self = this, conf = self.configs;
		var entry = self.pdb.makeEntry(conf.pdbid, conf.api_data);
		entry.makeExperiments(conf.api_data);
		var quality_info = conf.api_data["/validation/summary_quality_scores/entry/"+conf.pdbid];
		if(!quality_info) quality_info = {};
		if(!quality_info[conf.pdbid]) quality_info[conf.pdbid] = {};
		var tot_width = 99;
		var gradient = "0";
		var grads = [ [0 , '#ff0000'],[ 10 , '#ff5a5a'],[ 20 , '#ffa0a0'],[ 30 , '#ffd2d2'],[ 40 , '#ffe0e0'],[ 50 , '#eeeeee'],[ 60 , '#e0e0ff'],[ 70 , '#d2d2ff'],[ 80 , '#a0a0ff'],[ 90 , '#5a5aff'],[ 100 , '#0000ff'] ];
		for(var gi=0; gi < grads.length; gi++) {
			gradient += "-" + grads[gi][1] + ":" + grads[gi][0];
		}
		var rows = [];
		var topline = conf.height[0] * 0.3, baseline = conf.height[0] * 0.7;
		var marker_topline = conf.height[0] * 0.2, marker_baseline = conf.height[0] * 0.8;
		for(var st in {"geometry":1, "data":1}) {
			var rows_painters = [{
				type: "domain", ranges: [ [0, tot_width-1] ], fill:gradient, stroke:"grey", stroke_width:1,
				topline:topline, baseline: baseline
			}];
			var quality = quality_info[conf.pdbid][st+"_quality"];
			var marker_start = tot_width * 0.5;
			if(quality == null || quality == undefined) {
				var text = "Not available";
				if(entry.isXrayEntry() && !entry.hasXrayData())
					text = "X-ray data not deposited";
				rows_painters.push( {
					type: "domain", ranges: [ [0, tot_width] ], topline:topline, baseline:baseline, label: {text:text, anchor:"middle"}
				} );
			}
			else {
				var num_discrete = 3.;
				marker_start = (tot_width/num_discrete) * (Math.floor(quality/(100./num_discrete))+0.5);
				var marker_width = tot_width / 30;
				rows_painters.push( {
					type: "domain", ranges: [ [marker_start,marker_start+marker_width] ],
					fill:"white", stroke:"black", stroke_width:"2", fill_opacity:0.1,
					topline:marker_topline, baseline: marker_baseline
				} );
			}
			rows.push( {
				height: conf.height[0], id:"valid_score_"+st,
				painters: rows_painters
			} );
		}
		jQuery.each(conf.target, function(ti, target) {
			jQuery("#"+conf.target).html("");
			new Biojs.PDBsequencePainter({
				target: target,
				dimensions: { canvas_width : conf.width[ti], left_label_width : 0, right_label_width : 0 },
				units_per_index: 2,
				seq_len: 99,
				rows: rows
			})
		});
	},
	mini_layout: function() {
		var self = this, conf = self.configs;
		var api_urls = [
			"/pdb/entry/summary/" + conf.pdbid,
			"/pdb/entry/entities/" + conf.pdbid,
			"/pdb/entry/polymer_coverage/" + conf.pdbid
		];
		// make arrays of entity info
		if(! (conf.entity_id instanceof Array) ) {
			for(var atn in {entity_id:1, target:1, width:1, height:1, click_url:1})
				conf[atn] = [conf[atn]];
		}
		// show layout in each div
		jQuery.each(conf.target, function(di,adivid) {
			jQuery("#"+adivid).html("Loading...");
		});
		self.get_api_data_then_layout(api_urls, 'mini_layout_callback');
	},
	modelled_domains_layout: function() {
		var self = this, conf = self.configs;
		var api_urls = [
			"/pdb/entry/summary/" + conf.pdbid,
			"/pdb/entry/entities/" + conf.pdbid,
			"/pdb/entry/polymer_coverage/" + conf.pdbid,
			"/pdb/entry/secondary_structure/" + conf.pdbid,
			"/pdb/entry/binding_sites/" + conf.pdbid,
		];
		jQuery("#"+conf.target).html("Loading...");
		self.get_api_data_then_layout(api_urls, 'modelled_domains_layout_callback');
	},
	get_api_data_then_layout: function(api_urls, success_callback) {
		var self = this, conf = self.configs;
		if(conf.api_data) {
			self[success_callback]();
			return;
		}
		Biojs.PDB_API_AJAX_Helper(
			conf.api_url,
			api_urls,
			function() {
				self.get_more_optional_info(success_callback);
			},
			function() {
				alert("There was an error in communicating with PDBe API - please report to pdbehelp@ebi.ac.uk");
				document.getElementById(conf.target).innerHTML = "Sorry, an error occurred.";
			}
		);
	},
	get_more_optional_info: function(success_callback) {
		var self = this, conf = self.configs;
		var call_anyway = function() {
			conf.api_data = Biojs.PDBajaxData;
			console.log('Starting PDBsequencePainterLayout callback', success_callback, conf.api_data);
			self[success_callback]();
		}
		Biojs.PDB_API_AJAX_Helper(
			conf.api_url,
			[
				"/pdb/entry/residue_listing/" + conf.pdbid,
				"/mappings/" + conf.pdbid,
				"/validation/residuewise_outlier_summary/entry/" + conf.pdbid
			],
			call_anyway,
			function() {
				console.warn("Some optional info could not be obtained....");
				call_anyway();
			}
		);
	},
	get_best_other_chains_str: function(ent) {
		var best_chain_id = ent.getBestModelledInstance().getAuthAsymId();
		var more_chains = "", more_chain_ids = [];
		if(ent.getChains().length > 1) {
			var plural = "";
			if(ent.getChains().length-1 > 1)
				plural = "s";
			more_chains = ". It is also modelled in chain" + plural;
			jQuery.each(ent.getChains(), function(chi, chain) {
				if(best_chain_id != chain.getAuthAsymId())
					more_chain_ids.push( chain.getAuthAsymId() );
			});
			more_chains += " " + more_chain_ids.join();
		}
		return [best_chain_id, more_chains];
	},
	mini_layout_callback: function() {
		// make PDB objects from api data
		var self = this, conf = self.configs;
		var entry = self.pdb.makeEntry(conf.pdbid, conf.api_data);
		entry.makeEntities(conf.api_data);
		entry.makeStructuralCoverage(conf.api_data);
		// for each entity 
		var tooltip_template = Handlebars.compile("PDB {{entry_id}} has '{{entity_name}}' {{{best_modelled}}}modelled in chain {{chain_id}}{{more_chains}}.");
		jQuery.each(conf.entity_id, function(mi,eid) {
			var ent = entry.getEntity(eid);
			var chids_strs = self.get_best_other_chains_str(ent);
			var model_style = "uniquely ";
			if(ent.instances.length > 1)
				model_style = "best ";
			var ent_tooltip = tooltip_template({
				entry_id:ent.getPdbid(), entity_id:ent.getEid(), entity_name:ent.getName(),
				chain_id:chids_strs[0], best_modelled:model_style,
				more_chains:chids_strs[1]
			});
			var obs_ranges = [];
			jQuery.each(ent.getBestModelledInstance().getObservedRanges(), function(ari,arange) {
				obs_ranges.push([arange.pdb_start-1, arange.pdb_end-1]);
			});
			var tooltip_events_data = {
				tooltip:{ text:ent_tooltip },
				event_handlers:{
					click:function(painter, index, ranges) {
						window.open(painter.data.click_url);
					}
				},
				data:{
					click_url:conf.click_url[mi]
				}
			};
			var the_rows = [
				{
					height: conf.height[mi], id:"full_obs_range",
					//left_label: "N", right_label: "C",
					painters: [
						{
							type:"domain", ranges:[ [0,ent.getLength()-1] ],
							topline:conf.height[mi]*0.4, baseline:conf.height[mi]*0.6, fill:"#666",
						},
						{
							type:"domain", ranges:obs_ranges,
							topline:0, baseline:conf.height[mi]-1, fill:"#007fff",
						}
					]
				}
			];
			jQuery.each(tooltip_events_data, function(k,v) {
				the_rows[0].painters[0][k] = v
				the_rows[0].painters[1][k] = v
			});
			jQuery("#"+conf.target[mi]).html("");
			new Biojs.PDBsequencePainter({
				target: conf.target[mi],
				dimensions: { canvas_width : conf.width[mi], left_label_width : 0, right_label_width : 0 },
				units_per_index: 10,
				seq_len: ent.getLength(),
				rows: the_rows,
			});
		});
	},
	modelled_domains_layout_callback: function() {
		var self = this, conf = self.configs;
		// initialize PDB objects
		var entry = self.pdb.makeEntry(conf.pdbid, conf.api_data);
		entry.makeEntities(conf.api_data);
		entry.makeSiftsMappings(conf.api_data);
		entry.makeStructuralCoverage(conf.api_data);
		entry.makeSecondaryStructure(conf.api_data);
		entry.makeBindingSites(conf.api_data);
		entry.makeResidueListing(conf.api_data);
		entry.makeValidationResidueSummary(conf.api_data);
		self.ent = entry.getEntity(conf.entity_id);
		// TODO some dimesions to be calculated properly later
		var arbit_row_height = 20;
		var lwidth = 100, rwidth = 0;
		var upi = 20, seq_font = 16;
		// make row for zoom bar
		var the_rows = [{
			height:arbit_row_height, id:"zoom_row",
			painters: [ {type:"zoom"} ]
		}];
		// make row for entity
		the_rows.push({
			height:arbit_row_height, left_label:'Molecule', right_label:null, id:"entity_row",
			painters:[
				{type:"domain", ranges:[[0,self.ent.getLength()-1]], topline:arbit_row_height*0.2, baseline:arbit_row_height*0.8, fill:self.colormaker.getDomainColor("entity",self.ent.getEid()),
					tooltip:{
						tfunc: function(painter, index, ranges) { return "Entity " + self.ent.getEid() + " : Residue " + (index+1) + " : " + self.ent.getSequence()[index]; }
					},
				},
				{type:"sequence", sequence: self.ent.getSequence(), baseline:arbit_row_height/2, color:'white'}
			]
		});
		// make row for entity's pfam and uniprot annotations
		for(var sdtype in {"UniProt":1, "Pfam":1}) {
			var unp_painters = self.make_seqdom_painters_for_entity(sdtype, self.ent, arbit_row_height);
			if(unp_painters.length > 0) {
				the_rows.push({
					height:arbit_row_height, left_label:sdtype, right_label:null, id:sdtype+"_row",
					painters:unp_painters
				});
			}
		}
		// make rows for best chain's modelled portions, secondary structure, scop and cath domains
		self.chains_order = [ self.ent.getBestModelledInstance().getAuthAsymId() ];
		jQuery.each(self.ent.instances, function(ii, inst) {
			if(inst.getAuthAsymId() != self.chains_order[0]) self.chains_order.push(inst.getAuthAsymId());
		});
		var chain_rows = self.make_chain_rows(self.chains_order[0], arbit_row_height);
		the_rows = the_rows.concat(chain_rows);
		// finally make the PDBsequencePainter
		jQuery("#"+conf.target).html("");
		self.seq_painter = new Biojs.PDBsequencePainter({
			target: conf.target,
			dimensions: { canvas_width : conf.width-lwidth-rwidth, left_label_width : lwidth, right_label_width : rwidth },
			units_per_index: upi,
			seq_font_size : seq_font,
			seq_len: self.ent.getLength(),
			rows: the_rows,
			menu_maker: function(top_div,bottom_div) { self.make_menu(top_div,bottom_div); }
		});
		self.subscribe_to_topics();
	},
	make_menu: function(top_div, bottom_div) {
		var self = this, conf = self.configs;
		self.make_bottom_menu(bottom_div);
		self.make_top_menu(top_div);
	},
	make_top_menu: function(top_div) {
		var self = this, conf = self.configs;
		var help_icon = top_div + "_help", right_floater = top_div + "_right", left_floater = top_div + "_left";
		var menu_template = Handlebars.compile(" \
			<div style='float:right;' id='{{right_floater}}'> \
			</div> \
			<div style='float:left;'  id='{{left_floater}}' > \
				<div id='{{help_icon}}'></div> \
			</div> \
			<br style='width:0px;clear:left;'/> \
		");
		jQuery('#'+top_div).append( menu_template({
			help_icon:help_icon, right_floater:right_floater, left_floater:left_floater
		}) );
		self.make_help_icon(help_icon);
	},
	make_help_icon: function(help_icon_div) {
		//jQuery("#"+help_icon_div).button({ label:"?" });
		jQuery("#"+help_icon_div).append("<div style='width:50%;margin:0 auto;font-size:18px;'>?</div>");
		jQuery("#"+help_icon_div).css("width","20px");
		jQuery("#"+help_icon_div).css("height","20px");
		jQuery("#"+help_icon_div).css("background","lightgrey");
		jQuery("#"+help_icon_div).css("border-radius","10px");
		jQuery("#"+help_icon_div).css("-moz-border-radius","10px");
		jQuery("#"+help_icon_div).css("-webkit-border-radius","10px");
		jQuery("#"+help_icon_div).qtip({
			content:"Help about PDBe Sequence Viewer Widget will soon be added here.",
			position: { target: "mouse", adjust: {x:5, y:5} },
			style: { 'classes': 'qtip-bootstrap qtip-shadow qtip-rounded' },
		});
	},
	make_bottom_menu: function(bottom_div) {
		var self = this, conf = self.configs;
		var chain_button = bottom_div + "_chainsButton", right_floater = bottom_div + "_right", left_floater = bottom_div + "_left";
		var bot_menu_template = Handlebars.compile(" \
			<div style='float:right;' id='{{right_floater}}'> \
			</div> \
			<div style='float:left;'  id='{{left_floater}}' > \
				<div id='{{chain_button}}'></div> \
			</div> \
			<br style='width:0px;clear:left;'/> \
		");
		jQuery('#'+bottom_div).append( bot_menu_template({
			chain_button:chain_button, right_floater:right_floater, left_floater:left_floater
		}) );
		if(self.chains_order.length < 2) return;
		var more_label = "+ More chains", less_label = "- Fewer chains", loading_label = "Wait...";
		jQuery('#'+chain_button).button();
		var button_label = function(str) {
			if(str) jQuery("#"+chain_button).button("option", "label", str);
			else    return jQuery("#"+chain_button).button("option", "label");
		}
		button_label(more_label);
		jQuery('#'+chain_button).button().click( function() {
			var btext = button_label();
			if(!self.more_chains_added) {
				jQuery("#"+chain_button).button("option", "disabled", true);
				button_label(loading_label);
				self.more_chains_added = [], more_rows = [], more_row_ids = [];
				for(var ci=1; ci < self.chains_order.length; ci++) {
					var chid = self.chains_order[ci];
					jQuery.each(self.make_chain_rows(chid, 20), function(cri,ch_row) {
						more_rows.push(ch_row);
						more_row_ids.push(ch_row.id);
					});
				}
				window.setTimeout( function() {
					self.seq_painter.add_rows(more_rows);
					self.more_chains_added = self.more_chains_added.concat(more_row_ids);
					button_label(less_label);
					jQuery("#"+chain_button).button("option", "disabled", false);
				}, 1); // timeout is needed to make Wait label appear on button
				return;
			}
			if(btext==less_label) {
				button_label(more_label);
				jQuery.each(self.more_chains_added, function(mi,row_id) {
					self.seq_painter.hide_row(row_id);
				});
			}
			if(btext==more_label) {
				button_label(less_label);
				var show_row_ids = [];
				jQuery.each(self.more_chains_added, function(mi,row_id) {
					show_row_ids.push(row_id);
				});
				self.seq_painter.show_rows(show_row_ids);
			}
		} );
	},
	subscribe_to_topics: function() {
		var self = this;
		if(!self.configs.listen_topics) return;
		for(var etype in Biojs.PDBeventHelper.event_types)
			jQuery.Topic(etype).subscribe( function(edata) {
				self.event_response(edata.event_type, edata);
			} );
	},
	event_response: function(evtype, ev) {
		var self = this;
		if(ev.source && ev.source == self) return;
		if(evtype == Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_IN) {
			self.respond_on_residue_hover(ev, false);
		}
		else if(evtype == Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_OUT) {
			self.respond_on_residue_hover(ev, true);
		}
		else {
			console.error("Cannot handle event!", evtype, ev);
		}
	},
	respond_on_residue_hover: function(ev, fade) {
		var self = this;
		self.seq_painter.highlight_index(self.make_obs_chain_row_id(ev.pdb_chain_id), ev.seq_id-1, fade);
	},
	make_obs_chain_row_id: function(chid) {
		return "chain_"+chid+"_obs_row";
	},
	make_chain_rows: function(chid, arbit_row_height) {
		var self = this, conf = self.configs;
		var ret_rows = [];
		var chain = self.ent.getInstanceFromAuthAsym(chid);
		var obs_ranges = []
		jQuery.each(chain.getObservedRanges(), function(ari,arange) {
			obs_ranges.push( [arange.start.residue_number-1, arange.end.residue_number-1] );
		});
		ret_rows.push({
			height:arbit_row_height, left_label:"Chain "+chid, right_label:null, id:self.make_obs_chain_row_id(chid),
			painters: [
				{type:"domain", ranges:obs_ranges, topline:arbit_row_height*0.2, baseline:arbit_row_height*0.8, fill:self.colormaker.getChainColor(self.ent.getPdbid(), self.ent.getEid(), chid),
					event_handlers: {
						mouse_in: function(painter, index, ranges) {
							self.fire_event(
								Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_IN,
								Biojs.PDBeventHelper.event_makers.MODELLED_RESIDUE_MOUSE_IN(self.ent.getPdbid(), self.ent.getEid(), chain.getAuthAsymId(), index+1)
							);
						},
						mouse_out: function(painter, index, ranges) {
							self.fire_event(
								Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_OUT,
								Biojs.PDBeventHelper.event_makers.MODELLED_RESIDUE_MOUSE_OUT(self.ent.getPdbid(), self.ent.getEid(), chain.getAuthAsymId(), index+1)
							);
						},
						click: function(painter, index, ranges) {
							self.fire_event(
								Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_CLICK,
								Biojs.PDBeventHelper.event_makers.MODELLED_RESIDUE_CLICK(self.ent.getPdbid(), self.ent.getEid(), chain.getAuthAsymId(), index+1)
							);
						},
						shift_click: function(painter, index, ranges) {
							self.fire_event(
								Biojs.PDBeventHelper.event_types.MODELLED_CHAIN_DBL_CLICK,
								Biojs.PDBeventHelper.event_makers.MODELLED_CHAIN_DBL_CLICK(self.ent.getPdbid(), self.ent.getEid(), chain.getAuthAsymId())
							);
						}
					},
					tooltip: {
						tfunc: function(painter, index, ranges) { return self.get_res_info_str(chid, index+1); }
					}
				},
				//{type:"sequence", sequence: self.ent.getSequence(), baseline:arbit_row_height/2, color:'black'}
			]
		});
		// show validation track
		var val_painters = self.make_validation_summary_painters(chain, arbit_row_height);
		if(val_painters && val_painters.length > 0)
			ret_rows.push({
				height:arbit_row_height, left_label:"Quality", right_label:null, id:"validation_chain_"+chid,
				painters: val_painters
			});
		// show binding site
		var bs_painters = self.make_binding_site_painters(chain, arbit_row_height);
		if(bs_painters.length > 0) {
			for(var bsi=0; bsi < bs_painters.length; bsi++)
				ret_rows[0].painters.push(bs_painters[bsi]);
		}
		// show altconf / microhet residues
		var altconf_painters = self.make_altconf_painters(chain, arbit_row_height);
		if(altconf_painters.length > 0) {
			for(var bsi=0; bsi < altconf_painters.length; bsi++)
				ret_rows[0].painters.push(altconf_painters[bsi]);
		}
		if(chid == self.chains_order[0]) { // only for first chain displayed
			// add secondary structure when present
			var ss_painters = self.make_secstr_painters_for_chain(chain, arbit_row_height);
			if(ss_painters.length > 0) {
				//ret_rows[ret_rows.length-1].painters = ret_rows[ret_rows.length-1].painters.concat(ss_painters);
				ret_rows.push({
					height:arbit_row_height, left_label:"Sec. Str.", right_label:null, id:"chain_"+chid+"_secstr_row",
					painters:ss_painters
				});
			}
			// add scop/cath rows when present
			for(var sdtype in {"CATH":1, "SCOP":1}) {
				var scop_painters = self.make_strdom_painters_for_chain( sdtype, self.ent.getInstanceFromAuthAsym(chid), arbit_row_height );
				if(scop_painters.length > 0) {
					ret_rows.push({
						height:arbit_row_height, left_label:sdtype, right_label:null, id:"chain_"+chid+"_"+sdtype+"_row",
						painters:scop_painters
					});
				}
			}
		}
		return ret_rows;
	},
	make_validation_summary_painters: function(chain, arbit_row_height) {
		var self = this, conf = self.configs;
		var entry = self.pdb.makeEntry(conf.pdbid, conf.api_data);
		var vsum = entry.getValidationResidueSummary(), vdata = null, elen = null;
		if((!vsum) || vsum == null) {
			console.log("Validation info unavailable", vsum);
			return null;
		}
		jQuery.each(vsum.molecules, function(ei,einfo) { // do we have the validation summary for this chain?
			if(einfo.entity_id != chain.getEntityId()) return;
			elen = entry.getEntity(einfo.entity_id).getLength();
			jQuery.each(einfo.chains, function(chi,chinfo) {
			//for(var chinfo in vsum[einfo.entity_id].chains) {
				if(chinfo.chain_id != chain.getAuthAsymId()) return;
				for(var mi=0; mi < chinfo.models.length; mi++) {
					var amodel = chinfo.models[mi];
					if((vdata==null) || (amodel.model_id == 1))
						{ modelid = amodel.model_id; vdata = amodel.residues; }
				}
			} );
		} );
		if(!vdata) { // abort when validation summary absent
			console.warn("No validation summary for this chain!"); return;
		}
		var vdata1 = {}; // convert to a more convenient data structure
		for(var vi=0; vi < vdata.length; vi++)
			vdata1[ vdata[vi].residue_number ] = vdata[vi];
		vdata = vdata1;
		var vranges = {"green":[], "yellow":[], "orange":[], "red":[], "rsrz":[]};
		for(var ri=0; ri < elen; ri++) {
			if(!vdata[ri+1] || !vdata[ri+1]["outlier_types"])
				vranges["green"].push(ri);
			else if(vdata[ri+1].outlier_types.length == 1 && vdata[ri+1].outlier_types.indexOf("RSRZ") == 0)
				vranges["green"].push(ri);
		}
		for(var rindex in vdata) {
			var rinfo = vdata[rindex];
			var num_geom_outliers = rinfo.outlier_types.length;
			if(rinfo.outlier_types.indexOf('RSRZ') > -1) {
				vranges['rsrz'].push( rindex-1 );
				num_geom_outliers -= 1;
			}
			if     (num_geom_outliers == 1) vranges["yellow"].push( rindex-1 );
			else if(num_geom_outliers == 2) vranges["orange"].push( rindex-1 );
			else if(num_geom_outliers >= 3) vranges["red"].push( rindex-1 );
		}
		function rangeify(anarray) { // make ranges from array of integers
			if(anarray.length == 0) return [];
			anarray.sort( function(a,b) {return a-b;} );
			var newranges = [], cur_start=null, cur_end=null;
			for(var vi=0; vi < anarray.length; vi++) {
				var aval = anarray[vi];
				if(cur_start == null) { cur_start = aval ; cur_end = aval; }
				else if(cur_end + 1 == aval) { cur_end = aval; }
				else if(cur_end + 1 < aval) { newranges.push([cur_start, cur_end]); cur_start=aval; cur_end=aval; }
			}
			if(cur_start != null)// && cur_end == null)
				newranges.push( [ cur_start , anarray[anarray.length-1] ] );
			//console.log(anarray, newranges);
			return newranges;
		}
		var vpainters = [], vprops = {"yellow": {
			tl: arbit_row_height*0.5, bl:arbit_row_height*0.7, fill:"#DDDD00"
		}, "green":{
			tl: arbit_row_height*0.5, bl:arbit_row_height*0.7, fill:"green"
		}, "orange":{
			tl: arbit_row_height*0.5, bl:arbit_row_height*0.7, fill:"orange"
		}, "red":{
			tl: arbit_row_height*0.5, bl:arbit_row_height*0.7, fill:"red"
		}, "rsrz":{
			tl: arbit_row_height*0.25, bl:arbit_row_height*0.45, fill:"brown"
		}};
		for(var rkey in vranges) {
			vranges[rkey] = rangeify(vranges[rkey]);
			vpainters.push({
				type:"domain", ranges:vranges[rkey], topline:vprops[rkey].tl, baseline:vprops[rkey].bl, fill:vprops[rkey].fill,
				tooltip:{
					tfunc: function(painter, index, ranges) {
						index += 1; // index into vdata is residue_index
						if(!vdata[index]) return "No validation issues reported for this residue.";
						return "Validation issues in this residue: " + vdata[index].outlier_types;
					}
				},
				event_handlers: {
					click: function(painter, index, ranges) {
						self.fire_event(
							Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_CLICK,
							Biojs.PDBeventHelper.event_makers.MODELLED_RESIDUE_CLICK(self.ent.getPdbid(), self.ent.getEid(), chain.getAuthAsymId(), index+1)
						);
					},
				}
			});
		}
		return vpainters;
	},
	make_altconf_painters: function(chain, row_height) {
		var self = this, conf = self.configs;
		var ret = []; // one painter for altconf, another for microhet
		//console.log("SEEEE ", chain, chain.getResidueListing());
		var alt_indices = [], het_indices = [];
		var tooltips = {};
		jQuery.each(chain.getResidueListing(), function(rid,rinfo) {
			if(rinfo.multiple_conformers) {
				var unique_cc = {};
				jQuery.each(rinfo.multiple_conformers, function(mi,mc) {
					if(!unique_cc[mc.chem_comp_id])
						unique_cc[mc.chem_comp_id] = {};
					unique_cc[mc.chem_comp_id][mc.alt_code] = 1;
					
				});
				if(Object.keys(unique_cc).length > 1) {
					tooltips[rinfo.residue_number] = "Miroheterogeneity " + Object.keys(unique_cc);
					het_indices.push(rinfo.residue_number);
				}
				else {
					tooltips[rinfo.residue_number] = "Alt confs " + Object.keys(unique_cc);
					alt_indices.push(rinfo.residue_number);
				}
			}
		});
		console.log("Alt and het indices ", alt_indices, het_indices);
		if(het_indices.length > 0) {
			ret.push({
				type:"lollipop", shape:{type:"ellipse", center_y:row_height*0.5, y_rad: row_height*0.1, x_rad:null, staff_base_y: row_height*0.1},
				indices:het_indices, color:self.colormaker.getRandomColor(),
				tooltip: {
					tfunc: function(painter, index, ranges) {return "This residue has microheterogeneity.";}
				},
				glow_on_hover: {fill:"silver"}
			});
		}
		if(alt_indices.length > 0) {
			ret.push({
				type:"lollipop", shape:{type:"ellipse", center_y:row_height*0.5, y_rad: row_height*0.1, x_rad:null, staff_base_y: row_height*0.1},
				indices:alt_indices, color:self.colormaker.getRandomColor(),
				tooltip: {
					tfunc: function(painter, index, ranges) {return "This residue has alternate conformers.";}
				},
				glow_on_hover: {fill:"gold"}
			});
		}
		return ret;
	},
	make_ligand_description: function(binfo) {
		var site_str = [];
		if(binfo.ligand_residues && binfo.ligand_residues.length > 0) {
			jQuery.each(binfo.ligand_residues, function(lri,lr) {
				site_str.push(
					[lr.chem_comp_id, lr.chain_id, lr.author_residue_number+lr.author_insertion_code].join("-")
				);
			});
			site_str = site_str.join("::");
		}
		else
			site_str = "unknown";
		return site_str;
	},
	make_binding_site_painters: function(chain, row_height) {
		var self = this, conf = self.configs;
		var entry = self.pdb.makeEntry(conf.pdbid, conf.api_data);
		var indices = {}, site_descs = {};
		jQuery.each(entry.getBindingSitesInfo(), function(sid, binfo) {
			var site_id = binfo.site_id;
			site_descs[site_id] = self.make_ligand_description(binfo);
			jQuery.each(binfo.site_residues, function(si,resinfo) {
				if(resinfo.struct_asym_id != chain.getStructAsymId()) return;
				if(!indices[site_id]) indices[site_id] = [];
				indices[site_id].push(resinfo.residue_number);
			});
		});
		var ret = [];
		jQuery.each(indices, function(site_id, res_inds) {
			ret.push({
				type:"lollipop", shape:{type:"ellipse", center_y:row_height*0.1, y_rad: row_height*0.1, x_rad:null, staff_base_y: row_height*0.1},
				indices:res_inds, color:self.colormaker.getRandomColor(),
				tooltip: {
					tfunc: function(painter, index, ranges) {return "This residue is in binding site of ligand " + site_descs[site_id];}
				},
				glow_on_hover: {fill:"gold"}
			});
		});
		return ret;
	},
	get_res_info_str: function(chain_id, seq_id) {
		var self = this, conf = self.configs;
		var entry = self.pdb.makeEntry(conf.pdbid, conf.api_data);
		if(entry.hasResidueListing()) {
			var chain = self.ent.getInstanceFromAuthAsym(chain_id);
			var resinfo = chain.getResidueListing()[seq_id], icode=null;
			if(!resinfo) {
				console.error("index error", seq_id, chain.getResidueListing());
				return "";
			}
			if(!resinfo.author_insertion_code) icode = "";
			else icode = resinfo.author_insertion_code;
			var ttext = (resinfo.residue_name+"("+resinfo.author_residue_number+icode+")").replace(/ /g,'');
			return ttext;
		}
		else {
			if(!self.residue_listing_call_made) {
				entry.makeResidueListing(conf.api_data);
				self.residue_listing_call_made = true;
			}
			return "Residue information being fetched.";
		}
	},
	make_range_event_handlers: function(chain, range_type, range_id) {
		var self = this;
		return {
			mouse_in_range: function(painter, index, ranges) {
				self.fire_event(
					Biojs.PDBeventHelper.event_types.MODELLED_DOMAIN_MOUSE_IN,
					Biojs.PDBeventHelper.event_makers.MODELLED_DOMAIN_MOUSE_IN(self.ent.getPdbid(), self.ent.getEid(), chain.getAuthAsymId(), self.adjust_ranges(ranges,1), range_type)
				);
			},
			mouse_out_range: function(painter, index, ranges) {
				self.fire_event(
					Biojs.PDBeventHelper.event_types.MODELLED_DOMAIN_MOUSE_OUT,
					Biojs.PDBeventHelper.event_makers.MODELLED_DOMAIN_MOUSE_OUT(self.ent.getPdbid(), self.ent.getEid(), chain.getAuthAsymId(), self.adjust_ranges(ranges,1), range_type)
				);
			},
			click: function(painter, index, ranges) {
				self.fire_event(
					Biojs.PDBeventHelper.event_types.MODELLED_DOMAIN_CLICK,
					Biojs.PDBeventHelper.event_makers.MODELLED_DOMAIN_CLICK(self.ent.getPdbid(), self.ent.getEid(), chain.getAuthAsymId(), self.adjust_ranges(ranges,1), range_type, range_id)
				);
			}
		}
	},
	make_secstr_painters_for_chain: function(chain, row_height) {
		var self = this, conf = self.configs;
		if(!chain.hasSecstrInfo()) return [];
		var helices = chain.getHelices(), sheets = chain.getSheets(), ss_painters = [];
		var helix_ranges = [];
		if(helices) {
			jQuery.each(chain.getHelices(), function(hi,helix) {
				helix_ranges.push([helix.start.residue_number-1,helix.end.residue_number-1]);
			});
			ss_painters.push({
				type:"helices", ranges:helix_ranges, topline:row_height*0.3, baseline:row_height*0.7, fill:self.colormaker.getSecstrColor("helix"),
				tooltip: {
					tfunc: function(painter,index,ranges) { return "A helix in chain " + chain.getAuthAsymId(); }
				},
				glow_on_hover: {opacity:0.5},
				event_handlers: self.make_range_event_handlers(chain, "SecStr", "helix")
			});
		}
		if(sheets) {
			jQuery.each(sheets, function(shi,sheet) {
				var sheet_ranges = [];
				jQuery.each(sheet, function(stri,strand) {
					sheet_ranges.push( [strand.start.residue_number-1, strand.end.residue_number-1] );
				});
				ss_painters.push({
					type:"sheet", ranges:sheet_ranges, topline:1, baseline:row_height-1, fill:self.colormaker.getSecstrColor("sheet"),
					tooltip: {
						tfunc: function(painter,index,ranges) { return "A strand in a sheet in chain " + chain.getAuthAsymId(); }
					},
					glow_on_hover: {opacity:0.3},
					event_handlers: self.make_range_event_handlers(chain, "SecStr", "sheet")
				});
			});
		}
		return ss_painters;
	},
	adjust_ranges: function(ranges, delta) {
		var adj_ranges = [];
		jQuery.each(ranges, function(ri,rg) {
			adj_ranges.push( [rg[0]+delta, rg[1]+delta] );
		});
		return adj_ranges;
	},
	make_strdom_painters_for_chain: function(domtype, chain, row_height) {
		var self = this, conf = self.configs;
		if(domtype != "SCOP" && domtype != "CATH") {
			console.error("Can't make domains for type", domtype);
			return [];
		}
		var entry = self.pdb.makeEntry(conf.pdbid, conf.api_data);
		var instances = entry.getSiftsMappingsInstanceRanges(
			domtype,
			function(arange) {
				return arange.entity_id == chain.getEntityId() && arange.struct_asym_id == chain.getStructAsymId();
			}
		);
		var painters = [];
		if(instances.length == 0) return painters;
		jQuery.each(instances, function(ii,inst) {
			var domcolor = self.colormaker.getDomainColor(domtype, inst.id);
			painters.push( {
				type:"domain", ranges:self.adjust_ranges(inst.ranges, -1),
				topline:row_height*0.3, baseline:row_height*0.7, fill:domcolor,
				tooltip:{
					tfunc: function(painter,seqind,ranges) { return domtype+' ' + inst.id; }
				},
				glow_on_hover:{opacity:0.5},
				event_handlers: self.make_range_event_handlers(chain, domtype, inst.id)
			} );
		});
		return painters;
	},
	make_seqdom_painters_for_entity: function(domtype, ent, row_height) {
		var self = this, conf = self.configs;
		var props = {
			UniProt: { dom_colorcode:"UNIPROT", ttip:"UniProt" },
			Pfam   : { dom_colorcode:"PFAM",    ttip:"PFAM" }
		} [domtype];
		if(!props) {
			console.error("Can't show domains of type", domtype); return [];
		}
		var entry = self.pdb.makeEntry(conf.pdbid, conf.api_data);
		var instances = entry.getSiftsMappingsInstanceRanges(
			domtype,
			function(arange) { return arange.entity_id == ent.getEid(); }
		);
		if(instances.length == 0) return [];
		var painters = [];
		jQuery.each(instances, function(ii,inst) {
			var domcolor = self.colormaker.getDomainColor(props.dom_colorcode, inst.id);
			painters.push( {
				type:"domain", ranges:self.adjust_ranges(inst.ranges, -1),
				topline:row_height*0.3, baseline:row_height*0.7, fill:domcolor,
				tooltip:{
					tfunc: function(painter,seqind,ranges) { return props.ttip+' '+painter.data.unp_accession; },
				},
				data:{unp_accession:inst.id},
				glow_on_hover:{opacity:0.5},
				event_handlers: {
					mouse_in_range: function(painter, index, ranges) {
						self.fire_event(
							Biojs.PDBeventHelper.event_types.SEQUENCE_DOMAIN_MOUSE_IN,
							Biojs.PDBeventHelper.event_makers.SEQUENCE_DOMAIN_MOUSE_IN(self.ent.getPdbid(), self.ent.getEid(), self.adjust_ranges(ranges,1), domtype.toUpperCase())
						);
					},
					mouse_out_range: function(painter, index, ranges) {
						self.fire_event(
							Biojs.PDBeventHelper.event_types.SEQUENCE_DOMAIN_MOUSE_OUT,
							Biojs.PDBeventHelper.event_makers.SEQUENCE_DOMAIN_MOUSE_OUT(self.ent.getPdbid(), self.ent.getEid(), self.adjust_ranges(ranges,1), domtype.toUpperCase())
						);
					},
					click: function(painter, index, ranges) {
						self.fire_event(
							Biojs.PDBeventHelper.event_types.SEQUENCE_DOMAIN_CLICK,
							Biojs.PDBeventHelper.event_makers.SEQUENCE_DOMAIN_CLICK(self.ent.getPdbid(), self.ent.getEid(), self.adjust_ranges(ranges,1), domtype.toUpperCase(), painter.data.unp_accession)
						);
					}
				}
			} );
		});
		return painters;
	}, 
	fire_event: function(etype, edata) {
		var self = this, conf = self.configs;
		self.raiseEvent(etype, edata);
		if(conf.fire_topics) {
			edata.source = self;
			jQuery.Topic(etype).publish(edata);
		}
	},

  /**
   * Array containing the supported event names
   * @name Biojs.PDBsequenceLayout-eventTypes
   */
	eventTypes : [
		Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_IN,
		Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_OUT,
		Biojs.PDBeventHelper.event_types.MODELLED_DOMAIN_MOUSE_IN,
		Biojs.PDBeventHelper.event_types.MODELLED_DOMAIN_MOUSE_OUT,
		Biojs.PDBeventHelper.event_types.SEQUENCE_DOMAIN_MOUSE_IN,
		Biojs.PDBeventHelper.event_types.SEQUENCE_DOMAIN_MOUSE_OUT,
		Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_CLICK,
		Biojs.PDBeventHelper.event_types.MODELLED_CHAIN_DBL_CLICK
	]
});
