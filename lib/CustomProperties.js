"use strict";

const ContentTypes = require("./ContentTypes");
const Relationships = require("./Relationships");


const NS = {
    CUSTPROPS: "http://schemas.openxmlformats.org/officeDocument/2006/custom-properties",
    VT: "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"
};

// Standard OLE fmtid for user-defined custom properties
const DEFAULT_FMTID = "{D5CDD505-2E9C-101B-9397-08002B2CF9AE}";

class CustomProperties {
    constructor(node) {
        this._node = node || CustomProperties._createRoot();
        this._properties = {};
        this._init();
    }

    _init() {
        this._node.children.forEach(child => {
            const name = child.attributes.name;
            const value = child.children[0].text;
            this._properties[name] = value;
        });
    }

    /**
     * Sets a specific property.
     * @param {string} name - The name of the property.
     * @param {*} value - The value of the property.
     * @returns {CustomProperties} CustomProperties.
     */
    set(name, value) {
        this._properties[name] = value;
        return this;
    }

    /**
     * Get a specific property.
     * @param {string} name - The name of the property.
     * @returns {*} The property value.
     */
    get(name) {
        return this._properties[name];
    }

    /**
     * Get a specific property.
     * @param {string} name - The name of the property.
     * @returns {undefined} 
     */
    delete(name) {
        delete this._properties[name];
    }

    /**
     * Clears all the existing properties
     * @returns {CustomProperties} CustomProperties.
     */
    clear() {
        this._properties = [];
        return this;
    }

    /**
     * Convert the collection to an XML object.
     * @returns {{}} The XML.
     */
    toXml() {
        this._node.children = [];

        let pid = 2;

        for (const key in this._properties) {
            if (!this._properties.hasOwnProperty(key)) continue;
            
            this._node.children.push({
                name: "property",
                attributes: {
                    fmtid: DEFAULT_FMTID,
                    pid,
                    name: key
                },
                children: [{
                    name: "vt:lpwstr",
                    children: this._properties[key]
                }]
            });

            pid++;
        }        

        return this._node;
    }

    static _createRoot() {
        return {
            name: "Properties",
            attributes: {
                xmlns: NS.CUSTPROPS,
                "xmlns:vt": NS.VT
            },
            children: []
        };
    }


}

module.exports = CustomProperties;

/*
 docProps/custom.xml
 
 * <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 * <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
 *             xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
 *   <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="key">
 *     <vt:lpwstr>string value</vt:lpwstr>
 *   </property>
 * </Properties>
 */
