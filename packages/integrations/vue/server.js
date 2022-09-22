import {createApp, createSSRApp, h} from 'vue';
import { renderToString } from 'vue/server-renderer';
import StaticHtml from './static-html.js';
import { doPrepare } from "./src/modules/do-prepare.js";

function check(Component) {
	return !!Component['ssrRender'] || !!Component['__ssrInlineRender'];
}

async function renderToStaticMarkup(Component, props, slotted) {

	// expose name so prepare can use it...
	const name = Component.name ? `${Component.name} Host` : undefined;
	const slots = {};
	for (const [key, value] of Object.entries(slotted)) {
		slots[key] = () => h(StaticHtml, { value, name: key === 'default' ? undefined : key });
	}

	const appOnly = createApp({ name, render: () => h(Component, props, slots) })
	return doPrepare(appOnly, name, false)
		.then (async app => {
			const html = await renderToString(app);
			// console.log('server:rendered html: ' + JSON.stringify(html))
			return { html };
		})
}

export default {
	check,
	renderToStaticMarkup,
};
