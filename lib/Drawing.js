"use strict";

const ArgHandler = require("./ArgHandler");
const addressConverter = require("./addressConverter");
const JSZip = require('jszip');
const fs = require('fs');

class Drawing {
    constructor(nodeId, workbook, sheet, node, imageRelationshipNode, svgRelationshipNode) {
        this._nodeId = nodeId;
        this._workbook = workbook;
        this._sheet = sheet;
        this._node = node;
        this._imageRelationship = imageRelationshipNode;
        this._svgRelationship = svgRelationshipNode;
        this._init(node);
    }

    _init(node) {
        let to = node.children[1].children;
        let from = node.children[0].children;
        let pic = node.children[2].children[0].children[0];

        if (this._imageRelationship) {
            if (this._imageRelationship.attributes.Type.toString().includes('/image')) {
                this.returnImage = true;

                // Basic
                this._id = Drawing.findImageId(node);
                this._svgId = Drawing.findSvgId(node) || '';
                this._name = pic.attributes.name;
                this._description = pic.attributes.descr ? pic.attributes.descr : '';
                this._title = pic.attributes.title ? pic.attributes.title : '';
                this._path = this._imageRelationship.attributes.Target;
                this._svgPath = this._svgRelationship ? this._svgRelationship.attributes.Target : '';
                const file = this._workbook._zip.files[Drawing.zipPath(this._path)];
                const data = file && file._data;
                this.compressedSize = data ? data.compressedSize : undefined;
                this.uncompressedSize = data ? data.uncompressedSize : undefined;

                // Position
                this.fromCol = from[0].children[0];
                this.toCol = to[0].children[0];
                this.fromRow = from[2].children[0];
                this.toRow = to[2].children[0];

                // Offset
                this.fromColOff = from[1].children[0];
                this.toColOff = to[1].children[0];
                this.fromRowOff = from[3].children[0];
                this.toRowOff = to[3].children[0];
            } else {
                this.returnImage = true;
            }
        } else {
            this.returnImage = true;
        }

        // Clear the memory
        to = null;
        from = null;
        pic = null;
    }

    /**
     * Get Drawing ID
     * @returns {String} - Drawing ID
     * @ignore
     */
    id() {
        return new ArgHandler("Drawing.id")
            .case(() => {
                return this._id;
            })
            .handle(arguments);
    }

    /**
     * Set the Drawing Defined Name
     * @param newName - the new name
     * @returns {boolean} - true
     */
    /**
    * Get the Drawing Defined Name
    * @returns {String} - Drawings Name
    */
    name() {
        return new ArgHandler("Drawing.name")
            .case(() => {
                return this._name;
            })
            .case('string', newName => {
                this._name = newName;
                return true;
            })
            .handle(arguments);
    }

    /**
     * Replace the image with a new image
     * @param imagePath - Path to the new image.
     * @returns {Drawing} - drawing
     */
    /**
     * Replace the image with a new image
     * @param file - file blob of the new image.
     * @returns {Drawing} - drawing
     */
    /** 
    * Get the image Data from the zip
    * @returns {Object} - image data
    */
    image() {
        return new ArgHandler("Drawing.image")
            .case(() => {
                return this._workbook._zip.files[Drawing.zipPath(this._path)];
            })
            .case('string', imagePath => {
                const file = fs.readFileSync(imagePath, { encoding: 'binary' });
                this._workbook._zip.files[Drawing.zipPath(this._path)]._data = new JSZip().file('i', file).files.i._data;
                return this;              
            })
            .case('blob', file => {            
                this._workbook._zip.files[Drawing.zipPath(this._path)]._data = new JSZip().file('i', file.text()).files.i._data;
                return this;
            })
            .handle(arguments);
    }

