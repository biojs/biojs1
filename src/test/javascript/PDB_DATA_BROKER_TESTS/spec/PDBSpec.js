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
		var pdbid = "2qcu", expected_num_ents = 9;
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
				expect(num_ents).toEqual(expected_num_ents);
				async_tag();
			});
		});
	});
	it("can create entity objects that provide info about uniprot & pfam mappings", function(async_tag) {
		var pdbid = "2qcu";
		var pdb = Biojs.get_PDB_instance();
		pdb.make_pdb_entry(pdbid)
		.done(function(entry) {
			entry.make_entities()
			.done(function(entities) {
				jQuery.each(entities, function(eid,ent) {
					if(!ent.is_protein())
						return;
					ent.make_sequence_mappings()
					.done(function() {
						for(var dt in {"Pfam":1, "UniProt":1}) {
							var domains = ent.get_sequence_mappings(dt);
							expect(1).toEqual(domains.length);
							expect(1).toEqual(domains[0].ranges.length);
						}
						async_tag();
					});
				});
			});
		});
	});
	it("can create expected number of instances of entities", function(async_tag) {
		var pdbid = "2qcu", expected_num_inst = {1:2, 2:6, 3:4, 4:2, 5:2, 6:3, 7:30, 8:2, 9:2};
		var pdb = Biojs.get_PDB_instance();
		pdb.make_pdb_entry(pdbid)
		.done(function(entry) {
			entry.make_entities()
			.done(function(entities) {
				var promises = [];
				jQuery.each(entities, function(eid,ent) {
					promises.push(ent.make_instances());
				});
				Biojs.when_no_deferred_pending(promises)
				.done(function() {
					var num_inst = {};
					jQuery.each(entities, function(eid,ent) {
						var same_instances = ent.get_instances();
						var instances = ent.get_instances();
						expect(instances).toBe(same_instances);
						num_inst[ent.entity_id] = instances.length;
					});
					expect(num_inst).toEqual(expected_num_inst);
					async_tag();
				});
			});
		});
	});
	it("can create chain objects that provide info about cath, scop", function(async_tag) {
		var pdbid = "1cbs";
		var pdb = Biojs.get_PDB_instance();
		pdb.make_pdb_entry(pdbid)
		.done(function(entry) {
			entry.make_entities()
			.done(function(entities) {
				jQuery.each(entities, function(eid,ent) {
					ent.make_instances()
					.done(function(instances) {
						var same_instances = ent.get_instances();
						if(!ent.is_protein())
							return;
						jQuery.each(instances, function(ii,inst) {
							inst.make_sequence_mappings()
							.done(function() {
								expect(instances).toBe(same_instances);
								for(var dt in {"SCOP":1, "CATH":1}) {
									var domains = inst.get_sequence_mappings(dt);
									expect(1).toEqual(domains.length);
									expect(1).toEqual(domains[0].ranges.length);
								}
								async_tag();
							});
						});
					});
				});
			});
		});
	});
	it("can create chain objects that provide info about residue-modelling, residue-validation, binding site, sec-str", function(async_tag) {
		var pdbid = "1cbs";
jQuery('body').append("<br><br><br><div>HIIIIIIIIIIII</div>");
		var pdb = Biojs.get_PDB_instance();
		pdb.make_pdb_entry(pdbid)
		.done(function(entry) {
			entry.make_entities()
			.done(function(entities) {
				jQuery.each(entities, function(eid,ent) {
					ent.make_instances()
					.done(function(instances) {
						if(!ent.is_protein_DNA_RNA())
							return;
						jQuery.each(instances, function(ii,inst) {
							Biojs.when_no_deferred_pending([
								inst.make_structural_features(),
								//inst.make_validation_info()
							])
							.done(function() {
								inst.get_binding_sites();
								async_tag();
							});
						});
					});
				});
			});
		});
	});
});
