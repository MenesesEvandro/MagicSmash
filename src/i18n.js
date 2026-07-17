import { $ } from "./dom.js";
import { data } from "./state.js";

export let languages = {};

// scripts/build.mjs replaces this token with the contents of
// src/languages/*.json at build time — nothing outside this function ever
// depends on how that value gets here.
export function loadLanguages() {
	languages = __LANGUAGE_REGISTRY__;
}

export function activeLanguage() {
	return (
		languages[data.language] || languages.en || Object.values(languages)[0]
	);
}
export function t(key) {
	return activeLanguage()?.translations?.[key] ?? key;
}

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
