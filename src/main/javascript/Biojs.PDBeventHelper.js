
Biojs.PDBeventHelper = Biojs.extend ( {

	constructor: function(options) {
	},

}, {

	event_types: {
		MODELLED_CHAIN_DBL_CLICK: "MODELLED_CHAIN_DBL_CLICK",
		MODELLED_RESIDUE_CLICK: "MODELLED_RESIDUE_CLICK",
		MODELLED_DOMAIN_CLICK: "MODELLED_DOMAIN_CLICK",
		SEQUENCE_DOMAIN_CLICK: "SEQUENCE_DOMAIN_CLICK",
		MODELLED_RESIDUE_MOUSE_IN: "MODELLED_RESIDUE_MOUSE_IN",
		MODELLED_RESIDUE_MOUSE_OUT: "MODELLED_RESIDUE_MOUSE_OUT",
		MODELLED_DOMAIN_MOUSE_IN: "MODELLED_DOMAIN_MOUSE_IN",
		MODELLED_DOMAIN_MOUSE_OUT: "MODELLED_DOMAIN_MOUSE_OUT",
		SEQUENCE_DOMAIN_MOUSE_IN: "SEQUENCE_DOMAIN_MOUSE_IN",
		SEQUENCE_DOMAIN_MOUSE_OUT: "SEQUENCE_DOMAIN_MOUSE_OUT"
	},
	event_makers: {
		MODELLED_CHAIN_DBL_CLICK: function(pdb_id, entity_id, auth_asym_id) {
			return { pdb_id:pdb_id, entity_id:entity_id, pdb_chain_id:auth_asym_id,
				event_type: Biojs.PDBeventHelper.event_types.MODELLED_CHAIN_DBL_CLICK };
		},
		MODELLED_RESIDUE_CLICK: function(pdb_id, entity_id, auth_asym_id, seq_id) {
			return { pdb_id:pdb_id, entity_id:entity_id, pdb_chain_id:auth_asym_id, seq_id:seq_id,
				event_type: Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_CLICK };
		},
		MODELLED_RESIDUE_MOUSE_IN: function(pdb_id, entity_id, auth_asym_id, seq_id) {
			return { pdb_id:pdb_id, entity_id:entity_id, pdb_chain_id:auth_asym_id, seq_id:seq_id,
				event_type: Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_IN };
		},
		MODELLED_RESIDUE_MOUSE_OUT: function(pdb_id, entity_id, auth_asym_id, seq_id) {
			return { pdb_id:pdb_id, entity_id:entity_id, pdb_chain_id:auth_asym_id, seq_id:seq_id,
				event_type: Biojs.PDBeventHelper.event_types.MODELLED_RESIDUE_MOUSE_OUT };
		},
		MODELLED_DOMAIN_CLICK: function(pdb_id, entity_id, auth_asym_id, seq_id_ranges, dom_type, dom_id) {
			return { pdb_id:pdb_id, entity_id:entity_id, pdb_chain_id:auth_asym_id, seq_id_ranges:seq_id_ranges, domain_type:dom_type, domain_id:dom_id,
				event_type: Biojs.PDBeventHelper.event_types.MODELLED_DOMAIN_CLICK };
		},
		MODELLED_DOMAIN_MOUSE_IN: function(pdb_id, entity_id, auth_asym_id, seq_id_ranges, dom_type) {
			return { pdb_id:pdb_id, entity_id:entity_id, pdb_chain_id:auth_asym_id, seq_id_ranges:seq_id_ranges, domain_type:dom_type,
				event_type: Biojs.PDBeventHelper.event_types.MODELLED_DOMAIN_MOUSE_IN };
		},
		MODELLED_DOMAIN_MOUSE_OUT: function(pdb_id, entity_id, auth_asym_id, seq_id_ranges, dom_type) {
			return { pdb_id:pdb_id, entity_id:entity_id, pdb_chain_id:auth_asym_id, seq_id_ranges:seq_id_ranges, domain_type:dom_type,
				event_type: Biojs.PDBeventHelper.event_types.MODELLED_DOMAIN_MOUSE_OUT };
		},
		SEQUENCE_DOMAIN_MOUSE_IN: function(pdb_id, entity_id, seq_id_ranges, dom_type) {
			return { pdb_id:pdb_id, entity_id:entity_id, seq_id_ranges:seq_id_ranges, domain_type:dom_type,
				event_type: Biojs.PDBeventHelper.event_types.SEQUENCE_DOMAIN_MOUSE_IN };
		},
		SEQUENCE_DOMAIN_MOUSE_OUT: function(pdb_id, entity_id, seq_id_ranges, dom_type) {
			return { pdb_id:pdb_id, entity_id:entity_id, seq_id_ranges:seq_id_ranges, domain_type:dom_type,
				event_type: Biojs.PDBeventHelper.event_types.SEQUENCE_DOMAIN_MOUSE_OUT };
		},
		SEQUENCE_DOMAIN_CLICK: function(pdb_id, entity_id, seq_id_ranges, dom_type, dom_id) {
			return { pdb_id:pdb_id, entity_id:entity_id, seq_id_ranges:seq_id_ranges, domain_type:dom_type, domain_id:dom_id,
				event_type: Biojs.PDBeventHelper.event_types.SEQUENCE_DOMAIN_CLICK };
		},
	}

} );
