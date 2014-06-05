/**
 * BioJS component to display Rhea reactions.
 * @class
 * @extends Biojs
 *
 * @author <a href="mailto:rafael.alcantara@ebi.ac.uk">Rafael Alcántara</a>
 * @version 1.1.0
 * @category 3
 *
 * @requires <a href=''>Server side proxy</a>
 *
 * @requires <a href='http://blog.jquery.com/2011/09/12/jquery-1-6-4-released/'>jQuery Core 1.6.4</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/jquery/jquery-1.6.4.js"></script>
 *
 * @requires <a href='../biojs/css/Rheaction.css'>Rheaction.css</a>
 * @dependency <link href="../biojs/css/biojs.Rheaction.css" rel="stylesheet" type="text/css" />
 *
 * @param {Object} options An object with the options for the component.
 *
 * @option {string} target
 *  The ID of the DIV tag where the component should be displayed.
 *
 * @option {string} id
 *  The Rhea ID, with or without 'RHEA:' prefix.
 *
 * @option {string} [dimensions='200']
 *  The dimensions of compound structure images (side of the square) in pixels.
 *
 * @option {string} [proxyUrl='../biojs/dependencies/proxy/proxy.php']
 *  This component needs to request data from a web service. To bypass the same origin policy
 *  (http://en.wikipedia.org/wiki/Same_origin_policy) this component needs a proxy.
 *  You could use your own proxy by modifying this value or one of the BioJS proxies:
 *  '../biojs/dependencies/proxy/proxy.php' or '../biojs/dependencies/proxy/proxy.jsp'
 *
 *  @option {boolean} [showCompoundAccession=false]
 *  Show the Rhea accession of every compound? This only applies to
 *  macromolecules ('GENERIC:' prefix) and polymers ('POLYMER:' prefix).
 *
 *  @option {boolean} [showChebiId=false]
 *  Show the ID of every ChEBI compound?
 *
 *  @option {boolean} [showFormulaAndCharge=false]
 *  Show the formula and charge of every compound?
 *
 * @example
 * var instance = new Biojs.Rheaction({
 *  target: 'YourOwnDivId',
 *  id: '21881'
 * });
 */
