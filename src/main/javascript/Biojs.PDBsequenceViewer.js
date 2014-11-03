/** 
 * This is the description of the PDBchainTopology component. This component renders secondary structure topology for a protein chain in a PDB entry.
 * 
 * @class
 * @extends Biojs
 * 
 * @author <a href="mailto:swanand@gmail.com">Swanand Gore</a>
 * @version 1.0.0
 * @category 0
 *
 * @requires <a href='http://code.jquery.com/jquery-1.6.4.js'>Raphael 2.1.0</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/graphics/raphael-2.1.0.js"></script>
 * 
 * @requires <a href='http://code.jquery.com/jquery-1.6.4.js'>jQuery Core 1.6.4</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/jquery/jquery-1.4.2.min.js"></script>
 * 
 * @param {Object} options An object with the options for PDBchainTopology component.
 *    
 * @option {list}
 *    Following options are available to configure the component:
 *    <ul>
 *    <li>divid: parent div id.</li>
 *    <li>numrows: rows into which the sequence view is to be split up.</li>
 *    <li>tracks: Description of tracks in each row.</li>
 *    </ul>
 *    
 * @example 
 * var mytopo = new Biojs.PDBchainTopology({
 * 		divid:"YourOwnDivId",   pdbid:"1cbs", chainid:"A"
 * });	
 * 
 */


// this is so that a tooltip content will change if moved about - useful for sequence-index-related stuff
jQuery.widget("ui.mouseDepTooltip", jQuery.ui.tooltip, {
	_create: function() {
		this._super();
		this._on({ mousemove: "open" });
	},
	open: function(event) {
		var that = this,
			target = jQuery( event ? event.target : this.element )
				// we need closest here due to mouseover bubbling,
				// but always pointing at the same event target
				.closest( this.options.items );

		// No element to show a tooltip for or the tooltip is already open
		if ( !target.length ) {
			return;
		}

		if ( target.attr( "title" ) ) {
			target.data( "ui-tooltip-title", target.attr( "title" ) );
		}

		target.data( "ui-tooltip-open", true );

		// kill parent tooltips, custom or native, for hover
		if ( event && event.type === "mouseover" ) {
			target.parents().each(function() {
				var parent = jQuery( this ),
					blurEvent;
				if ( parent.data( "ui-tooltip-open" ) ) {
					blurEvent = jQuery.Event( "blur" );
					blurEvent.target = blurEvent.currentTarget = this;
					that.close( blurEvent, true );
				}
				if ( parent.attr( "title" ) ) {
					parent.uniqueId();
					that.parents[ this.id ] = {
						element: this,
						title: parent.attr( "title" )
					};
					parent.attr( "title", "" );
				}
			});
		}

		this._updateContent( target, event );
	}
});




