export const CountlyNumberLimit = 16;

export function isCountlyNumber(value: number) {
  const valueStr = value.toString();
  return !isNaN(value) && valueStr.length <= CountlyNumberLimit;
}

/**
 * Countly has it's own definition of number, so we have to pre-process any number we send to countly,
 * otherwise it may be considered as a string
 *
 * Note: Converted numbers may lose some precision in decimals
 * @link https://github.com/Countly/countly-server/blob/f0ff1904249e94e10d4c544fcfcf0253f150df6c/api/utils/common.js#L431
 * @param value a finite number, number with length greater than 16 is not recommended as it's not officially supported by Countly (although it works)
 * @returns Countly compatible number string
 * @throws if it's not a number or if it's not finite
 * @example
 * toCountlyNumber(123) // '123'
 * toCountlyNumber(-123) // '-123'
 * toCountlyNumber(123.456) // '123.456'
 * toCountlyNumber(1234567890123456.123) // '1234567890123456'
 * toCountlyNumber(-1234567890123456.123) // '-1.2345678901e15'
 * toCountlyNumber(0.1234567890123456) // '0.12345678901234'
 * toCountlyNumber(12345678901234567) // '1.2345678901e+16'
 * toCountlyNumber(-12345678901234567) // '-1.23456789e+16'
 * toCountlyNumber(1e100) // '1e+100'
 * toCountlyNumber(1e100000) // throws Error
 */
export function toCountlyNumberString(value: number): string {
  if (isNaN(value) || !isFinite(value)) {
    throw new Error('toCountlyNumber: The value must be a valid and finite number.');
  }
  let valueStr = value.toString();

  if (isCountlyNumber(value)) return valueStr;

  // find the position of the decimal point
  let decimalIndex = valueStr.indexOf('.');

  // if there's no decimal point, the whole number is the integer part
  if (decimalIndex === -1) {
    decimalIndex = valueStr.length;
  }
  // if it's a scientific number, the integer part need to be re-calculated
  else if (valueStr.includes('e+')) {
    const exponent = parseInt(valueStr.split('e+')[1], 10);
    decimalIndex = exponent + 1;
  }

  // check if the integer part itself is longer than 16 characters
  if (decimalIndex > CountlyNumberLimit) {
    // e.g. '-1.23456789e+15'
    const maxFractionDigits =
      CountlyNumberLimit -
      (decimalIndex - 1).toString().length - // substract exponent part, '15'
      4 - // substract first digit, the dot, and 'e+'
      (value < 0 ? 1 : 0); // substract - sign if negative value
    valueStr = value.toExponential(maxFractionDigits);
  }
  // if the total length exceeds 16 characters, trim the decimal part only
  else if (valueStr.length > CountlyNumberLimit) {
    // calculate the maximum number of decimal places that can fit
    const maxDecimals = CountlyNumberLimit - decimalIndex - 1;

    // use toFixed to trim the decimal part accordingly
    valueStr = value.toFixed(maxDecimals);
  }

  return valueStr;
}
