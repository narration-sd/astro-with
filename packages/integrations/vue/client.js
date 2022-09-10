import { h, createSSRApp, createApp } from 'vue';
import StaticHtml from './static-html.js';
import { doPrepare } from "./src/modules/do-prepare.js";

export default (element) =>
	(Component, props, slotted, { client }) => {
		delete props['class'];
		if (!element.hasAttribute('ssr')) return;
		
		// a temporary silencer
		// console.log = function(){}

		// Expose name on host component for Vue devtools, and prepare...
		const name = Component.name ? `${Component.name} Host` : undefined;
		const slots = {};
		for (const [key, value] of Object.entries(slotted)) {
			slots[key] = () => h(StaticHtml, { value, name: key === 'default' ? undefined : key });
		}
		
		const createProper = client === 'only'
		  ? createApp
			: createSSRApp
		console.log ('CLIENTJS:HERE:ClientJs:client: ' + client)
		doPrepare(Component, props, slots, createProper, name, true)
			.then (app => {
				app.mount (element)
			})
	};
