
(function () { // this is to support jQuery events not based on any dom element, copied from http://stackoverflow.com/questions/9977486/event-trigger-not-firing-in-non-dom-object
	var topics = {};
	jQuery.Topic = function (id) {
		var callbacks, method, topic = id && topics[id];
		if (!topic) {
			callbacks = jQuery.Callbacks();
			topic = {
				publish: callbacks.fire,
				subscribe: callbacks.add,
				unsubscribe: callbacks.remove
			};
			if (id) {
				topics[id] = topic;
			}
		}
		return topic;
	};
}) ();
