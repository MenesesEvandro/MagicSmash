import { $ } from "./dom.js";
import { data } from "./state.js";

// languageRegistry is injected by scripts/build.mjs from src/languages/*.json.
export let languages = {};

export function loadLanguages() {
	languages = languageRegistry;
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
