import { h, createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import StaticHtml from './static-html.js';

function check(Component) {
	return !!Component['ssrRender'];
}
console.log('Running server.js, pre-render ')

async function renderToStaticMarkup(Component, props, slotted) {
	console.log('Running servee.js, now in render ')

	const slots = {};
	for (const [key, value] of Object.entries(slotted)) {
		slots[key] = () => h(StaticHtml, { value, name: key === 'default' ? undefined : key });
	}
	const app = createSSRApp({ render: () => h(Component, props, slots) });
	const html = await renderToString(app);
	return { html };
}

export default {
	check,
	renderToStaticMarkup,
};
