import { loadLanguages } from "../../eleventy.config.js";
import site from "./site.js";

// One no-JS error page per language and error code.
export default function () {
  return loadLanguages().flatMap((lang) => site.errorCodes.map((code) => ({ lang, code })));
}
