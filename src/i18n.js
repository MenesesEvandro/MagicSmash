import { $ } from "./dom.js";
import { data } from "./state.js";

/**
 * All available languages keyed by code (e.g. "pt-br"), each with `code`,
 * `name`, and `translations`. Empty until {@link loadLanguages} runs.
 */
export let languages = {};

/**
 * Populates {@link languages} from the registry embedded at build time:
 * scripts/build.mjs replaces the placeholder below with the combined
 * contents of src/languages/*.json. Nothing outside this function depends
 * on how that value gets here.
 */
export function loadLanguages() {
	languages = __LANGUAGE_REGISTRY__;
}

/**
 * @returns {object | undefined} The language selected in `data.language`,
 * falling back to English, then to any loaded language; undefined only
 * when none are loaded.
 */
export function activeLanguage() {
	return (
		languages[data.language] || languages.en || Object.values(languages)[0]
	);
}

/**
 * Looks up a translation in the active language.
 * @param {string} key Translation key.
 * @returns {string | string[]} The translated value (the `encouragement`
 * key holds an array of phrases), or the key itself when missing.
 */
export function t(key) {
	return activeLanguage()?.translations?.[key] ?? key;
}

/** Rebuilds the language selector's options from {@link languages}. */
export function populateLanguageSelect() {
	$("#languageSelect").replaceChildren(
		...Object.values(languages).map((language) => {
			const option = document.createElement("option");
			option.value = language.code;
			option.textContent = language.name;
			return option;
		}),
	);
}
