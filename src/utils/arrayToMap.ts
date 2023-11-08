export default function (array, extras) {
  const map = {
    // @ts-ignore
    ...[].reduce.call(
      array,
      (map, value, index) => {
        // @ts-ignore
        map[index] = value;

        return map;
      },
      {}
    ),
    ...extras,
    length: array.length,
    [Symbol.iterator]: () => [].slice.call(map)[Symbol.iterator]()
  };

  return map;
}