Biojs.BasicSequencePainter = Biojs.extend({
	constructor: function(options) {
		var self = this;
		self.init(options);
	},
	init: function(options) {
		var self = this;
		self.raphadivs = options.raphadivs;
		self.seqlen = options.seqlen;
		self.numIndicesInRow = options.numIndicesInRow;
		self.basedivid = options.basedivid;
		self.currentZoomIndices = [0,options.seqlen-1]; self.prevZoomIndices = [0,options.seqlen-1];
		self.noXstretchElems = []; // elems for which x-scaling on sequence-zoom is to be undone
		self.redrawTextElems = []; // domain text titles which need to be redrawn after zoom
		self.seqtextelems = {};
		self.textstyle = 'px "Courier"';
	},
	index2coordinate: function(index) {
		// from raphael objects provided, return raphael object and bounding coordinates of a box corresponding to an index
		var self = this;
		if(index >= self.seqlen) return null;
		var raphaindex = (Math.floor(index/self.numIndicesInRow));
		var rowindex = index-raphaindex*self.numIndicesInRow;
		var rd = self.raphadivs[raphaindex];
		var x0 = rd.extents[0]; var x1 = rd.extents[2]; var y0 = rd.extents[1]; var y1 = rd.extents[3];
		var startx = (x1-x0)/self.numIndicesInRow * rowindex;
		var stopx  = (x1-x0)/self.numIndicesInRow * (rowindex+1);
		return {rapha:rd.rapha, startx:startx, starty:y0, stopx:stopx, stopy:y1};
	},
	breakRangeAtRowBoudary: function(start,stop) {
		var self = this;
		var ri1 = (Math.floor(start/self.numIndicesInRow));
		var ri2 = (Math.floor(stop/self.numIndicesInRow));
		if(ri1==ri2) return [[start,stop]];
		var all = [start];
		for(var ri=ri1; ri < ri2; ri++) {
			all.push((ri+1)*self.numIndicesInRow-1); all.push((ri+1)*self.numIndicesInRow);
		}
		all.push(stop);
		var ret = [];
		for(var ai=0; ai < all.length; ai+=2) ret.push( [all[ai],all[ai+1]] );
		return ret;
	},
	breakDomainRangesAtRowBoundary: function(ranges) {
		var self = this;
		var retranges = [];
		for(var ri=0; ri < ranges.length; ri++) {
			var brokenranges = self.breakRangeAtRowBoudary(ranges[ri][0],ranges[ri][1])
			for(var bi=0; bi < brokenranges.length; bi++) retranges.push(brokenranges[bi]);
		}
		return retranges;
	},
	complementaryRanges: function(ranges) {
		// get ranges that span the whole sequence except given ranges
		var self = this;
		var sr = [];
		for(var ri=0; ri < ranges.length; ri++) sr.push(ranges[ri]);
		for(var ri=0; ri < ranges.length; ri++)
			for(var rk=ri+1; rk < ranges.length; rk++)
				if(sr[ri][0] > sr[rk][0]) {
					var temp = sr[ri];
					sr[ri] = sr[rk];
					sr[rk] = temp;
				}
		if(sr.length == 0) return [ [0, self.seqlen-1] ];
		var retranges = [];
		if(sr[0][0] > 0) retranges.push([0,sr[0][0]-1]);
		if(sr[sr.length-1][1] < self.seqlen-1) retranges.push([ sr[sr.length-1][1]+1 , self.seqlen-1 ]);
		for(var ri=0; ri < sr.length-1; ri++) {
			retranges.push([ sr[ri][1]+1, sr[ri+1][0]-1 ]);
		}
		return retranges;
	},
	drawHelix: function(rangeStart, rangeEnd, attribs) {
		var self = this;
		var robs = [], hrad=4;
		for(var hi = rangeStart; hi <= rangeEnd; hi++) {
			if(hi == rangeStart && rangeStart == rangeEnd) {
				var rda = self.index2coordinate(hi);
				var mx = (rda.startx+rda.stopx)/2;
				var my = (rda.starty+rda.stopy)/2;
				robs.push( rda.rapha.circle(mx, my, hrad).attr(attribs) );
				continue;
			}
			if(hi == rangeEnd && rangeStart == rangeEnd) {
				continue;
			}
			if(hi == rangeStart || hi == rangeEnd) {
				var rda = self.index2coordinate(hi);
				//var mx = (rda.startx+rda.stopx)/2;
				var my = (rda.starty+rda.stopy)/2;
				//robs.push( rda.rapha.circle(mx, my, hrad).attr(attribs) );
				if(hi==rangeStart)
					robs.push( rda.rapha.path(["M", rda.stopx, my+hrad, "A", (rda.stopx-rda.startx)/2, hrad, 180, 1, 1, rda.stopx, my-hrad, "Z"]).attr(attribs) );
				else
					robs.push( rda.rapha.path(["M", rda.startx, my+hrad, "A", (rda.stopx-rda.startx)/2, hrad, -180, 0, 0, rda.startx, my-hrad, "Z"]).attr(attribs) );
			}
			if(hi == rangeStart+1) {
				var rda = self.index2coordinate(hi);
				var rdb = self.index2coordinate(rangeEnd-1);
				var mxa = rda.startx;
				var mxb = rdb.stopx;
				var mya = (rda.starty + rdb.stopy) / 2;
				robs.push( rda.rapha.rect(mxa,mya-hrad,mxb-mxa,2*hrad).attr(attribs) );
			}
		}
		return robs;
	},
	drawStrand: function(rangeStart, rangeEnd, Hstart, Hend, attribs) {
		var self = this;
		var robs = [], stem = [];
		for(var hi = rangeStart; hi <= rangeEnd; hi++) {
			var rda = self.index2coordinate(hi);
			var mx = (rda.startx+rda.stopx)/2;
			var my = (rda.starty+rda.stopy)/2;
			if(hi==Hend) { // draw triangle tip of arrow
				var tsx = rda.startx, tsy = rda.starty, tex = rda.stopx, tey = rda.stopy;
				var dx = tex-tsx, dy = tey-tsy;
				tsy += dy*0.4; tey -= dy*0.4;
				robs.push( rda.rapha.path(["M", tsx, tsy, "L", tsx, tey, "L", tex, my, "Z"]).attr(attribs) );
			}
			else if(hi==Hend-1) { // draw trapezium base of arrow
				var tsx = rda.startx, tsy = rda.starty, tex = rda.stopx, tey = rda.stopy;
				tsy1 = tsy; tey1 = tey;
				var dx = tex-tsx, dy = tey-tsy;
				tsy += dy*0.4; tey -= dy*0.4;
				tsy1 += dy*0.2; tey1 -= dy*0.2;
				robs.push( rda.rapha.path(["M", tsx, tsy1, "L", tsx, tey1, "L", tex, tey, "L", tex, tsy, "Z"]).attr(attribs) );
			}
			else {
				stem.push(hi);
			}
		}
		if(stem.length > 0) {
			robs = robs.concat( self.drawHorizontalLine(stem[0], stem[stem.length-1], {midpercent:30}, attribs) );
		}
		return robs;
	},
	drawHorizontalLine: function(start,stop,ypos,attribs) {
		var self = this;
		var brokenranges = self.breakRangeAtRowBoudary(start,stop), raphaobjects = [];
		for(var bi=0; bi<brokenranges.length; bi++) {
			var rd1 = self.index2coordinate(brokenranges[bi][1]);
			var rd0 = self.index2coordinate(brokenranges[bi][0]);
			var sx = rd0.startx; var sy = rd0.starty;
			var ex = rd1.stopx; var ey = rd1.stopy;
			if(ypos.midpercent) {
				my = (sy+ey)/2; py = (ey-sy)/100;
				sy = my - ypos.midpercent/2*py;
				ey = my + ypos.midpercent/2*py;
				raphaobjects.push( rd0.rapha.rect(sx,sy,ex-sx,ey-sy).attr(attribs) );
			}
			else if(ypos.rangepercent) {
				py = (ey-sy)/100;
				ey = sy + ypos.rangepercent[1]*py;
				sy = sy + ypos.rangepercent[0]*py;
				raphaobjects.push( rd0.rapha.rect(sx,sy,ex-sx,ey-sy).attr(attribs) );
			}
			else if(ypos.helix==1) {
				raphaobjects = raphaobjects.concat( self.drawHelix(brokenranges[bi][0], brokenranges[bi][1], attribs) );
			}
			else if(ypos.strand==1) {
				raphaobjects = raphaobjects.concat( self.drawStrand(brokenranges[bi][0], brokenranges[bi][1], start, stop, attribs) );
			}
			else alert("drawHorizontalLine cant understand y-placement for line!");
		}
		return raphaobjects;
	},
	selectiveCopy: function(keysFromDict, raphaElemToCopyAttrFrom) {
		// copy properties from latter into a new dictionary only for keys in former, and return
		var ret = {};
		for(k in keysFromDict) ret[k] = raphaElemToCopyAttrFrom.attr(k);
		return ret;
	},
	addClickHoverToAllRaphaParentDivs: function(tooltip, clickurl) {
		var self = this;
		for(var ri=0; ri < self.raphadivs.length; ri++) {
			var rd = self.raphadivs[ri];
			var jqrd = jQuery("#"+rd.trackdiv);
			jqrd.attr("title", "dummy");
			jqrd.css({cursor:'pointer'});
			jqrd.tooltip({
				content: function() {return tooltip;},// + " " + Math.random();},
				//content: function() { console.log(tooltip); return tooltip; },
				track:true
			});
			jqrd.click( function(e) {
				//document.location.href=clickurl;
				window.open(clickurl);
			} );
		}
	},
	zoomOnSequenceRange: function(start,stop) {
		// changes viewbox so that the sequence between start and stop occupies the whole raphael canvas
		var self = this;
		if(self.raphadivs.length != 1) { alert("Serious error - zoom is not possible if painter spans more than a row!"); return; }
		var rd = self.raphadivs[0];
		var startx = self.index2coordinate(start).startx, stopx = self.index2coordinate(stop).stopx;
		rd.rapha.setViewBox(startx, 0, stopx-startx, rd.rapha.height, false);
		rd.rapha.canvas.setAttribute('preserveAspectRatio', 'none'); // TODO no equivalent fix for IE 6/7/8?
	},
	onSequenceZoom: function(type, args, me) {
		if(me.basedivid != args[0].basedivid) return;
		me.zoomOnSequenceRange(args[0].start, args[0].stop);
		me.prevZoomIndices = [me.currentZoomIndices[0], me.currentZoomIndices[1]];
		me.currentZoomIndices = [args[0].start,args[0].stop];
		me.undoXscaling();
		me.redrawText();
		me.redoSequenceText();
	},
	getRangediffForSeqfont: function() {
		// at which range will i have a fontsize >= lesser_of(10,charheight)?
		var self = this;
		var rd = self.index2coordinate(0), minfontsize=20;
		var charwidth = rd.stopx-rd.startx, charheight = rd.stopy-rd.starty;
		if(minfontsize > charheight) minfontsize = charheight;
		rangediff = charwidth * self.seqlen / minfontsize;
		return rangediff;
	},
	getScaledFontsizeForSequence: function() {
		var self = this;
		var rd = self.index2coordinate(0);
		var charwidth = rd.stopx-rd.startx, charheight = rd.stopy-rd.starty;
		var xscale = Math.abs( (self.currentZoomIndices[0]-self.currentZoomIndices[1]+1) / self.seqlen ) ;
		charwidth /= xscale;
		var fontsize = charwidth;
		if(charheight < charwidth) fontsize = charheight;
		fontsize = Math.round(fontsize*0.8);
		return fontsize;
	},
	redoSequenceText_1: function() {
		var self = this;
		var fontsize = self.getScaledFontsizeForSequence();
		var fontstyle = fontsize + self.textstyle;
		var rangediff = self.getRangediffForSeqfont();
		var shouldShowSeq = (Math.abs(self.currentZoomIndices[1]-self.currentZoomIndices[0]) <= rangediff);
		var rd = self.index2coordinate(0);
		console.log("shouldShowSeq", shouldShowSeq);
		jQuery.each(self.domains, function(di,dmn) {
			if(!dmn.sequence) return;
			if(shouldShowSeq == false) {
				if(dmn.seqelem) {
					dmn.seqelem.remove(); dmn.seqelem = null; console.log("destroy");
				}
				return;
			}
			if(!dmn.seqelem) {
				var xscale =  (self.currentZoomIndices[1]-self.currentZoomIndices[0]) / self.seqlen;
				var tx = rd.startx, ty = (rd.starty+rd.stopy)/2;
				dmn.seqelem = rd.rapha.text(tx, ty, dmn.sequence)
					.attr("text-anchor", "start")
					.attr("font", fontstyle);
				if(dmn.seqattr) dmn.seqelem.attr(dmn.seqattr);
				// undo x-scaling
				dmn.seqelem.scale(xscale, 1, tx, ty);//, dmn.seqelem.x);
				// adjust font
				//dmn.seqelem.attr("font", fontstyle);
				// ideal width of seqelem per residue index should be ...
				ideal = (rd.stopx-rd.startx) ; curr = dmn.seqelem.getBBox().width/self.seqlen;
				letterspacing = (ideal-curr)/xscale;
				dmn.seqelem.attr("letter-spacing", letterspacing+"px") ;
				// message
				console.log("created ", self.seqlen, xscale, curr, ideal, letterspacing, letterspacing/xscale, dmn.seqelem);
			}
		});
	},
	redoSequenceText: function() {
		var self = this;
		var fontsize = self.getScaledFontsizeForSequence();
		var fontstyle = fontsize + self.textstyle;
		var rangediff = self.getRangediffForSeqfont();
		var shouldShowSeq = (Math.abs(self.currentZoomIndices[1]-self.currentZoomIndices[0]) <= rangediff);
		if(Object.keys(self.seqtextelems).length > 2500) { // flush any memory hog by too many elems
			jQuery.each(self.seqtextelems, function(ri,relem) { relem.remove(); } );
			self.seqtextelems = {};
			console.log("flushing too many seqtextelems");
		}
		//console.log("shouldShowSeq " , shouldShowSeq, Math.abs(self.currentZoomIndices[1]-self.currentZoomIndices[0]) , rangediff, Object.keys(self.seqtextelems).length);
		if(shouldShowSeq == false) { // hide
			jQuery.each(self.seqtextelems, function(ri,relem) { relem.hide(); });
		}
		else {
			jQuery.each(self.domains, function(di,dmn) {
				if(!dmn.sequence) return;
				var rd = self.index2coordinate(0);
				var xscale =  (self.currentZoomIndices[1]-self.currentZoomIndices[0]) / (self.seqlen) ;
				for(var ri=self.currentZoomIndices[0]; ri <= self.currentZoomIndices[1]; ri++) {
					if(! (ri in self.seqtextelems)) {
						var rd = self.index2coordinate(ri);
						var relem = rd.rapha.text((rd.startx+rd.stopx)/2, (rd.starty+rd.stopy)/2, dmn.sequence[ri]);
						relem.scale(xscale,1); relem.attr("font",fontstyle);
						if(dmn.seqattr) relem.attr(dmn.seqattr);
						self.seqtextelems[ri] = relem;
					}
					self.seqtextelems[ri].show();
				}
				//jQuery.each(self.seqtextelems, function(ri,relem) { relem.scale(xscale,1); relem.attr("font",fontstyle); } );
			});
		}
	},
	undoXscaling: function() {
		var self = this;
		var xscale =  (self.currentZoomIndices[0]-self.currentZoomIndices[1]) / (self.prevZoomIndices[0]-self.prevZoomIndices[1]) ;
		jQuery.each(self.noXstretchElems, function(ri,relem) { relem = relem.scale(xscale,1); });
	},
	redrawText: function() {
		var self = this;
		jQuery.each(self.redrawTextElems, function(ti,telem) {
			//console.log(telem.data("in_rect")); console.log(telem);
			//telem.attr("text", "heyyy"); telem.attr("font", "20px 'Courier'");
			var rwidth = telem.data("in_rect").attr('width'), rheight = telem.data("in_rect").attr('height');
			var textfont = self.textTruncate(telem.data("fulltext"), rwidth, rheight);
			telem.attr("font",textfont[1]+self.textstyle).attr("text",textfont[0]);
		});
	}
});