    /**
     * Replace the SVG image with a new SVG image
     * @param imagePath - Path to the new SVG image.
     * @returns {Drawing} - drawing
     */
    /**
     * Replace the image with a new image
     * @param file - file blob of the new image.
     * @returns {Drawing} - drawing
     */
    /** 
    * Get the image Data from the zip
    * @returns {Object} - image data
    */
    svgImage() {
        return new ArgHandler("Drawing.svgImage")
            .case(() => {
                return this._workbook._zip.files[Drawing.zipPath(this._svgPath)];
            })
            .case('string', imagePath => {
                const file = fs.readFileSync(imagePath, { encoding: 'utf8' });
                this._workbook._zip.files[Drawing.zipPath(this._svgPath)]._data = new JSZip().file('i', file).files.i._data;
                return this;              
            })
            .case('blob', file => {            
                this._workbook._zip.files[Drawing.zipPath(this._svgPath)]._data = new JSZip().file('i', file.text()).files.i._data;
                return this;
            })
            .handle(arguments);
    }

    /**
     * Set the Description for the Drawing
     * @param description - the new description
     * @returns {Drawing} - drawing
     *//** 
    * Get the Description for the Drawing
    * @returns {String} - description
    */
    description() {
        return new ArgHandler("Drawing.description")
            .case(() => {
                return this._description;
            })
            .case('string', desc => {
                this._description = desc;
                return this;
            })
            .handle(arguments);
    }

    /**
     * Set the Title for the Drawing
     * @param newTitle - the new title for the Drawing
     * @returns {Drawing} - drawing
     *//** 
    * Get the Title for the Drawing
    * @returns {String} - title
    */
    title() {
        return new ArgHandler("Drawing.title")
            .case(() => {
                return this._title;
            })
            .case('string', newTitle => {
                this._title = newTitle;
                return this;
            })
            .handle(arguments);
    }

    /**
     * Set the Image Path
     * @param path - new Path inside the xlsx file
     * @returns {Drawing} - drawing
     *//** 
    * Get the Image Path
    * @returns {String} - path
    */
    path() {
        return new ArgHandler("Drawing.path")
            .case(() => {
                return this._path;
            })
            .case('string', path => {
                this._path = path;
                return this;
            })
            .handle(arguments);
    }

    /**
     * Set the Image SVG Path
     * @param svgPath - new SVG Path inside the xlsx file
     * @returns {Drawing} - drawing
     *//** 
    * Get the Image SVG Path
    * @returns {String} - SVG path
    */
    svgPath() {
        return new ArgHandler("Drawing.svgPath")
            .case(() => {
                return this._svgPath;
            })
            .case('string', svgPath => {
                this._svgPath = svgPath;
                return this;
            })
            .handle(arguments);
    }

    /**
     * get the From data from the Drawing
     */
    from() {
        return new ArgHandler("Drawing.from")
            .case(() => {
                return {
                    col: this.fromCol,
                    row: this.fromRow,
                    colOffset: this.fromColOff,
                    rowOffset: this.fromRowOff
                };
            })
            .case('string', address => {
                const ref = addressConverter.fromAddress(address);
                if (ref.type !== 'cell') throw new Error('Sheet.cell: Invalid address.');
                this.fromCol = ref.columnNumber - 1;
                this.fromRow = ref.rowNumber - 1;
                this.fromColOff = 0;
                this.fromRowOff = 0;
                return this;
            })
            .handle(arguments);
    }

    /**
     * Get the To Data from the Drawing
     */
    to() {
        return new ArgHandler("Drawing.to")
            .case(() => {
                return {
                    col: this.toCol,
                    row: this.toRow,
                    colOffset: this.toColOff,
                    rowOffset: this.toRowOff
                };
            })
            .case('string', address => {
                const ref = addressConverter.fromAddress(address);
                if (ref.type !== 'cell') throw new Error('Sheet.cell: Invalid address.');
                this.toCol = ref.columnNumber;
                this.toRow = ref.rowNumber;
                this.toColOff = 0;
                this.toRowOff = 0;
                return this;
            })
            .handle(arguments);
    }

