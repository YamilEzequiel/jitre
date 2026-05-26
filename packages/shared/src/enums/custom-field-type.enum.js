"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomFieldScope = exports.CustomFieldType = void 0;
var CustomFieldType;
(function (CustomFieldType) {
    CustomFieldType["TEXT"] = "text";
    CustomFieldType["NUMBER"] = "number";
    CustomFieldType["SELECT"] = "select";
    CustomFieldType["MULTI_SELECT"] = "multi_select";
    CustomFieldType["DATE"] = "date";
    CustomFieldType["BOOLEAN"] = "boolean";
    CustomFieldType["USER"] = "user";
})(CustomFieldType || (exports.CustomFieldType = CustomFieldType = {}));
var CustomFieldScope;
(function (CustomFieldScope) {
    CustomFieldScope["WORKSPACE"] = "workspace";
    CustomFieldScope["PROJECT"] = "project";
})(CustomFieldScope || (exports.CustomFieldScope = CustomFieldScope = {}));
//# sourceMappingURL=custom-field-type.enum.js.map