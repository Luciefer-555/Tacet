export const JAVA_TYPE_MAP: Record<string, { 
  javaType: string; 
  deserializeExpr: (jsonVar: string) => string;  // how to convert a parsed JSON value into this Java type
  serializeExpr: (javaVar: string) => string;    // how to convert this Java type back to a JSON-printable string
}> = {
  'int': {
    javaType: 'int',
    deserializeExpr: (v) => `((Number) ${v}).intValue()`,
    serializeExpr: (v) => `String.valueOf(${v})`,
  },
  'int[]': {
    javaType: 'int[]',
    deserializeExpr: (v) => `toIntArray(${v})`,  // helper method, defined in harness template below
    serializeExpr: (v) => `arrayToJson(${v})`,
  },
  'boolean': {
    javaType: 'boolean',
    deserializeExpr: (v) => `(Boolean) ${v}`,
    serializeExpr: (v) => `String.valueOf(${v})`,
  },
  'String': {
    javaType: 'String',
    deserializeExpr: (v) => `(String) ${v}`,
    serializeExpr: (v) => `"\\"" + ${v} + "\\""`,
  },
  'double': {
    javaType: 'double',
    deserializeExpr: (v) => `((Number) ${v}).doubleValue()`,
    serializeExpr: (v) => `String.valueOf(${v})`,
  },
  'String[]': {
    javaType: 'String[]',
    deserializeExpr: (v) => `toStringArray(${v})`,
    serializeExpr: (v) => `arrayToJsonStr(${v})`,
  },
};
