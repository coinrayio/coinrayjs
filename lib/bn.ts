import BigNumber from "bignumber.js";

// bignumber.js 10 made the constructor throw on input it cannot parse
// (undefined, null, "", "abc", ...). Version 9 returned a NaN BigNumber
// instead, and consumers rely on that leniency.
//
// bn() restores the old behaviour. For every input BigNumber accepts it is
// the constructor, arguments forwarded untouched; for the rest it yields NaN
// rather than throwing.
export const bn = (...args: any[]): BigNumber => {
  try {
    // @ts-ignore - forwarding whichever overload the caller used
    return new BigNumber(...args);
  } catch {
    return new BigNumber(NaN);
  }
};

export default bn;
