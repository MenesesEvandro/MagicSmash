/**
 * Icon set for each theme, keyed by theme id. Also the source of truth for
 * which themes exist: code elsewhere treats "is a key of themeIcons" as
 * "is a valid theme".
 */
export const themeIcons = {
	vehicles: ["🚗", "🚚", "🚂", "✈️", "🚁", "🚜", "🚤", "🚑", "🚒"],
	bubbles: ["🫧", "🔵", "🟣", "🩷"],
	music: ["♫", "♪", "🎹", "🥁", "🎸", "🎵"],
	colors: ["🌈", "🎨", "🖍️", "✨", "🟥", "🟡"],
	weather: ["☀️", "🌧️", "⚡", "🌈", "❄️", "☁️"],
	dinosaurs: ["🦕", "🦖", "🌋", "👣", "🌿"],
	farm: ["🐄", "🐴", "🐖", "🐔", "🚜", "🌽"],
	party: ["🎈", "🎉", "🎂", "🎁", "✨"],
	space: ["👽", "🚀", "🪐", "⭐", "🛰️"],
	beach: ["🏖️", "🐚", "🏰", "🥥", "🌊"],
	ocean: ["🐠", "🐳", "🐙", "🐬", "🦈"],
	lights: ["💡", "✨", "🌟", "🟣", "🟡"],
	toys: ["🧸", "⚽", "🧱", "🪀", "🛩️"],
	bedtime: ["🌙", "⭐", "🐑", "☁️", "💤"],
};

/** Translation key for each theme's display name, keyed by theme id. */
export const themeNames = {
	vehicles: "themeVehicles",
	bubbles: "themeBubbles",
	music: "themeMusic",
	colors: "themeColors",
	weather: "themeWeather",
	dinosaurs: "themeDinosaurs",
	farm: "themeFarm",
	party: "themeParty",
	space: "themeSpace",
	beach: "themeBeach",
	ocean: "themeOcean",
	lights: "themeLights",
	toys: "themeToys",
	bedtime: "themeBedtime",
};
