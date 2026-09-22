import { JAVA_TYPE_MAP } from './type-map-java';

export function buildJavaBoilerplate(params: {
  functionName: string;
  parameters: { name: string; type: string }[];
  returnType: string;
}): string {
  const returnTypeMapping = JAVA_TYPE_MAP[params.returnType];
  if (!returnTypeMapping) throw new Error(`Unsupported return type: ${params.returnType}`);

  const paramList = params.parameters
    .map((p) => {
      const pMapping = JAVA_TYPE_MAP[p.type];
      if (!pMapping) throw new Error(`Unsupported parameter type: ${p.type}`);
      return `${pMapping.javaType} ${p.name}`;
    })
    .join(', ');

  return `class Solution {
    public ${returnTypeMapping.javaType} ${params.functionName}(${paramList}) {
        // your code here
    }
}`;
}
