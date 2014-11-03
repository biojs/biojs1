
Biojs.PDBxrayExptInfo = Biojs.extend ( {
	constructor: function(options) {
		var self = this;
		for(k in options) self[k] = options[k];
		self.setupPDBdatabrokerAndLaunch();
	},
	setupPDBdatabrokerAndLaunch: function() {
		var self = this;
		self.pdb = new Biojs.getPDBdatabroker(self.apiURL);
		jQuery('#'+self.beam_divid).html("Please wait - X-ray experiment descriptions are loading....");
		jQuery('#'+self.xtal_divid).html("Please wait - X-ray experiment descriptions are loading....");
		var api_urls = [
			"/pdb/entry/summary/" + self.pdbid,
			"/pdb/entry/experiment/" + self.pdbid,
		];
		Biojs.PDB_API_AJAX_Helper(
			self.apiURL,
			api_urls,
			function() {
				var success_callback = 'render';
				console.log('Starting PDBxrayExptInfo callback', success_callback);
				self[success_callback](Biojs.PDBajaxData);
			},
			function() {
				alert("There was an error in communicating with PDBe API - please report to pdbehelp@ebi.ac.uk");
				document.getElementById(conf.target).innerHTML = "Sorry, an error occurred.";
			}
		);
	},
	render: function(apidata) {
		var self = this;
		self.entry = self.pdb.makeEntry(self.pdbid, apidata);
		self.refdata = self.entry.makeXrayRefinementStats(apidata);
		self.exptdata = self.entry.makeExperiments(apidata);
		self.draw();
	},
	draw: function() {
		var self = this;
		if(!self.exptdata) {
			jQuery('#'+self.xtal_divid).html("Description of X-ray experiments for this entry are not available.");
			jQuery('#'+self.beam_divid).html("Description of X-ray experiments for this entry are not available.");
			return;
		}
		var xrayEDs = []; // which expt descriptions are for xray?
		jQuery.each(self.exptdata, function(edi, ed) {
			if(ed.experimental_method_class == "x-ray" && ed.experimental_method == "x-ray diffraction") {
				xrayEDs.push(ed);
			}
		});
		if(xrayEDs.length == 0) {
			jQuery('#'+self.xtal_divid).html("There is no description of X-ray experiments available for this entry.");
			jQuery('#'+self.beam_divid).html("There is no description of X-ray experiments available for this entry.");
			return;
		}
		var xtal_innerhtml = "", beam_innerhtml = "";
		var xrayED = xrayEDs[0];
		if(xrayEDs.length > 1) {
			xtal_innerhtml = "Showing conditions listed in first X-ray experiment only - there are in total "+xrayEDs.length+" available.<br>";
			beam_innerhtml = "Showing conditions listed in first X-ray experiment only - there are in total "+xrayEDs.length+" available.<br>";
		}
		var diffraction_keys = {
			"source_name": "Source name",
			"wavelength_list": "Wavelengths",
			"synchrotron_beamline": "Synchrotron beamline",
			"detector_details": "Detector details",
			"detector_type": "Detector type",
			"source_type": "Source type",
			"source_details": "Source details",
			"synchrotron_site": "Synchrotron site",
			"diffraction_protocol": "Protocol",
			"ambient_temp": "Temperature",
			"wavelength": "Walenegth",
			"detector": "Detector"
		};
        	var growth_keys = {
			"grow_details" : "Growth details",
			"grow_ph" : "pH",
			"grow_method" : "Growth method",
			"grow_temperature" : "Temperature"
		};
		var noInfoXtals = 0;
		var xrows = [];
		for(var ci=0; ci < xrayED.crystal_growth.length; ci++) {
			//xtal_innerhtml += "Crystal " + (ci+1) + "------------------------------------------<br>";
			var ginfo = xrayED.crystal_growth[ci];
			var numNonnullKeys = 0;
			xrows.push([ci+1]);
			for(var k in growth_keys) {
				xrows[xrows.length-1].push(ginfo[k])
				if(! ginfo[k] ) continue;
				numNonnullKeys += 1;
				//xtal_innerhtml += growth_keys[k] + " >>> " + ginfo[k] + "<br>";
			}
			if(numNonnullKeys == 0) noInfoXtals += 1;
		}
		if(noInfoXtals == xrayED.crystal_growth.length && noInfoXtals > 0) {
			xtal_innerhtml += "There is no detail available on crystal growth for ";
			if(noInfoXtals == 1) xtal_innerhtml += "the only crystal ";
			else                 xtal_innerhtml += "the "+noInfoXtals+" crystals ";
			xtal_innerhtml += "reported in this entry.<br>"
			jQuery('#'+self.xtal_divid).html(xtal_innerhtml);
		}
		else {
			var tablediv = self.xtal_divid+"_xtable";
			jQuery('#'+self.xtal_divid).html(xtal_innerhtml + "<table id='"+tablediv+"'></table>");
			var headings = [{"sTitle":"Index"}];
			for(var k in growth_keys) headings.push( {sTitle:growth_keys[k]} );
			jQuery("#"+tablediv).dataTable({
				bFilter:false, bLengthChange:false, bInfo:false, paging:false,
				aaData:xrows, aoColumns:headings
			});
		}
		var noBeamInfo = 0;
		var drows = [];
		for(var ci=0; ci < xrayED.diffraction_expt.length; ci++) {
			//beam_innerhtml += "Diffraction " + (ci+1) + "------------------------------------------<br>";
			var dinfo = xrayED.diffraction_expt[ci];
			var numNonnullKeys = 0;
			drows.push([ci+1]);
			for(var k in diffraction_keys) {
				drows[drows.length-1].push(dinfo[k]);
				if(! dinfo[k] ) continue;
				numNonnullKeys += 1;
				//beam_innerhtml += diffraction_keys[k] + " >>> " + dinfo[k] + "<br>";
			}
			if(numNonnullKeys == 0) noBeamInfo += 1;
		}
		if(noBeamInfo == xrayED.diffraction_expt.length && noBeamInfo > 0) {
			beam_innerhtml += "There is no detail available on ";
			if(noBeamInfo == 1) beam_innerhtml += "the single diffraction condition ";
			else                beam_innerhtml += "the "+noBeamInfo+" diffraction conditions ";
			beam_innerhtml += "reported in this entry.<br>"
			jQuery('#'+self.beam_divid).html(beam_innerhtml);
		}
		else {
			var tablediv = self.xtal_divid+"_dtable";
			jQuery('#'+self.beam_divid).html(beam_innerhtml + "<table id='"+tablediv+"'></table>");
			var headings = [{"sTitle":"Index"}];
			for(var k in diffraction_keys) headings.push( {sTitle:diffraction_keys[k]} );
			jQuery("#"+tablediv).dataTable({
				bFilter:false, bLengthChange:false, paging:false, bInfo:false,
				aaData:drows, aoColumns:headings
			});

		}
	}
} );
