/**
 * @param {string} selector CSS selector.
 * @returns {Element | null} First matching element in the document.
 */
export const $ = (selector) => document.querySelector(selector);

/**
 * @param {string} selector CSS selector.
 * @returns {Element[]} All matching elements, as a real array.
 */
export const $$ = (selector) => [...document.querySelectorAll(selector)];
