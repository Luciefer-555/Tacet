import { JAVA_TYPE_MAP } from './type-map-java';

export function buildJavaHarness(params: {
  functionName: string;
  parameters: { name: string; type: string }[];
  returnType: string;
  studentCode: string; // raw student submission defining `class Solution { ... }` or `public class Solution { ... }`
  testCaseInputsJson: string; // JSON string of ONE test case's `inputs` object
}): string {
  const { functionName, parameters, returnType, studentCode, testCaseInputsJson } = params;

  // Strip public keyword from student's class Solution so only public class Main exists
  const sanitizedStudentCode = studentCode.replace(/\bpublic\s+class\s+Solution\b/g, 'class Solution');

  const argDeserializations = parameters
    .map((p, i) => {
      const mapping = JAVA_TYPE_MAP[p.type];
      if (!mapping) throw new Error(`Unsupported Java type: ${p.type}`);
      return `        Object raw${i} = parsed.get("${p.name}");\n        ${mapping.javaType} arg${i} = ${mapping.deserializeExpr(`raw${i}`)};`;
    })
    .join('\n');

  const argNames = parameters.map((_, i) => `arg${i}`).join(', ');
  const returnMapping = JAVA_TYPE_MAP[returnType];
  if (!returnMapping) throw new Error(`Unsupported Java return type: ${returnType}`);

  return `
import java.util.*;

${sanitizedStudentCode}

public class Main {
    // --- Minimal hand-rolled JSON parser for flat objects/arrays of numbers, strings, booleans ---
    // (Judge0 sandboxed compile step has no network access to fetch external libraries like Gson)
    static Map<String, Object> parseFlatJsonObject(String json) {
        Map<String, Object> result = new HashMap<>();
        json = json.trim();
        if (json.startsWith("{") && json.endsWith("}")) {
            json = json.substring(1, json.length() - 1).trim();
        }
        if (json.isEmpty()) return result;
        int depth = 0, start = 0;
        List<String> pairs = new ArrayList<>();
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '[' || c == '{') depth++;
            if (c == ']' || c == '}') depth--;
            if (c == ',' && depth == 0) { pairs.add(json.substring(start, i)); start = i + 1; }
        }
        pairs.add(json.substring(start));
        for (String pair : pairs) {
            int colonIdx = pair.indexOf(':');
            if (colonIdx == -1) continue;
            String key = pair.substring(0, colonIdx).trim();
            if (key.length() >= 2 && key.charAt(0) == '"' && key.charAt(key.length() - 1) == '"') {
                key = key.substring(1, key.length() - 1);
            }
            String valStr = pair.substring(colonIdx + 1).trim();
            result.put(key, parseValue(valStr));
        }
        return result;
    }

    static Object parseValue(String v) {
        v = v.trim();
        if (v.startsWith("[")) {
            String inner = v.substring(1, v.length() - 1).trim();
            if (inner.isEmpty()) return new ArrayList<Object>();
            List<Object> list = new ArrayList<>();
            for (String item : inner.split(",")) list.add(parseValue(item.trim()));
            return list;
        }
        if (v.length() >= 2 && v.charAt(0) == '"' && v.charAt(v.length() - 1) == '"') {
            return v.substring(1, v.length() - 1);
        }
        if (v.equals("true")) return true;
        if (v.equals("false")) return false;
        if (v.contains(".")) return Double.parseDouble(v);
        return Long.parseLong(v);
    }

    static int[] toIntArray(Object listObj) {
        if (listObj == null) return new int[0];
        List<?> list = (List<?>) listObj;
        int[] arr = new int[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = ((Number) list.get(i)).intValue();
        return arr;
    }

    static String[] toStringArray(Object listObj) {
        if (listObj == null) return new String[0];
        List<?> list = (List<?>) listObj;
        String[] arr = new String[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = (String) list.get(i);
        return arr;
    }

    static String arrayToJson(int[] arr) {
        if (arr == null) return "null";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) { sb.append(arr[i]); if (i < arr.length - 1) sb.append(","); }
        return sb.append("]").toString();
    }

    static String arrayToJsonStr(String[] arr) {
        if (arr == null) return "null";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) { sb.append('"').append(arr[i]).append('"'); if (i < arr.length - 1) sb.append(","); }
        return sb.append("]").toString();
    }

    public static void main(String[] args) {
        try {
            String rawJson = ${JSON.stringify(testCaseInputsJson)};
            Map<String, Object> parsed = parseFlatJsonObject(rawJson);

${argDeserializations}

            Solution sol = new Solution();
            ${returnMapping.javaType} result = sol.${functionName}(${argNames});
            System.out.println(${returnMapping.serializeExpr('result')});
        } catch (Exception e) {
            System.out.println("HARNESS_ERROR: " + e.toString());
            System.exit(1);
        }
    }
}
`.trim();
}
