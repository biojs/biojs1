Biojs.PDB_entity_viewer = Biojs.extend ({
	opt: {}
 	,
	constructor: function(options) {
		var self = this;
		jQuery(options.target).html("PDB timelines loading...");
		self.options = options;
		self.pdbids = [];
		var entries_promise = null;
		if(options.entries.search_url) {
			entries_promise = jQuery.ajax({
				url:options.entries.search_url, crossDomain: 'true', type: 'GET',
				success: function(data) {
					jQuery.each(data.response.docs, function(di,adoc) {
						self.pdbids.push(adoc.pdb_id);
					});
					self.pdbids = jQuery.unique(self.pdbids);
				}
			});
		}
		else
			throw "how do i get PDB entries for timelines?!";
		entries_promise.done(function() {
			self.prepare_entry_objects();
		});
	}
	,
	render: function() {
		var self = this;
		var dims = {
			widths:  {left:0, middle:800, right:0},
			heights: {top:50, bottom:50, middle:{min:100,max:400}},
		};
		var lm = new Biojs.PDB_Sequence_Layout_Maker({
			target:  self.options.target,
			dimensions: dims,
			markups: {
				top: "Timeline of PDB entries and associated publications",
				bottom: "Send comments to swanand@ebi.ac.uk"
			},
			seq_font_size:16, // this should be uniform across rows & painters
			units_per_index:16, // fiddle this
			num_slots:self.years.length
		});
		var row_height = 200;
		lm.add_row(new Biojs.PDB_Sequence_Layout_Row({
			height:50,
			markups: {
				left:"Z",
				middle: [ // single painter for zoom row
					new Biojs.PDB_Sequence_Layout_Painter({
						height:row_height, width:dims.widths.middle,
						type:"zoom",
						zoom_minval:self.years[0]-1+1, zoom_maxval:self.years[self.years.length-1]+1,
						zoom_no_seq_increments: true
					})
				]
			}
		}));
		lm.add_row(new Biojs.PDB_Sequence_Layout_Row({
			height:row_height,
			markups: {
				middle: [
					new Biojs.PDB_Sequence_Layout_Painter({
						height:row_height, width:dims.widths.middle,
						baseline:30, y_height:50, // y_height here is max heigt a histogram bar can be
						type:"histogram",
						histo_x_pos:{start:10, stop:90}, // start and stop positions of histo bar on X axis in terms of percentages
						heights: self.histo_entries,
						shape_attributes: {fill:"blue", stroke:null},
						hover_attributes: {fill:"lightgreen"},
						tooltip:{ func: function(painter, index) {
							var yr = self.years[index];
							return yr + " : " + self.year_to_pids[yr].length + " entries : " + self.year_to_pids[yr];
						}}
					}),
					new Biojs.PDB_Sequence_Layout_Painter({
						height:row_height, width:dims.widths.middle,
						baseline:130, y_height:50, // y_height here is max heigt a histogram bar can be
						histo_x_pos:{start:25, stop:45}, // start and stop positions of histo bar on X axis in terms of percentages
						type:"histogram",
						heights: self.histo_pubs,
						shape_attributes: {fill:"green", stroke:null},
						hover_attributes: {fill:"lightgreen"},
						tooltip:{ func: function(painter, index) {
							var yr = self.years[index];
							return yr + ": " + self.year_to_pubs[yr].length + " citations";
						}}
					}),
					new Biojs.PDB_Sequence_Layout_Painter({
						height:row_height, width:dims.widths.middle,
						baseline:130, y_height:50, // y_height here is max heigt a histogram bar can be
						histo_x_pos:{start:55, stop:75}, // start and stop positions of histo bar on X axis in terms of percentages
						type:"histogram",
						heights: self.histo_pubs,
						shape_attributes: {fill:"red", stroke:null},
						hover_attributes: {fill:"lightgreen"},
						tooltip:{ func: function(painter, index) {
							var yr = self.years[index];
							return yr + ": " + self.year_to_pubs[yr].length + " citations";
						}}
					}),
				]
			}
		}));
	}
	,
	uniqueify_publications: function(key_to_pubs) {
		jQuery.each(key_to_pubs, function(year, pubs) {
			var newpubs = {};
			jQuery.each(pubs, function(bi, apub) {
				//console.log("SEE", year, apub);
				newpubs[ Biojs.publication_key(apub) ] = apub;
			});
			var upubs = [];
			for(var pk in newpubs)
				upubs.push(newpubs[pk]);
			key_to_pubs[year] = upubs;
		});
	}
	,
	prepare_histo_data: function() {
		var self = this;
		var pdb = Biojs.get_PDB_instance();
		self.year_to_pids = {}; // prepare year vs pdbids
		jQuery.each(self.pdbids, function(pi,pid) {
			var year = pdb.get_pdb_entry(pid).get_release_year();
			if(!self.year_to_pids[year])
				self.year_to_pids[year] = [];
			self.year_to_pids[year].push(pid);
		});
		self.year_to_pubs = {}; // prepare publications
		jQuery.each(self.pdbids, function(pi,pid) {
			jQuery.each(pdb.get_pdb_entry(pid).get_publications("associated"), function(bi,pub) {
				var yr = pub.journal_info.year;
				if(!yr) // can happen e.g. to be published
					return;
				if(!self.year_to_pubs[yr])
					self.year_to_pubs[yr] = [];
				self.year_to_pubs[yr].push(pub);
			});
			jQuery.each(["cited_by","appears_without_citation"], function(ci,ct) {
				jQuery.each(pdb.get_pdb_entry(pid).get_publications(ct), function(at,articles) {
					jQuery.each(articles, function(bi,pub) {
						var yr = pub.year;
						if(!yr) // can happen e.g. to be published
							return;
						if(!self.year_to_pubs[yr])
							self.year_to_pubs[yr] = [];
						self.year_to_pubs[yr].push(pub);
					});
				});
			});
		});
		// uniquiefy publications in each year
		self.uniqueify_publications(self.year_to_pubs);
		// find min, max years
		self.years = [];
		var start_year = 10000, end_year = 1000;
		jQuery.each([self.year_to_pubs,self.year_to_pids], function(di,yrd) {
			for(var year in yrd) {
				if(start_year > year)
					start_year = year;
				if(end_year < year)
					end_year = year;
			}
		});
		// set empty lists where there is no data for an year
		jQuery.each([self.year_to_pubs,self.year_to_pids], function(di,yrd) {
			for(var yr = start_year; yr <= end_year; yr++)
				if(!yrd[yr])
					yrd[yr] = [];
		});
		self.histo_entries = {}; self.histo_pubs = {};
		for(var yr = start_year; yr <= end_year; yr++) {
			self.histo_entries[yr-start_year] = self.year_to_pids[yr].length;
			self.histo_pubs[yr-start_year] = -1 * self.year_to_pubs[yr].length;
			self.years.push(yr);
		}
	}
	,
	prepare_entry_objects: function() {
		var self = this;
		var pdb = Biojs.get_PDB_instance(), promises = [];
		jQuery.each(self.pdbids, function(pi,pid) {
			promises.push(pdb.make_pdb_entry(pid));
		});
		Biojs.when_no_deferred_pending(promises)
		.done(function() {
			var valid_pdbids = [];
			jQuery.each(self.pdbids, function(pi,pid) {
				try {
					var entry = pdb.get_pdb_entry(pid);
					valid_pdbids.push(pid);
				}
				catch(e) {
					console.warn("Could not create entry", pid, "...ignoring");
				}
			});
			self.pdbids = valid_pdbids;
			self.prepare_publications_data();
		});
	}
	,
	prepare_publications_data: function() {
		var self = this;
		var pdb = Biojs.get_PDB_instance(), promises = [];
		jQuery.each(self.pdbids, function(pi,pid) {
			promises.push(pdb.get_pdb_entry(pid).make_publications());
		});
		Biojs.when_no_deferred_pending(promises)
		.done(function() {
			self.prepare_histo_data();
			self.render();
		});
	}
});


Biojs.PDB_entity_viewer.jasmine_tests = function() {
	describe("PDBe entity viewer", function() {
		it("displays a PDB entity, associated chains and annotations.", function() {
			var divid = get_test_divid();
			jQuery('body').append("<br><br><br><div id="+divid+"></div>");
			var ptv = new Biojs.PDB_entity_viewer({
				target: divid,
				entries: {
					search_url: 'http://www.ebi.ac.uk/pdbe/search/pdb/select?q=entry_authors:*Blundell*&wt=json&fl=pdb_id'
					//search_url: 'http://www.ebi.ac.uk/pdbe/search/pdb/select?q=entry_authors:*Kleywegt*&wt=json&fl=pdb_id'
					//search_url: 'http://www.ebi.ac.uk/pdbe/search/pdb/select?q=entry_authors:*Velankar*&wt=json&fl=pdb_id'
				}
			});
			expect(true).toBe(true);
		});
	});
};