Biojs.Rheaction = Biojs.extend (
/** @lends Biojs.Rheaction# */
{
    constructor: function (options){
        //Biojs.console.enable();
        this.setId(this.opt.id);
    },
    /**
     * Sets and displays data for a new identifier.
     * @param {string} id The identifier.
     *
     * @example
     * instance.setId("RHEA:10280");
     *
     * @example
     * instance.setId("10735");
     *
     * @example
     * instance.setId("RHEA:18476");
     *
     * @example
     * instance.setId("XXXXX");
     *
     * @example
     * instance.setId("18189");
     *
     * @example
     * instance.setId("17521");
     *
     */
    setId: function(id){
        this._clearContent();
        var self = this;
        var rheaId = id.replace('RHEA:', '');
        this._rheaIdLabel = 'RHEA_' + rheaId;
        if ( "string" == (typeof this.opt.target) ) {
            this._container = jQuery( "#" + this.opt.target );
        } else {
            this.opt.target = "biojs_Rheaction_" + rheaId;
            this._container = jQuery('<div id="'+ this.opt.target +'"></div>');
        }
        this._container.addClass('scrollpane');
        this._reactionRow = jQuery('<div/>',{"class":'reactionRow'});
        this._container.append(this._reactionRow);
        this._getCml(rheaId);
    },

    /**
     * Default values for the options.
     * @name Biojs.Rheaction-opt
     */
    opt: {
        target: undefined,
        id: undefined,
        dimensions: '200',
        proxyUrl: '../biojs/dependencies/proxy/proxy.php',
        rheaWsUrl: 'http://wwwdev.ebi.ac.uk/rhea/rest/1.0/ws/reaction/cmlreact/', // XXX
        chebiUrl: 'http://www.ebi.ac.uk/chebi/searchId.do?chebiId=',
        compoundImgUrl: 'http://wwwdev.ebi.ac.uk/rhea/compoundImage.xhtml?', // XXX
        showCompoundAccession: false,
        showChebiId: false,
        showFormulaAndCharge: false
    },

    _clearContent: function(){
        jQuery("#" + this.opt.target).html("");
    },

    _displayNoDataMessage: function(){
        jQuery('#'+this.opt.target+'').html(Biojs.Rheaction.MESSAGE_NODATA);
    },

    /**
     * Toggles the accession numbers of polymers and generics.
     * @example instance.toggleAccession();
     */
    toggleAccession: function(){
        jQuery('.accession').toggle();
    },

    /**
     * Toggles the ChEBI IDs of compounds.
     * @example instance.toggleChebiId();
     */
    toggleChebiId: function(){
        jQuery('.chebiId').toggle();
    },

    /**
     * Toggles the formula and charge of compounds on/off.
     * @example instance.toggleFormulaAndCharge();
     */
    toggleFormulaAndCharge: function(){
        jQuery('.formula').toggle();
        jQuery('.charge').toggle();
    },

    _getCml: function(rheaId){
        var self = this;
        var reactionUrl = this.opt.rheaWsUrl + rheaId;
        var httpRequest = {
            url: reactionUrl,
            method: 'GET',
            /** @ignore No need to document this object */
            success: function(xml){
                self._dataReceived(xml);
            },
            error: function(qXHR, textStatus, errorThrown){
                Biojs.console.log("ERROR requesting reaction. Response: "
                        + textStatus);
                self._displayNoDataMessage();
            }
        };

        // Using proxy?
           // Redirect using the proxy and encode all params as url data
           if ( this.opt.proxyUrl != undefined ) {
                // Redirect to proxy url
                httpRequest.url = this.opt.proxyUrl;
                // Encode both url and parameters under the param url
                httpRequest.data = [{ name: "url", value: reactionUrl }];
                // Data type
                httpRequest.dataType = "text";
           }

        jQuery.ajax(httpRequest);
    },

    _dataReceived: function(xml){
        var self = this;
        var data = {};
        var xmlDoc = "";
        if (xml.length > 0){
            try {
                xmlDoc = jQuery.parseXML(xml);
                xmlResult = jQuery(xmlDoc).find('reaction');
                var reactants = xmlResult.find('reactant');
                for (var i = 0; i < reactants.length; i++){
                    if (i > 0) self._addPlus();
                    self._addParticipant(reactants[i]);
                }
                self._addDirection(xmlResult.attr('convention'));
                var products = xmlResult.find('product');
                for (var i = 0; i < products.length; i++){
                    if (i > 0) self._addPlus();
                    self._addParticipant(products[i]);
                }
            } catch (e) {
                Biojs.console.log("ERROR decoding ");
                Biojs.console.log(e);
                self._displayNoDataMessage();
            }
        }
    },


    _addPlus: function(){
        jQuery('<div/>', { "class": 'direction', html: '+' })
                .appendTo(this._reactionRow);
    },

    _addDirection: function(convention){
        var direction = convention.replace('rhea:direction.', '');
        var dirLabel = undefined;
        switch (direction){
        case 'UN':
            dirLabel = '&lt;?&gt;';
            break;
        case 'BI':
            dirLabel = '&lt;=&gt;';
            break;
        default:
            dirLabel = '=&gt;';
            break;
        }
        jQuery('<div/>', { "class": 'direction', html: dirLabel })
                .appendTo(this._reactionRow);
    },

    /**
     * Builds an HTML element for the compound name and stoichiometric
     * coefficient.
     * @param coef The stoichiometric coefficient.
     * @param name The compound name.
     * @param accession the compound accession, including the prefix.
     * @param chebiId If any, it generates a link to ChEBI.
     */
    _getCoefNameElement: function(coef, name, accession, chebiId){
        var coefNameElem = jQuery('<div/>', { "class": 'coefName' });
        if (coef > 1){
            coefNameElem.append(jQuery('<span/>', {
                "class": 'stoichCoef',
                html: coef
            }));
        }
        var nameElem;
        if (chebiId){
            nameElem = jQuery('<a/>', {
                href: this.opt.chebiUrl + chebiId,
                html: name
            });
        } else {
            nameElem = jQuery('<span/>', {
                "class": 'compoundName',
                html: name,
                title: accession
            });
        }
        coefNameElem.append(nameElem);
        return coefNameElem;
    },

    /**
     * Builds an HTML element for the compound accession.
     * @param accession The compound accession (prefix included).
     * @param chebiId The ChEBI ID, if any, without 'CHEBI:' prefix.
     *         Generates a link to ChEBI.
     * @return the HTML element.
     */
    _getCompoundAccessionElement: function(accession, chebiId){
        var compoundAccElem;
        if (chebiId){
            compoundAccElem = jQuery('<div/>', {
                "class": 'chebiId',
                css: { display: this.opt.showChebiId? 'inline' : 'none' }
            }).append(jQuery('<a/>', {
                href: this.opt.chebiUrl + chebiId,
                html: accession
            }));
        } else {
            compoundAccElem = jQuery('<div/>', {
                "class": 'accession',
                html: accession,
                css: { display: this.opt.showCompoundAccession?
                        'inline' : 'none'
                }
            });
        }
        return compoundAccElem;
    },

    /**
     * Builds an HTML image element for a compound.
     * @param chebiId the ChEBI ID of the compound to show, <b>with</b> the
     *         'CHEBI:' prefix. Only one of <code>chebiId</code> or
     *         <code>polymerId</code> should be provided, the latter having
     *         priority.
     * @param polymerId the ID (internal to Rhea) of the polymer to show,
     *         without the 'POLYMER:' prefix.
     * @param accession the compound accession, including the prefix.
     * @return the image element.
     */
    _getCompoundImage: function(chebiId, polymerId, accession){
        var imgUrl = this.opt.compoundImgUrl
            + 'dimensions=' + this.opt.dimensions;
        if (polymerId){
            imgUrl += '&polymerId=' + polymerId;
        } else if (chebiId){
            imgUrl += '&chebiId=' + chebiId;
        };
        return jQuery('<img/>', {
                src: imgUrl,
                "class": 'compoundStructure',
                title: accession,
                css: { minWidth: this.opt.dimensions + 'px' }
        });
    },

    _getFormulaElement: function(formula){
        return jQuery('<div/>', {
            "class": 'formula',
            html: "<i>Formula:</i> "
                + (formula? formula.replace(/ 1 | 1$| (?!1 )/g,'') : 'N/A'),
            css: { display: this.opt.showFormulaAndCharge? 'inline' : 'none' }
        });
    },

    _getChargeElement: function(charge){
        return jQuery('<div/>', {
            "class": 'charge',
            html: '<i>Charge:</i> ' + (charge? charge : 'N/A'),
            css: { display: this.opt.showFormulaAndCharge? 'inline' : 'none' }
        });
    },

    _getPositionElement: function(position){
        return jQuery('<div/>', {
            "class": 'position',
            html: '<i>Position:</i> ' + (position? position : 'N/A')
        });
    },

    /**
     * Builds an HTML element for a macromolecule residue.
     * @param residue the molecule element representing the residue.
     * @return the HTML element for the residue.
     */
    _getResidueElement: function(residue){
        var resFormula = residue.attr('formula');
        var resCharge = residue.attr('formalCharge');
        var resName = residue.find('name').contents()[0].data;
        var resId = residue.find('identifier').attr('value');
        var resChebiId = resId.replace('CHEBI:', '');
        var resPos = residue.find('label[objectClass="location"]')
                .attr('value');
        var resElem = jQuery('<div/>', {
            "class": 'residue'
        }).append(
            this._getCompoundImage(resId, null, resId),
            this._getCoefNameElement(1, resName, resId, resChebiId),
            this._getCompoundAccessionElement(resId, resChebiId),
            this._getFormulaElement(resFormula),
            this._getChargeElement(resCharge),
            this._getPositionElement(resPos)
        );
        return resElem;
    },

    _addParticipant: function(participant){
        var self = this;
        var coef = parseInt(participant.attributes['count'].value);
        var molecule = jQuery(participant).find('molecule');
        var formula = molecule.attr('formula');
        var charge = molecule.attr('formalCharge');
        var compoundName = molecule.find('name').contents()[0].data;
        var moleculeId = molecule.find('identifier').attr('value');
        var chebiId = undefined;
        var polymerId = undefined;
        if (moleculeId.lastIndexOf('CHEBI:', 0) === 0){
            chebiId = moleculeId.replace('CHEBI:', '');
        } else if (moleculeId.lastIndexOf('POLYMER:', 0) === 0){
            polymerId = moleculeId.replace('POLYMER:', '');
        }

        var compDiv = jQuery('<div/>', { "class": 'compound' });
        this._reactionRow.append(compDiv);

        compDiv.append(
            this._getCoefNameElement(coef, compoundName, moleculeId,
                    chebiId),
            this._getCompoundAccessionElement(moleculeId, chebiId),
            this._getFormulaElement(formula),
            this._getChargeElement(charge)
        );
        if (chebiId){
            compDiv.append(
                this._getCompoundImage(moleculeId, null, moleculeId));
        } else if (polymerId){
            var chebiPolId = molecule.find('molecule').find('identifier')
                    .attr('value');
            compDiv.append(
                this._getCompoundAccessionElement(chebiPolId, chebiPolId),
                this._getCompoundImage(null, polymerId, moleculeId)
            );
        } else { // GENERIC
            var resRow = jQuery('<div>', { "class": 'residues' });
            compDiv.append(resRow);
            molecule.find('molecule').each(function(index, res){
                resRow.append(self._getResidueElement(jQuery(res)));
            });
        }
    }
},{
    MESSAGE_NODATA: "Sorry, no results for your request",
});

