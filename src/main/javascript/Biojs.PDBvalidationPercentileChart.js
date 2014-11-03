
Biojs.PDBvalidationPercentileChart = Biojs.extend ( {
	constructor: function(options) {
		var self = this;
		for(k in options) self[k] = options[k];
		self.pdb = new Biojs.getPDBdatabroker(self.apiURL);
		var successCallback = function() {
			self.entry = self.pdb.makeEntry(self.pdbid, apidata);
			self.entry.makeValidationPercentiles(apidata); 
			self.draw();
		};

    self.shortlabel = {
        "RNAsuiteness":"RNA backbone",
        "percent-RSRZ-outliers":"RSRZ outliers",
        "clashscore":"Clashescore",
        "percent-rota-outliers":"Sidechain outliers",
        "percent-rama-outliers":"Ramachandran outliers",
        "DCC_Rfree":"Rfree"
	};
    self.shortlabel = {
        "RNAsuiteness":"RNA",
        "percent-RSRZ-outliers":"RSRZ",
        "clashscore":"Clashes",
        "percent-rota-outliers":"Sidechain",
        "percent-rama-outliers":"Rama",
        "DCC_Rfree":"Rfree"
	};

		if(self.apidata) { apidata = self.apidata; successCallback(self.apidata) ; return; }
		var urlstr = '', apiURLs = [
			'/validation/global-percentiles/entry/' + self.pdbid,
			'/pdb/entry/summary/' + self.pdbid
		];
		for(var ai=0; ai < apiURLs.length; ai++) urlstr += apiURLs[ai] + ",";
		urlstr = urlstr.replace(/,$/, "");
		jQuery.ajax({
			url: self.apiURL + '/callgroup/' + urlstr,
			data: {'varname':'apidata'},
			dataType: 'script',
			crossDomain: 'true',
			type: 'GET',
			success: successCallback,
			error: function(jqXHR, textStatus, errorThrown) {
				alert("There was an unidentified error in obtaining data from PDBe API - please report to pdbehelp@ebi.ac.uk");
				document.getElementById(self.divid).innerHTML = "Error!";
			}
		});
	},
	draw: function() {
		var self = this;
		if(self.height)
			jQuery('#'+self.divid).css({height:self.height});
		if(self.width)
			jQuery('#'+self.divid).css({width:self.width});

		var pervaldata = self.entry.getValidationPercentiles();
		if(!pervaldata) {
			console.error("Percentile values not available from databroker for " + self.pdbid);
			document.getElementById(self.divid).innerHTML = "Error!";
			return;
		}
		var percols = [], abspers = [], relpers = [], xlabels = [];
		jQuery.each(pervaldata, function(metric, percentiles) {
			console.log(metric, percentiles.absolute, percentiles.relative);
			percols.push([0,100]);
			abspers.push(percentiles.absolute);
			relpers.push(percentiles.relative);
			xlabels.push(metric);
		});
		var pointwidth = self.height / (percols.length+2); // TODO
//		Highcharts.getOptions().colors = Highcharts.map(Highcharts.getOptions().colors, function(color) {
//			return {
//				radialGradient: { cx: 0.5, cy: 0.3, r: 0.7 },
//				stops: [
//					[0, color],
//					[1, Highcharts.Color(color).brighten(-0.3).get('rgb')] // darken
//				]
//			};
//		});

		var grads = [ [0 , '#ff0000'],[ 0.10 , '#ff5a5a'],[ 0.20 , '#ffa0a0'],[ 0.30 , '#ffd2d2'],[ 0.40 , '#ffe0e0'],[ 0.50 , '#eeeeee'],[ 0.60 , '#e0e0ff'],[ 0.70 , '#d2d2ff'],[ 0.80 , '#a0a0ff'],[ 0.90 , '#5a5aff'],[ 1.00 , '#0000ff'] ];
		var newgrads = [];
		for(var gi = grads.length-1; gi >= 0; gi--) newgrads.push( [1-grads[gi][0], grads[gi][1]] );

		jQuery('#'+self.divid).highcharts({
			credits: { enabled:false },
			chart: { inverted:true },
			title: { text:null },
			legend: { enabled:false },
			series: [
				{
					name: null,
					data:percols,
					type:'columnrange',
					color:{
						linearGradient: {x1:0,y1:0,x2:0,y2:1},
						stops:newgrads
					}
				},
				{
					name: null,
					data:abspers,
					dashStyle:'dash',
					type:'line'
				},
				{
					name: null,
					data:relpers,
					type:'line'
				}
			],
			xAxis: [ {
				categories: xlabels,
				tickLength: 0, minorTickLength: 0, lineColor: 'transparent', lineWidth:0, minorGridLineWidth: 0, gridLineColor: 'transparent',
				labels: {enabled:false}
			} ],
			yAxis: [ {
				tickLength: 0, minorTickLength: 0, lineColor: 'transparent', lineWidth:0, minorGridLineWidth: 0, gridLineColor: 'transparent',
				labels: {enabled:false},
				title: {enabled:false},
				min:-60, max:105
			} ],
			tooltip: {
				style:{display:'none'}
			},
			plotOptions: {
				scatter: { marker: {radius:10} },
				columnrange: {
					pointPadding: 0,
					pointWidth: pointwidth,
					dataLabels: {
						enabled: true,
						formatter: function () {
							if(this.y == 0) return self.shortlabel[this.key];
							//if(this.y == 0) return null;
							else return self.entry.getValidationPercentiles()[this.key]["rawvalue"];
							//console.log(this); return this.y + '°C' + Math.random();
						}
					}
				}
			}
		});
	}
} );
