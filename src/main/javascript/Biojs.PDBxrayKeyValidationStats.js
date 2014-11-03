
Biojs.PDBxrayKeyValidationStats = Biojs.extend ( {
	constructor: function(options) {
		var self = this;
		self.configs = {};
		for(k in options) self.configs[k] = options[k];
		//self.configs.apiURL = "http://puck.ebi.ac.uk:10000"; // TODO remove later
		self.configs.apidata = null; // TODO remove later
		self.setupPDBdatabrokerAndLaunch();
	},
	setupPDBdatabrokerAndLaunch: function() {
		var self = this, conf = self.configs;
		//console.error("Review this: PDBxrayKeyValidationStats uses", conf.apiURL);
		self.pdb = new Biojs.getPDBdatabroker(conf.apiURL);
		if(conf.apidata) { self.render_stats(conf.apidata) ; return; }
		var api_urls = [
			"/pdb/entry/summary/" + conf.pdbid,
        	"/validation/key_validation_stats/entry/" + conf.pdbid
		];
		Biojs.PDB_API_AJAX_Helper(
			conf.apiURL,
			api_urls,
			function() {
				var success_callback = 'render_stats';
				console.log('Starting PDBxrayKeyValidationStats callback', success_callback);
				self[success_callback](Biojs.PDBajaxData);
			},
			function() {
				alert("There was an error in communicating with PDBe API - please report to pdbehelp@ebi.ac.uk");
				document.getElementById(conf.target).innerHTML = "Sorry, an error occurred.";
			}
		);
	},
	render_stats: function(apidata) {
		var self = this, conf = self.configs;
		var keystats = apidata ["/validation/key_validation_stats/entry/"+conf.pdbid][conf.pdbid];
		if(!keystats) {
			jQuery("#"+conf.target).html("This information is not available."); return;
		}
		var table_divid = conf.target+"_tablediv", unknown_str = "Not available";
		var col_defs = [ {"sTitle":"Metric"}, {"sTitle":"Description"} ], rows = [];
		var column_names = {
			"protein_ramachandran" : "Ramachandran outliers in protein chains",
			"protein_sidechains" : "Sidechain rotamer outliers in protein chains",
			"angles" : "Angles in protein, DNA, RNA chains",
			"bonds" : "Bonds in protein, DNA, RNA chains",
			"RSRZ" : "Electron density outliers in protein, DNA, RNA chains",
			"rna_pucker" : "RNA sugar pucker outliers in RNA chains",
			"rna_suite" : "RNA suite outliers in RNA chains"
		};
		for(var metric in keystats) {
			var mstr = keystats[metric]["num_outliers"] + " outliers of " + keystats[metric]["num_checked"] + " ("+ keystats[metric]["percent_outliers"] +"%)"
			if(keystats[metric]["num_outliers"]==0 && keystats[metric]["num_checked"]==0 && keystats[metric]["percent_outliers"] == null) continue;
			rows.push([column_names[metric], mstr]);
		}
		jQuery("#"+conf.target).html("<table id='"+table_divid+"'></table>");
		jQuery("#"+table_divid).dataTable({
			bFilter:false, bLengthChange:false, bInfo:false,
			aaData:rows, aoColumns:col_defs, paging:false
		});
	},
} );