Biojs.ZoombarPainter = Biojs.BasicSequencePainter.extend({
	constructor: function(options) {
		var self = this;
		self.init(options);
		self.pixelwidth = options.pixelwidth;
		self.initleft = options.initleft; self.initright = options.initright; self.minval = 0; self.maxval = options.seqlen-1;
	},
	paint: function() {
		var self = this;
		if(self.raphadivs.length != 1) {
			alert("Serious error - Cannot implement ZoombarPainter in more than one row!"); return;
		}
		var rd = self.raphadivs[0];
		jQuery("#"+rd.trackdiv).empty();
		var sliderhtml = '<div id="'+rd.trackdiv+'_sliderdiv" style="width:'+self.pixelwidth+'px;"></div>';
		jQuery("#"+rd.trackdiv).append(sliderhtml);
    	var convertPixelToValue = function (pval) {
    		var cf = (self.maxval-self.minval)/(self.pixelwidth); // remember to account for width of thumbnail image!
        	return Math.round(pval * cf + self.minval);
    	};
    	var convertValueToPixel = function (val) {
    		var cf = (self.pixelwidth)/(self.maxval-self.minval); // remember to account for width of thumbnail image!
        	return Math.round(val * cf);
    	};
			// at which range will i have a fontsize >= lesser_of(10,charheight)?
			
			rangediff = self.getRangediffForSeqfont()-1;
			console.log("range-diff from range-slider", rangediff);
			var tickinterval = self.maxval / 10, ticks = [10,25,50,75,100,200,250,400,500]; var goodinterval = ticks[ticks.length-1];
			for(var ti=ticks.length-2; ti>=0; ti--) { // choose member of ticks with least positive difference
				if(tickinterval > goodinterval) break;
				goodinterval = ticks[ti];
			}
		var tickorder = [10000,10000,1000,100,10,1];
   		var px_per_index = (self.pixelwidth)/(self.maxval-self.minval);
		if(px_per_index > 1) {}
		else if(px_per_index > .1) { tickorder.splice(tickorder.length-1, 1); }
		else if(px_per_index > 0.01) { tickorder.splice(tickorder.length-2, 2); }
		else if(px_per_index > 0.001) { tickorder.splice(tickorder.length-3, 3); }
		else if(px_per_index > 0.0001) { tickorder.splice(tickorder.length-4, 4); }
		var tickinfo = {100000:'$', 10000:'*', 1000:"|", 100:"!", 10:':', 1:'.'}
        jQuery('#'+rd.trackdiv+"_sliderdiv").rangeSlider({
			arrows:true,
			bounds:{min:self.minval,max:self.maxval},
			defaultValues:{min:self.minval,max:self.maxval}, step:1, valueLabels:'change',
			scales : [
				{
					first: function(val) { return val; },
					next: function(val) { return val + 1; },
					stop: function(val){ return false; },
					label: function(val) {
						for(var ti=0; ti<tickorder.length; ti++) {
							var atick = tickorder[ti];
							if(val%atick==0) {
								if(val!=0 ||ti == tickorder.length-1) return tickinfo[atick];
							}
						}
					},
					format: function(tickContainer, val, tickEnd) {
						for(var ti=0; ti<tickorder.length; ti++) {
							var atick = tickorder[ti];
							if(val%atick==0) {
								if(val!=0 || ti==tickorder.length-1) { tickContainer.addClass("rangeslider_tick_"+atick); }
							}
						}
					}
				}
			],
			range:{min:rangediff,max:false}, // TODO range does not work if slider moves from 0
			formatter:function(seq_index) { return seq_index + 1 ; } // because indices are 1 onwards for biologists
		});
		jQuery('#'+rd.trackdiv+"_sliderdiv").bind("valuesChanging", function(e,data) {
		//jQuery('#'+rd.trackdiv+"_sliderdiv").bind("valuesChanged", function(e,data) {
			var thestart = data.values.min, thestop = data.values.max;
			if(thestart > thestop) { temp = thestart; thestart = thestop; thestop = temp; }
			jQuery.Topic("SequenceZoomEvent").publish({basedivid:self.basedivid,start:thestart, stop:thestop});
		});
	}
});

