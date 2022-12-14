export function mergeArrays(array1: any[], array2: any[]): any[] {
  array1.forEach((element: any) => {
    if (!array2.includes(element)) {
      array2.push(element);
    }
  });

  return array2;
};

export function subtractArray(filterArray: any[], removeArray: any[]): any[] {
  if (filterArray === undefined) {
    return [];
  }
  return filterArray.filter((element: any) => !removeArray.includes(element));
}

export function copyObjectOfArrays(object: any): Object {
  let copy: any = {};

  for (let key in object) {
    copy[key] = object[key].slice();
  }

  return copy;
}