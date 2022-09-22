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
		
		let appOnly
		if(client === 'only') {
			appOnly = createApp({ name, render: () => h(Component, props, slots) })
		}
		else {
			appOnly = createSSRApp({ render: () => h(Component, props, slots) })
		}

		doPrepare(appOnly, name, true)
			.then (app => {
				app.mount (element)
			})
	};