Biojs.ObservedSequencePainter = Biojs.BasicSequencePainter.extend({
	constructor: function(options) {
		var self = this;
		self.init(options);
		self.unobserved = options.unobserved;
		self.observed = options.observed;
		self.midribAttrib = options.midribAttrib;
		self.obsbarAttrib = options.obsbarAttrib;
		self.tooltip = options.tooltip;
		self.clickURL = options.clickURL;
	},
	paint: function() {
		var self = this;
		jQuery.Topic("SequenceZoomEvent").subscribe( function(data) { self.onSequenceZoom(null, [data], self); });
		self.drawHorizontalLine(0, self.seqlen-1, {midpercent:20}, self.midribAttrib);
		if(self.observed == undefined) cranges = self.complementaryRanges(self.unobserved);
		else cranges = self.observed;
		for(var ci=0; ci < cranges.length; ci++) {
			self.drawHorizontalLine(cranges[ci][0], cranges[ci][1], {midpercent:80}, self.obsbarAttrib);
		}
		self.addClickHoverToAllRaphaParentDivs(self.tooltip, self.clickURL);
	},
});

Biojs.DomainPainter = Biojs.BasicSequencePainter.extend({
	constructor: function(options) {
		var self = this;
		self.init(options);
		self.domains = options.domains;
	},
	paint: function() {
		var self = this;
		jQuery.Topic("SequenceZoomEvent").subscribe( function(data) { self.onSequenceZoom(null, [data], self); });
		for(var di=0; di < self.domains.length; di++) {
			var dmn = self.domains[di];
			dmn.domUid = self.basedivid + "_domid"+Math.random();
			self.paintDomain(dmn);
		}
	},
	paintDomain: function(dmn) {
		var self = this;
		var domranges = self.breakDomainRangesAtRowBoundary(dmn.ranges);
		dmn.raphaGlowObjs = []; // which elements are to be glowed when mouse hovers on domain?
		var allrectelems = [], alltextelems = [];
		for(var dri=0; dri < domranges.length; dri++) {
			var rectelems = self.drawHorizontalLine(domranges[dri][0],domranges[dri][1], dmn.ypos, dmn.attribs);
			allrectelems = allrectelems.concat(rectelems);
			var textelems = self.addTexttoDomain(dmn, rectelems);
			alltextelems = alltextelems.concat(textelems);
			self.noXstretchElems = self.noXstretchElems.concat(textelems);
			self.redrawTextElems = self.redrawTextElems.concat(textelems);
		}
		if(dmn.listenResidueHoverEvent) {
			jQuery.Topic("ResidueHoverEvent").subscribe( function(data) {
				if(data.sourcediv == self.basedivid) return;
				if(!dmn.listenResidueHoverEvent(data)) return;
				rd = self.index2coordinate(data.seq-1);
				var mx = (rd.stopx-rd.startx)/2;
				var my = (rd.stopy-rd.starty)/2;
				var sx = (3*rd.startx+rd.stopx)/4;
				var sy = (3*rd.starty+rd.stopy)/4;
				rd.rapha.rect(sx, sy, mx, my, mx/5).animate({ opacity : 0 }, 1000, function () { this.remove() });
			});
		}
		if(dmn.glowOnHover) { // change look of domain's rectangles on hover
			jQuery.each([].concat(allrectelems,alltextelems), function(aei,anobj) {
				jQuery(anobj.node).mouseenter( function(e) {
					jQuery.each(allrectelems, function(ri,robj) {
						if(!robj.data('actualattr')) robj.data("actualattr", self.selectiveCopy(dmn.glowOnHover,robj));
						robj.attr(dmn.glowOnHover);
					});
				});
				jQuery(anobj.node).mouseleave( function(e) {
					jQuery.each(allrectelems, function(ri,robj) {
						robj.attr(robj.data('actualattr'));
					});
				});
			});
		}
		if(dmn.tooltip || dmn.fireResidueHoverEvent) { // add tooltip if given in options
			jQuery.each([].concat(allrectelems,alltextelems), function(ri,relem) {
				jQuery(relem.node).attr("title","dummy");
				jQuery(relem.node).qtip({
					content:"PDBe Sequence Viewer",
					position: {
						target: "mouse", adjust: {x:5, y:5},
					},
					style: { 'classes': 'qtip-bootstrap qtip-shadow qtip-rounded' },
					events: {
						move: function(ev,api) {
							var mev = Biojs.PSVevents.latestMouseEvent;
							var trackdiv = jQuery(relem.node).parent().parent();
							var mo = trackdiv.offset(), width = trackdiv.width();
							var seqindex = Math.floor((mev.pageX-mo.left)/width * (1+self.currentZoomIndices[1]-self.currentZoomIndices[0])) + self.currentZoomIndices[0];
							if(dmn.fireResidueHoverEvent) {
								var msgobj = dmn.fireResidueHoverEvent();
								msgobj["seq"] = seqindex; msgobj["sourcediv"] = self.basedivid;
								jQuery.Topic("ResidueHoverEvent").publish(msgobj);
							}
							var newtip = "";
							if(dmn.tooltip) {
								if(dmn.tooltip.tfunc) newtip = dmn.tooltip.tfunc(dmn.tooltip, seqindex);
								else if(dmn.tooltip.text) newtip = dmn.tooltip.text + " index " + seqindex;
							}
							var qapi = jQuery(relem.node).data('qtip');//, newtip = 'new tooltip content ' + Math.random();
                 			qapi.options.content.text = newtip; // update content stored in options
							qapi.elements.content.text(newtip); // update visible tooltip content
						}
					}
				});
			});
		}
		self.paintConnectorsBaloons(dmn);
		self.redoSequenceText(dmn);
	},
	textTruncate: function(thetext,rectwidth,rectheight) { // truncate text based on fontsize and width available to display text
		var self = this;
		var xscale = Math.abs( (self.currentZoomIndices[0]-self.currentZoomIndices[1]+1) / (self.seqlen) );
		rectwidth /= xscale;
		var minfontsize = 10, maxfontsize = rectheight-1;
		var fontsize = rectwidth/thetext.length;
		var newtext = thetext;
		if(fontsize < minfontsize) {
			fontsize = minfontsize;
			var possibleTextlen = Math.floor(rectwidth/minfontsize);
			if(possibleTextlen<=1) newtext = ".";
			else if(possibleTextlen < 4) newtext = thetext[0] + "..";
			else newtext = thetext.substring(0,rectwidth/minfontsize-3) + "...";
		}
		if(fontsize >= maxfontsize) fontsize = maxfontsize;
		return [newtext, fontsize];
	},
	showSequence: function(theseq) { // not used anymore?!
		console.log("showSequence called!!!HEREEEEE");
		if(!theseq) return [];
		var self = this;
		if(theseq.length != self.seqlen) alert("Cannot show sequence due to unxpected length! " + theseq.length + " expected:" + self.seqlen);
		var rd = self.index2coordinate(0);
		var seqtextelems = rd.rapha.set();
		for(var ri=0; ri < self.seqlen; ri++) {
		//for(var ri=me.currentZoomIndices[0]; ri <= me.currentZoomIndices[1]; ri++) {
			var rd = self.index2coordinate(ri);
			seqtextelems.push(
				rd.rapha.text((rd.startx+rd.stopx)/2, (rd.starty+rd.stopy)/2, theseq[ri])
			);
		}
		return seqtextelems;
	},
	addTexttoDomain: function(dmn,rectangles) {
		var self = this;
		if(!dmn.displayname) return [];
		var textelems = [];
		jQuery.each(rectangles, function(roindex,arect) {
			var rd0 = arect.paper;
			var newtextfont = self.textTruncate(dmn.displayname, arect.attr('width'), arect.attr('height'));
			var newtext = newtextfont[0], fontsize = newtextfont[1];
			textelems.push( rd0.text(arect.attr('x')+arect.attr('width')/2, arect.attr('y')+arect.attr('height')/2, newtext)
				.attr({font:fontsize+self.textstyle})
				.data("in_rect",arect)
				.data('fulltext',dmn.displayname)
			);
		});
		return textelems;
	},
	addSequencetext: function(dmn,rectangles) {
		
	},
	paintConnectorsBaloons: function(dmn) {
		var self = this;
		if(dmn.connectors) {
			jQuery.each(dmn.connectors, function(ci,aconn) {
				self.makeConnector(aconn);
			});
		}
		if(dmn.baloons) {
			jQuery.each(dmn.baloons, function(ci,bparams) {
				self.noXstretchElems = self.noXstretchElems.concat(self.makeBaloon(bparams));
			});
		}
	},
	makeConnector: function(aconn) {
		var self = this;
		var retconnectors = [];
		if(self.raphadivs.length != 1) { alert("Serious error - making connectors is not possible if painter spans more than a row!"); return []; }
		var rd0 = self.index2coordinate(aconn.from), rd1 = self.index2coordinate(aconn.to);
		var bx = (rd0.startx+rd0.stopx)/2, by = (rd0.starty+rd0.stopy)/2
		var ex = (rd1.startx+rd1.stopx)/2, ey = (rd1.starty+rd1.stopy)/2
		var yp = (rd0.stopy-rd0.starty)/100;
		var yy = rd0.starty + Math.random()*100*yp;
		if(aconn.ypos.fromtop) {
			yy = rd0.starty + yp * (aconn.ypos.fromtop + Math.random()*10); // there is a bit of randomness added here so that connectors do not overlap
			yy = rd0.starty + yp * (aconn.ypos.fromtop);
		}
		else { alert("Error, dont know where to place connector in Y direction! assigning randomly..."); }
		var connelems = [
			rd0.rapha.path(["M",bx,by,"L",bx,yy]).attr(aconn.attribs),
			rd0.rapha.path(["M",bx,yy,"L",ex,yy]).attr(aconn.attribs),
			rd0.rapha.path(["M",ex,yy,"L",ex,ey]).attr(aconn.attribs)
		];
		self.noXstretchElems.push(connelems[0]); self.noXstretchElems.push(connelems[2]); // vertical lines need not x-stretch
		if(aconn.tooltip)
			jQuery.each(connelems, function(ci,connelem) {
				jQuery(connelem.node).attr("title","dummy");
				jQuery(connelem.node).tooltip({
					content: function() {return aconn.tooltip;},
					track:true
				});
			});
		if(aconn.glowOnHover) {
			jQuery.each(connelems, function(acmi,acm) {
				jQuery(acm.node).mouseenter( function(e) {
					jQuery.each(connelems, function(ci,connelem) {
						if(!connelem.data('actualattr')) connelem.data("actualattr", self.selectiveCopy(aconn.glowOnHover,connelem));
						connelem.attr(aconn.glowOnHover);
					});
				});
			});
			jQuery.each(connelems, function(acmi,acm) {
				jQuery(acm.node).mouseleave( function(e) {
					jQuery.each(connelems, function(ci,connelem) {
						connelem.attr(connelem.data("actualattr"));
					});
				});
			});
		}
		return connelems;
	},
	makeBaloon: function(bparams) {
		var self = this, retelems=[];
		var rd0 = self.index2coordinate(bparams.at);
		var bx = (rd0.startx+rd0.stopx)/2, by = (rd0.starty+rd0.stopy)/2
		var yp = (rd0.stopy-rd0.starty)/100;
		var yy = rd0.starty + Math.random()*100*yp;
		if(bparams.ypos.fromtop) {
			yy = rd0.starty + yp * (bparams.ypos.fromtop);
		}
		else { alert("Error, dont know where to place connector in Y direction! assigning randomly..."); }
		retelems.push( rd0.rapha.path(["M",bx,by,"L",bx,yy]).attr(bparams.attribs) );
		if(bparams.shape=="square") {
			retelems.push( rd0.rapha.rect(bx-bparams.size/2,yy-bparams.size/2,bparams.size,bparams.size).attr(bparams.attribs) );
		}
		else if(bparams.shape=="diamond") {
			var dpath = ["M",bx-bparams.size/2,yy, "L",bx,yy-bparams.size/2, "L",bx+bparams.size/2,yy, "L",bx,yy+bparams.size/2, "Z"];
			retelems.push( rd0.rapha.path(dpath).attr(bparams.attribs) );
		}
		else {
			retelems.push( rd0.rapha.circle(bx,yy,bparams.size/2).attr(bparams.attribs) );
		}
		if(bparams.tooltip)
			jQuery.each(retelems, function(ri,relem) {
				jQuery(relem.node).attr("title","dummy");
				jQuery(relem.node).tooltip({
					content: function() {return bparams.tooltip;},
					track:true
				});
			});
		if(bparams.glowOnHover)
			jQuery.each(retelems, function(ri,relem) {
				jQuery(relem.node).mouseenter( function(e) {
					jQuery.each(retelems, function(ai,anelem) {
						if(!anelem.data("actualattr")) anelem.data("actualattr", self.selectiveCopy(bparams.glowOnHover,anelem));
						anelem.attr(bparams.glowOnHover);
					});
				});
				jQuery(relem.node).mouseleave( function(e) {
					jQuery.each(retelems, function(ai,anelem) {
						anelem.attr(anelem.data("actualattr"));
					});
				});
			});
		return retelems;
	}
});

