import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import StaticHtml from './static-html.js';
import { doPrepare } from "./src/modules/do-prepare.js";

function check(Component) {
	return !!Component['ssrRender'];
}

async function renderToStaticMarkup(Component, props, slotted) {

	// expose name so prepare can use it...
	const name = Component.name ? `${Component.name} Host` : undefined;
	const slots = {};
	for (const [key, value] of Object.entries(slotted)) {
		slots[key] = () => h(StaticHtml, { value, name: key === 'default' ? undefined : key });
	}

	return doPrepare(Component, props, slots, createSSRApp, name, true)
		.then (async app => {

			console.log('SERVERJS ready to render app...' + app)
			const html = await renderToString(app);
			console.log('rendered html: ' + JSON.stringify(html))
			return { html };
		})
}

export default {
	check,
	renderToStaticMarkup,
};
