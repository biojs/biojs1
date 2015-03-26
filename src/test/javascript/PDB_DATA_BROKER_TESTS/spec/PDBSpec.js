describe("PDB data broker", function() {
	it("is always defined if you include necessary javascript", function() {
		expect(Biojs.PDB).toBeDefined();
	});
	it("is instantiated with a default API URL, but can take API URL as parameter too", function() {
		var pdb_dev = new Biojs.PDB({api_url:"http://wwwdev.ebi.ac.uk/pdbe/api"});
		var pdb = new Biojs.PDB();
		expect(pdb).not.toBeNull();
		expect(pdb_dev).not.toBeNull();
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
		var pdbid = "1cbs", entry_title = "CRYSTAL STRUCTURE OF CELLULAR RETINOIC-ACID-BINDING PROTEINS I AND II IN COMPLEX WITH ALL-TRANS-RETINOIC ACID AND A SYNTHETIC RETINOID";
		var pdb = Biojs.get_PDB_instance();
		pdb.make_pdb_entry(pdbid)
		.done(function(entry) {
            expect(entry.get_title()).toEqual(entry_title);
			expect(entry).toBe(pdb.get_pdb_entry(pdbid));
			async_tag();
		})
		.fail(function() {
            expect(true).toBe(false);
			async_tag();
		});
	});
	it("can create expected Entity-s inside the PDB_Entry object", function() {
		var pdb = Biojs.get_PDB_instance();
		var x = pdb.make_pdb_entry("1aac");
		var y = pdb.make_pdb_entry("1aac");
		expect(x).toBe(y);
		x.done(function() { console.log("HIII"); });
		y.done(function() { console.log("HELLO"); });
	});
});
