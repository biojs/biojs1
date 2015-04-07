describe("PDB data broker", function() {
	it("is always defined if you include necessary javascript", function() {
		expect(Biojs.PDB).toBeDefined();
	});
	it("is instantiated with a default API URL, but can take API URL as parameter too", function() {
		var pdb_dev = new Biojs.PDB({api_url:"http://wwwdev.ebi.ac.uk/pdbe/api"});
		var pdb = new Biojs.PDB();
		expect(pdb).not.toBeNull();
		expect(pdb_dev).not.toBeNull();
		expect(pdb_dev).not.toBe(pdb);
	});
	it("has a unique instance per API URL", function() {
		var pdb             = Biojs.get_PDB_instance();
		var another_pdb     = Biojs.get_PDB_instance();
		var yet_another_pdb = Biojs.get_PDB_instance();
		expect(pdb).toEqual(another_pdb);
		expect(pdb).toEqual(yet_another_pdb);
	});
	it("throws exception if multiply instantiated off the same URL", function() {
		var pdb = Biojs.get_PDB_instance();
		var pdb1 = Biojs.get_PDB_instance();
		var instantiate_again = function() { var pdb2 = Biojs.PDB(); }
		expect(instantiate_again).toThrow();
	});
	it("can create unique PDB_Entry object with expected title", function(async_tag) {
		var pdb = Biojs.get_PDB_instance();
		// same promise for multiple make-entry calls
		var x = pdb.make_pdb_entry("1aac");
		var y = pdb.make_pdb_entry("1aac");
		expect(x).toBe(y);
		// unique entry object with correct title
		var pdbid = "1cbs", entry_title = "CRYSTAL STRUCTURE OF CELLULAR RETINOIC-ACID-BINDING PROTEINS I AND II IN COMPLEX WITH ALL-TRANS-RETINOIC ACID AND A SYNTHETIC RETINOID";
		pdb.make_pdb_entry(pdbid)
		.done(function(entry) {
            expect(entry.get_title()).toEqual(entry_title);
			var same_entry = pdb.get_pdb_entry(pdbid);
			expect(entry).toBe(same_entry);
			async_tag();
		})
		.fail(function() {
            expect(true).toBe(false);
			async_tag();
		});
	});
	it("can create expected PDB_Entity-s inside the PDB_Entry object", function(async_tag) {
		var pdbid = "1cbs";
		var pdb = Biojs.get_PDB_instance();
		pdb.make_pdb_entry(pdbid)
		.done(function(entry) {
			entry.make_entities()
			.done(function(entities) {
				var same_ents = entry.get_entities();
				expect(entities).toBe(same_ents);
				var num_ents = 0;
				for(var eid in entities)
					num_ents += 1;
				expect(num_ents).toBe(3);
				async_tag();
			});
		});
	});
});
