export default function resolveFunctionOrReturnValue(fnOrValue: any): any {
  return typeof fnOrValue === 'function' ? fnOrValue() : fnOrValue;
}
