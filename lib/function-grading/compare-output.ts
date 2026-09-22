export function serializeExpectedOutput(returnType: string, value: any): string {
  if (value === null || value === undefined) return 'null';
  if (returnType === 'boolean') {
    return String(Boolean(value));
  }
  if (returnType === 'int') {
    return String(Math.floor(Number(value)));
  }
  if (returnType === 'double') {
    const num = Number(value);
    if (Number.isInteger(num)) return `${num}.0`;
    return String(num);
  }
  if (returnType === 'String') {
    return `"${value}"`;
  }
  if (returnType === 'int[]' || returnType === 'String[]') {
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

export function compareFunctionOutput(
  returnType: string,
  actualOutput: string,
  expectedOutput: any
): boolean {
  const actualTrimmed = (actualOutput || '').trim();
  const expectedSerialized = serializeExpectedOutput(returnType, expectedOutput).trim();

  if (returnType === 'double') {
    if (actualTrimmed === expectedSerialized) return true;
    const actualNum = parseFloat(actualTrimmed);
    const expectedNum = parseFloat(expectedSerialized);
    return !isNaN(actualNum) && !isNaN(expectedNum) && Math.abs(actualNum - expectedNum) < 1e-6;
  }

  return actualTrimmed === expectedSerialized;
}