Biojs.PDBsequenceViewer = Biojs.extend ({
	constructor: function (options) {
		var self = this;
		self.divid = options.divid;
		self.makeLayout(options.divid, options.numrows, options.leftwidth, options.width, options.rightwidth, options.tracks);
		self.drawTracks(options.tracks, options.numrows);
		if(!Biojs.PSVevents) Biojs.PSVevents = {}; // namespace for internal events within PDBsequenceViewer
		jQuery('#'+options.divid).mousemove( function(e) {Biojs.PSVevents.latestMouseEvent = e;} ); // TODO remove this hack
	},
	makeLayout: function(divid, numrows, leftwidth, width, rightwidth, tracks) {
		// the aim here is to make divs for rapha objects necessary, and assign a raphael object (and area therein) to a row/track
		// to implement another kind of layout, this method should be overridden in a subclass
		var self = this;
		var rowheight = 0;
		for(var ti=0; ti < tracks.length; ti++) rowheight += tracks[ti].height;
		var totwidth = leftwidth + width + rightwidth;

		jQuery('#'+divid).append("<div class='pdbseqview_leftlabelcol' id='"+divid+"_leftlabel' style='width:"+leftwidth+"px;'></div>");
		jQuery('#'+divid).append("<div class='pdbseqview_trackcol' id='"+divid+"_tracklabel' style='width:"+width+"px;'></div>");
		jQuery('#'+divid).append("<div class='pdbseqview_rightlabelcol' id='"+divid+"_rightlabel' style='width:"+rightwidth+"px;'></div>");
		jQuery('#'+divid).append("<br style='clear:both;'/>");
		for(var ri=0; ri < numrows; ri++) { // make rows
			jQuery('#'+divid+"_leftlabel").append("<div class='row_left' id='"+divid+"_rowleft_"+ri+"' style='height:"+rowheight+"px;'></div>");
			jQuery('#'+divid+"_tracklabel").append("<div class='row_track' id='"+divid+"_rowtrack_"+ri+"' style='height:"+rowheight+"px;'></div>");
			jQuery('#'+divid+"_rightlabel").append("<div class='row_right' id='"+divid+"_rowright_"+ri+"' style='height:"+rowheight+"px;'></div>");
			for(var ti=0; ti < tracks.length; ti++) {
				var tht = tracks[ti].height; var ll = "", rl = "";
				if(tracks[ti].leftlabel) ll = tracks[ti].leftlabel;
				if(tracks[ti].rightlabel) rl = tracks[ti].rightlabel;
				jQuery('#'+divid+"_rowleft_"+ri).append("<div class='track_left' id='"+divid+"_row_"+ri+"_left_"+ti+"' style='height:"+tht+"px;'>"+ll+"</div>");
				jQuery('#'+divid+"_rowtrack_"+ri).append("<div class='track_track' id='"+divid+"_row_"+ri+"_track_"+ti+"' style='height:"+tht+"px;'></div>");
				jQuery('#'+divid+"_rowright_"+ri).append("<div class='track_right' id='"+divid+"_row_"+ri+"_right_"+ti+"' style='height:"+tht+"px;'>"+rl+"</div>");
				
			}
		}

// THIS IS THE EARLIER ROW-MAJOR LAYOUT
//		for(var ri=0; ri < numrows; ri++) // make rows
//			jQuery('#'+divid).append("<div class='pdbseqview_row' id='"+divid+"_row_"+ri+"' style='width:"+totwidth+"px;height:"+rowheight+"px;'></div>");
//		for(var ri=0; ri < numrows; ri++) { // make left/right/tracks within rows
//			for(var ti=0; ti < tracks.length; ti++) {
//				var trackdivid = divid+"_row_"+ri+"_trackroot_"+ti;
//				jQuery('#'+divid+"_row_"+ri).append("<div id='"+trackdivid+"' class='pdbseqview_track' style='height:"+tracks[ti].height+"px'></div>");
//				jQuery('#'+trackdivid).append("<span class='pdbseqview_lefttrack'  id='"+divid+"_row_"+ri+"_left_"+ ti+"' style='width:"+leftwidth+"px;'></span>");
//				jQuery('#'+trackdivid).append("<span class='pdbseqview_raphatrack' id='"+divid+"_row_"+ri+"_track_"+ti+"' style='width:"+width+"px;'></span>");
//				jQuery('#'+trackdivid).append("<span class='pdbseqview_righttrack' id='"+divid+"_row_"+ri+"_right_"+ti+"' style='width:"+rightwidth+"px;'></span>");
//			}
//		}

		self.rowtrackRapha = [];
		for(var ri=0; ri < numrows; ri++) { // make raphael canvas within each row-track-div
			self.rowtrackRapha.push([]);
			for(var ti=0; ti < tracks.length; ti++) {
				var rightdiv = divid+"_row_"+ri+"_right_"+ti; var leftdiv = divid+"_row_"+ri+"_left_"+ti;
				var trackdiv = divid+"_row_"+ri+"_track_"+ti;
				self.rowtrackRapha[ri].push( {rapha:Raphael(divid+"_row_"+ri+"_track_"+ti, width, tracks[ti].height), extents:[0,0,width,tracks[ti].height], leftdivid:leftdiv, rightdivid:rightdiv, trackdiv:trackdiv} );
			}
		}
	},
	getRowTrackAssets: function(ri,ti) {
		// returns assets created in makeLayout - this will need to be overridden in a subclass that overrides makeLayout
		var self = this;
		return self.rowtrackRapha[ri][ti];
	},
	drawTracks: function(tracks, numrows) {
		var self = this;
		for(var ti=0; ti < tracks.length; ti++) {
			var raphadivs = [];
			for(var ri=0; ri < numrows; ri++) {
				raphadivs.push(self.getRowTrackAssets(ri,ti));
			}
			for(var pi=0; pi < tracks[ti].painters.length; pi++) {
				var ap = tracks[ti].painters[pi];
				ap.raphadivs = raphadivs; ap.basedivid = self.divid;
				if(ap.type=="Biojs.ObservedSequencePainter") {
					var painter = new Biojs.ObservedSequencePainter(ap);
					painter.paint();
				}
				else if(ap.type=="Biojs.ZoombarPainter") {
					var painter = new Biojs.ZoombarPainter(ap);
					painter.paint();
				}
				else if(ap.type=="Biojs.DomainPainter") {
					var painter = new Biojs.DomainPainter(ap);
					painter.paint();
				}
				else {
					alert("serious error! unknown painter type " + ap.type);
				}
			}
		}
	}
});