    /**
     * Get the image file size
     */
    size() {
        return new ArgHandler("Drawing.size")
            .case(() => {
                return this.uncompressedSize;
            })
            .handle(arguments);
    }

    /**
    * overrides the original values in the XML, and then return the XML objects.
    * @returns {{}} The XML nodes.
    * @ignore
    */
    toXml() {
        if (this.returnImage) {
            this._imageRelationship.attributes.Id = this._id;
            this._imageRelationship.attributes.Target = this._path;

            if (this._svgRelationship) {
                this._svgRelationship.attributes.Id = this._svgId;
                this._svgRelationship.attributes.Target = this._svgPath;  
            }     

            this._node.children[1].children[0].children[0] = this.toCol;
            this._node.children[1].children[1].children[0] = this.toColOff;
            this._node.children[1].children[2].children[0] = this.toRow;
            this._node.children[1].children[3].children[0] = this.toRowOff;

            this._node.children[0].children[0].children[0] = this.fromCol;
            this._node.children[0].children[1].children[0] = this.fromColOff;
            this._node.children[0].children[2].children[0] = this.fromRow;
            this._node.children[0].children[3].children[0] = this.fromRowOff;

            // A picture that never had a description or title is not given an empty one.
            const picAttributes = this._node.children[2].children[0].children[0].attributes;
            picAttributes.name = this._name;
            if (this._description || picAttributes.hasOwnProperty('descr')) picAttributes.descr = this._description;
            if (this._title || picAttributes.hasOwnProperty('title')) picAttributes.title = this._title;
        }
        return [this._node, this._imageRelationship, this._svgRelationship];
    }

    /**
     * Find the first descendant element with the given local name (the name without its namespace prefix).
     * @param {{}} node - The node to search.
     * @param {string} localName - The local name.
     * @returns {{}|undefined} The element or undefined if not found.
     * @ignore
     */
    static findDescendant(node, localName) {
        if (!node || !node.children) return undefined;
        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            if (!child || typeof child !== 'object' || !child.name) continue;
            if (child.name === localName || child.name.split(':').pop() === localName) return child;
            const found = Drawing.findDescendant(child, localName);
            if (found) return found;
        }
        return undefined;
    }

    /**
     * Find the relationship ID of an anchor's picture.
     * @param {{}} anchorNode - The anchor node.
     * @returns {string|undefined} The relationship ID or undefined if the anchor holds no embedded picture.
     * @ignore
     */
    static findImageId(anchorNode) {
        const picNode = Drawing.findDescendant(anchorNode, 'pic');
        const blipNode = Drawing.findDescendant(picNode, 'blip');
        return blipNode && blipNode.attributes ? blipNode.attributes['r:embed'] : undefined;
    }

    /**
     * Find the relationship ID of the SVG copy Excel keeps beside a rendered picture.
     * @param {{}} anchorNode - The anchor node.
     * @returns {string|undefined} The relationship ID or undefined if the picture has no SVG copy.
     * @ignore
     */
    static findSvgId(anchorNode) {
        const picNode = Drawing.findDescendant(anchorNode, 'pic');
        const blipNode = Drawing.findDescendant(picNode, 'blip');
        const svgBlipNode = Drawing.findDescendant(blipNode, 'svgBlip');
        return svgBlipNode && svgBlipNode.attributes ? svgBlipNode.attributes['r:embed'] : undefined;
    }

    /**
     * Convert a relationship target to the path of the part in the zip.
     * @param {string} target - The target, relative to xl/drawings ("../media/image1.png") or absolute ("/xl/media/image1.png").
     * @returns {string} The zip path.
     * @ignore
     */
    static zipPath(target) {
        target = String(target);
        if (target[0] === '/') return target.substr(1);
        return target.replace('..', 'xl');
    }
}

module.exports = Drawing;
