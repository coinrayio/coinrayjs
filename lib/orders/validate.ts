import validate from "validate.js";

validate.validators.bigNumericality = (value: any, options: any, _: string, attributes: object) => {
  return validate.validators.numericality(value ? value.toNumber() : value, options, attributes)
};

export default validate
