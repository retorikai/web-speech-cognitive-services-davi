export default function subscribeEvent(target: any, name: string, handler: Function): Function {
  target.addEventListener(name, handler);

  return () => target.removeEventListener(name, handler);
}
