"use strict";

const _ = require("lodash");


const NS = {
    CUSTPROPS: "http://schemas.openxmlformats.org/officeDocument/2006/custom-properties",
    VT: "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"
};

// Standard OLE fmtid for user-defined custom properties
const DEFAULT_FMTID = "{D5CDD505-2E9C-101B-9397-08002B2CF9AE}";

// Value types read as strings.
const STRING_TYPES = ["vt:lpwstr", "vt:lpstr", "vt:bstr"];

// Value types read as numbers.
const NUMBER_TYPES = [
    "vt:i1", "vt:i2", "vt:i4", "vt:i8", "vt:int",
    "vt:ui1", "vt:ui2", "vt:ui4", "vt:ui8", "vt:uint",
    "vt:r4", "vt:r8", "vt:decimal"
];

// Value types read as dates.
const DATE_TYPES = ["vt:filetime", "vt:date"];

const MAX_I4 = 2147483647;
const MIN_I4 = -2147483648;

/**
 * The custom document properties (docProps/custom.xml).
 *
 * The loaded property nodes are kept as they are. Only the node of a property that is set is changed, so
 * properties that are never touched are saved exactly as loaded: names, values, value types, pids, fmtids,
 * linkTargets and order.
 */
class CustomProperties {
    constructor(node) {
        // True if the workbook was loaded with a custom properties part.
        this._loaded = !!node;
        this._node = node || CustomProperties._createRoot();
        if (!this._node.children) this._node.children = [];
    }

    /**
     * Sets a specific property. The value type written matches the value given: a string is written as
     * vt:lpwstr, a boolean as vt:bool, an integer as vt:i4 (vt:r8 if it does not fit), any other number as
     * vt:r8 and a Date as vt:filetime. An existing property keeps its place, pid and other attributes.
     * Setting null or undefined deletes the property.
     * @param {string} name - The name of the property.
     * @param {string|number|boolean|Date|null|undefined} value - The value of the property.
     * @returns {CustomProperties} CustomProperties.
     */
    set(name, value) {
        if (_.isNil(value)) return this.delete(name);

        const valueNode = CustomProperties._createValueNode(name, value);
        const propertyNode = this._find(name);
        if (propertyNode) {
            propertyNode.children = [valueNode];
        } else {
            this._node.children.push({
                name: "property",
                attributes: {
                    fmtid: DEFAULT_FMTID,
                    pid: this._nextPid(),
                    name
                },
                children: [valueNode]
            });
        }

        return this;
    }

    /**
     * Get a specific property. The value is typed by the property's value type: a string, number, boolean
     * or Date. The text of a value type that is not known is returned as a string.
     * @param {string} name - The name of the property.
     * @returns {string|number|boolean|Date|undefined} The property value or undefined if there is no such property.
     */
    get(name) {
        const propertyNode = this._find(name);
        if (!propertyNode) return undefined;

        const valueNode = _.find(propertyNode.children, child => _.isObject(child));
        if (!valueNode) return undefined;

        const text = _.filter(valueNode.children, child => !_.isObject(child)).join("");
        const type = valueNode.name;

        if (_.includes(STRING_TYPES, type)) return text;
        if (_.includes(NUMBER_TYPES, type)) return text === "" ? undefined : Number(text);
        if (type === "vt:bool") return text === "true" || text === "1";
        if (_.includes(DATE_TYPES, type)) return text === "" ? undefined : new Date(text);
        if (type === "vt:empty" || type === "vt:null") return undefined;
        return text;
    }

    /**
     * Gets the names of all the properties, in document order.
     * @returns {Array.<string>} The names.
     */
    names() {
        return _.map(this._propertyNodes(), propertyNode => String(propertyNode.attributes.name));
    }

    /**
     * Deletes a specific property.
     * @param {string} name - The name of the property.
     * @returns {CustomProperties} CustomProperties.
     */
    delete(name) {
        const propertyNode = this._find(name);
        if (propertyNode) _.pull(this._node.children, propertyNode);
        return this;
    }

    /**
     * Clears all the existing properties
     * @returns {CustomProperties} CustomProperties.
     */
    clear() {
        this._node.children = [];
        return this;
    }

    /**
     * Whether there is anything to save: the workbook was loaded with a custom properties part or a
     * property has been set.
     * @returns {boolean} True if the part should be written.
     * @ignore
     */
    shouldSave() {
        return this._loaded || this._node.children.length > 0;
    }

    /**
     * Convert the collection to an XML object.
     * @returns {{}} The XML.
     */
    toXml() {
        return this._node;
    }

    _propertyNodes() {
        return _.filter(this._node.children, child => _.isObject(child) && child.attributes && !_.isNil(child.attributes.name));
    }

    _find(name) {
        // The parser turns a name that looks like a number into a number, so compare as strings.
        return _.find(this._propertyNodes(), propertyNode => String(propertyNode.attributes.name) === String(name));
    }

    _nextPid() {
        // pid 0 and 1 are reserved, so the first property is 2.
        let max = 1;
        this._propertyNodes().forEach(propertyNode => {
            const pid = Number(propertyNode.attributes.pid);
            if (pid > max) max = pid;
        });

        return max + 1;
    }

    static _createValueNode(name, value) {
        let type, text;
        if (typeof value === "string") {
            type = "vt:lpwstr";
            text = value;
        } else if (typeof value === "boolean") {
            type = "vt:bool";
            text = value ? "true" : "false";
        } else if (typeof value === "number" && isFinite(value)) {
            type = _.isInteger(value) && value >= MIN_I4 && value <= MAX_I4 ? "vt:i4" : "vt:r8";
            text = value;
        } else if (value instanceof Date && !isNaN(value.getTime())) {
            type = "vt:filetime";
            text = value.toISOString().replace(/\.\d{3}Z$/, "Z");
        } else {
            throw new Error(`CustomProperties.set: Unsupported value for property "${name}". Expected a string, finite number, boolean or valid Date.`);
        }

        return { name: type, attributes: {}, children: text === "" ? [] : [text] };
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
