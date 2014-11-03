
Biojs.PDBxrayValidTables = Biojs.extend ( {
	constructor: function(options) {
		var self = this;
		for(k in options) self[k] = options[k];
		if(!self.divid) self.divid = self.refinementTableDivid;
		self.setupPDBdatabrokerAndLaunch();
	},
	setupPDBdatabrokerAndLaunch: function() {
		var self = this;
		self.pdb = new Biojs.getPDBdatabroker(self.apiURL);
		var  api_urls = [
			"/pdb/entry/summary/" + self.pdbid,
			"/pdb/entry/experiment/" + self.pdbid,
        	"/validation/xray_refine_data_stats/entry/" + self.pdbid
		];
		Biojs.PDB_API_AJAX_Helper(
			self.apiURL,
			api_urls,
			function() {
				var success_callback = 'render';
				console.log('Starting PDBxrayValidTables callback', success_callback);
				self[success_callback](Biojs.PDBajaxData);
			},
			function() {
				alert("There was an error in communicating with PDBe API - please report to pdbehelp@ebi.ac.uk");
				document.getElementById(self.divid).innerHTML = "Sorry, an error occurred.";
			}
		);
	},
	render: function(apidata) {
		var self = this;
		self.entry = self.pdb.makeEntry(self.pdbid, apidata);
		self.refine_data = self.entry.makeXrayRefinementStats(apidata);
		self.expt_data = self.entry.makeExperiments(apidata);
		self.draw();
	},
	draw1: function() {
		var self = this;
		console.log("drawing PDBxrayValidTables");
		var refinetableDivid = self.divid + "_reftable";
		var datatableDivid = self.divid + "_datatable";
		if(self.refinementTableDivid && self.reflectionsTableDivid) {
			jQuery("#"+self.refinementTableDivid).html("<table id='"+refinetableDivid+"'></table>");
			jQuery("#"+self.reflectionsTableDivid).html("<table id='"+datatableDivid+"'></table>");
		}
		else {
			var tabledivstyle = "overflow:auto;";
			jQuery("#"+self.divid).html("<div style='"+tabledivstyle+"'><table id='"+refinetableDivid+"'></table></div><div style='"+tabledivstyle+"'><table id='"+datatableDivid+"'></table></div>");
		}
		var refineDataitems = {
			"DCC_R":"R (DCC)",
			"DCC_Rfree":"Rfree (DCC)",
			"EDS_R":"R (EDS)",
			"DCC_refinement_program":"Refinement software",
			"Fo_Fc_correlation":"Fo-Fc correlation",
			"bulk_solvent_b":"Bulk solvent B",
			"bulk_solvent_k":"Bulk solvent K"
		};
		var reflDataitems = {
			"EDS_resolution_low":"EDS_resolution_low",
			"EDS_resolution":"EDS_resolution",
			"DataCompleteness":"DataCompleteness",
			"WilsonBestimate":"Wilson B factor",
			"TwinL":"L (twinning)",
			"TwinL2":"L2 (twinning)",
			"TransNCS":"TransNCS",
			"IoverSigma":"I/Sigma",
			"centric_outliers":"Centric outliers",
			"acentric_outliers":"Acentric outliers",
			"numMillerIndices":"Number of reflections",
			"percent-free-reflections":"Percent free reflections"
		};
		var refineRows = [], refldataRows = [];

		self.cellDimDiv = self.divid + "_celldims";
		refldataRows.push([ "hi", "hi", "<table id='"+self.cellDimDiv+"'></table>" ]);
		
	
		var colDefs = [ {"sTitle":"Metric"}, {"sTitle":"Value"}, {"sTitle":"Source"} ];
		jQuery("#"+refinetableDivid).dataTable({
			bFilter:false, bLengthChange:false, bInfo:false,
			aaData:refineRows, aoColumns:colDefs, paging:false
		});
	
		jQuery("#"+datatableDivid).dataTable({
			bFilter:false, bLengthChange:false, bInfo:false,
			aaData:refldataRows, aoColumns:colDefs, paging:false
		});
		self['makeTableHTML']();
	},
	makeTableHTML: function() {
		var self = this;
		console.log(jQuery("#"+self.cellDimDiv));
		jQuery("#"+self.cellDimDiv).dataTable({
			bFilter:false, bLengthChange:false, bInfo:false, paging:false,
			aaData:[["1","2"]], aoColumns:[{"sTitle":"hello"},{"sTitle":"hi"}]
		});
	},
	draw: function() {
		var self = this;
		self.unknown_str = "Not available";
		var colDefs = [ {"sTitle":"Metric"}, {"sTitle":"Value"}, {"sTitle":"Source"} ], subTableMakers = [];
///////
		var refine_table_divid = self.refinementTableDivid + "_datatable";
		jQuery("#"+self.refinementTableDivid).html("<table id='"+refine_table_divid+"'></table>");
		var refine_data_items = {
			"DCC_R":"R (DCC)",
			"DCC_Rfree":"Rfree (DCC)",
			"EDS_R":"R (EDS)",
			"DCC_refinement_program":"Refinement software",
			"Fo_Fc_correlation":"Fo-Fc correlation",
			"bulk_solvent_b":"Bulk solvent B",
			"bulk_solvent_k":"Bulk solvent K"
		};
		var rows = [];
		jQuery.each(refine_data_items, function(property, header) {
			rows.push([header, self.refine_data[property].value, self.refine_data[property].source]);
		});
		jQuery('#'+refine_table_divid).dataTable({
			bFilter:false, bLengthChange:false, bInfo:false, paging:false,
			aaData:rows, aoColumns:colDefs
		});
////////
		var reflections_table_divid = self.reflectionsTableDivid + "_reftable";
		jQuery("#"+self.reflectionsTableDivid).html("<table id='"+reflections_table_divid+"'></table>");
		var reflection_data_items = {
			"EDS_resolution_low":"EDS_resolution_low",
			"EDS_resolution":"EDS_resolution",
			"DataCompleteness":"DataCompleteness",
			"WilsonBestimate":"Wilson B factor",
			"TwinL":"L (twinning)",
			"TwinL2":"L2 (twinning)",
			"TransNCS":"TransNCS",
			"IoverSigma":"I/Sigma",
			"centric_outliers":"Centric outliers",
			"acentric_outliers":"Acentric outliers",
			"numMillerIndices":"Number of reflections",
			"percent-free-reflections":"Percent free reflections"
		};
		var rows = [];
		for(var rowmaker in {'getSpacegroupRow':1, 'getCellDimRow':1}) {
			var rowdata = self[rowmaker]();
			if(rowdata.row) {
				rows.push(rowdata.row);
				subTableMakers = subTableMakers.concat(rowdata.subTableMakers);
			}
			else { rows.push(rowdata); }
		}
		jQuery.each(reflection_data_items, function(property, header) {
			rows.push([header, self.refine_data[property].value, self.refine_data[property].source]);
		});
		jQuery('#'+reflections_table_divid).dataTable({
			bFilter:false, bLengthChange:false, bInfo:false, paging:false,
			aaData:rows, aoColumns:colDefs
		});
///////
		jQuery.each(subTableMakers, function(si,st) { self[st](); });
	},
	getExptdataAttr: function(attrname) {
		var self = this, sg = null;
		jQuery.each(self.expt_data, function(expi, edata) {
			if(edata['experimental_method_class'] && edata['experimental_method_class']=="x-ray") {
				sg = edata[attrname]; return false;
			}
		});
		return sg;
	},
	getSpacegroupRow: function() {
		var self = this;
		return [ "Spacegroup", self.getExptdataAttr("spacegroup") || self.unknown_str, "Depositor" ];
	},
	formatCell: function() {
		var self = this, rows = [
			["a="+self.cell.a, "b="+self.cell.b, "c="+self.cell.c],
			["alpha="+self.cell.alpha, "beta="+self.cell.beta, "gamma="+self.cell.gamma],
		];
		var coldefs = [];
		for(var ri=0; ri < rows[0].length; ri++) coldefs.push( {sTitle:"dontcare"} )
		if(!self.cell) return;
		jQuery('#'+self.cell_table_id).dataTable({
			bFilter:false, bLengthChange:false, bPaginate:false, bInfo:false,
			aaData:rows, aoColumns:coldefs, paging:false,
			"fnInitComplete": function(oSettings) { // hide table headings
			    jQuery("#"+self.cell_table_id+' thead').hide();
			}
		});
	},
	getCellDimRow: function() {
		var self = this;
		self.cell = self.getExptdataAttr("cell"), cellstr = null;
		self.cell_table_id = self.divid + "_cell_table";
		if(!self.cell) cellstr = self.unknown_str;
		else           cellstr = '<table id="'+self.cell_table_id+'"></table>';
		return {row:["Cell dimensions", cellstr, "Depositor"], subTableMakers:['formatCell']};
		
		jQuery.each(self.expt_data, function(expi, edata) { // add cell and spacegroup
			if(edata['method_class'] && edata['method_class']=="x-ray") {
				var cell = edata['cell'];
				cell = "["+cell.a+","+cell.b+","+cell.c+"] ["+cell.alpha+","+cell.beta+","+cell.gamma+"]"
				refldataRows.push(["Cell dimensions", cell, "Depositor"]);
				// add to reflections table
				refineRows.push(["R factor", edata['r_factor'], "Depositor"]);
				refineRows.push(["Rfree", edata['r_free'], "Depositor"]);
				refineRows.push(["Rwork", edata['r_work'], "Depositor"]);
				// don't iterate further
				return false;
			}
		});
	}
} );
