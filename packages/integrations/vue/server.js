import { h, createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import StaticHtml from './static-html.js';

function check(Component) {
	return !!Component['ssrRender'];
}
console.log('Running server.js, pre-render ')

async function renderToStaticMarkup(Component, props, slotted) {

	// expose name so prepare can use it...
	const name = Component.name ? `${Component.name} Host` : undefined;
	const slots = {};
	for (const [key, value] of Object.entries(slotted)) {
		slots[key] = () => h(StaticHtml, { value, name: key === 'default' ? undefined : key });
	}

	console.log('Running servee.js, now in render ')
	const createProper = createSSRApp // *todo* just for the moment to fit

	console.log('server.js folder is: ' + process.cwd())

	// n.b. this folder offset differs between client.js and server.js; different calling points
	const app = await import ('../../../prepare/vue-prepare.mjs') // this path will be converted in the built
		// .catch (err => {
		// 	// may check the err later so as not to try this if unexpected
		// 	console.log('prepare script missed on provided, trying again using local')
		// 	const prepare_file_actual = '../../../prepare/vue-prepare.mjs' // must match, not converted
		// 	return import (prepare_file_actual)
		// })
		.catch (err => {
			throw new Error ('prepare script not present: ' + err)
		})
		.then (prepare => {
			const createArgs = { h, Component, props, slots };
			// this is what lets our vuetify elements show
			// *todo* but does this make sense now? Revisit on current vuetiry schemes, paths
			props = Object.assign(props, { formatted: true})
			return prepare.default (createProper, createArgs, true, name); // .default because of import()
		})
		// .catch (err => {
		// 	console.log ('SERVERJS:prepare failed:' + err.stack)
		// 	throw err;
		// })
		.then (preparedApp => {
			console.log ('SERVERJS ABOUT TO RENDER PREPARE-BASED ELEMENT: ' + name)
			// app.mount(element, false);
			return preparedApp
		})
		.catch (err => {
			// *todo* condition logging on what kind of error -- not loading, no, normal?
			console.log('SERVERJS:failed prepare: ' + err)
			console.log('folder is: ' + process.cwd())
			console.log('SERVERJS ABOUT TO CREATE OWN ELEMENT for: ' + name)
			const ownApp =  createProper({ render: () => h(Component, props, slots) })
			return ownApp
		})
		// .then (async (theApp) => {
		// 	console.log ('SERVERJS ABOUT TO RENDER ELEMENT for: ' + name)
		// 	const html = '<div>my test</div>' //await renderToString(theApp);
		// 	console.log ('html is: ' + html)
		// 	return html;
		// 	// return { html };
		// })
		.then ((theApp) => {
			console.log ('SERVERJS ABOUT TO RENDER ELEMENT for: ' + name)
			return theApp
		})
		.catch(err => {
			throw 'own create error: ' + err
		})
	console.log('uncirc app: ' + app)
// console.log('app: ' + JSON.stringify(app))
	console.log('SERVERJS ready to render app...' + app)
	// const app = createSSRApp({ render: () => h(Component, props, slots) });
	const html = await renderToString(app);
	console.log('rendered html: ' + JSON.stringify(html))
	return { html };
}

export default {
	check,
	renderToStaticMarkup,
};
