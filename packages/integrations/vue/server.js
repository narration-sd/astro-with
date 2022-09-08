import { /*h, */createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import StaticHtml from './static-html.js';
import { doPrepare } from "./src/modules/do-prepare.js";


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

	// console.log('Running server.js, now in render ')
	// const createProper = createSSRApp // *todo* just for the moment to fit translating

	console.log('server.js folder is: ' + process.cwd())

	// // n.b. this folder offset differs between client.js and server.js; different calling points
	// const app = await import ('../../../prepare/vue-prepare.mjs') // this path will be converted in the built
	// 	.catch (err => {
	// 		// note this is not unfound; it's something in the prepare that isn't suiting 
	// 		// the environment where server.js calls it from this time (varies)
	// 		throw new Error ('prepare script found but failed import: ' + err)
	// 	})
	// 	.then (prepare => {
	// 		const createArgs = { h, Component, props, slots };
	// 		// this is what lets our vuetify elements show
	// 		// *todo* but does this make sense now? Revisit on current vuetiry schemes, paths
	// 		props = Object.assign(props, { formatted: true})
	// 		const preparedApp = prepare.default (createProper, createArgs, true, name); // .default because of import()
	// 		console.log ('SERVERJS ABOUT TO RENDER PREPARE-BASED ELEMENT: ' + name)
	// 		return preparedApp
	// 	})
	// 	.catch (err => {
	// 		// *todo* condition logging on what kind of error -- not loading, no, normal?
	// 		console.log('SERVERJS:failed prepare: ' + err)
	// 		console.log('SERVERJS ABOUT TO CREATE OWN ELEMENT for: ' + name)
	// 		const ownApp =  createProper({ render: () => h(Component, props, slots) })
	// 		return ownApp
	// 	})
	// 	.catch(err => {
	// 		throw 'own create error: ' + err
	// 	})
	// 	.then ((theApp) => {
	// 		console.log ('SERVERJS ABOUT TO RENDER ELEMENT for: ' + name)
	// 		return theApp
	// 	})
	// 	.catch(err => {
	// 		throw 'server.js failed: ' + err
	// 	})

	return doPrepare(Component, props, slots, createSSRApp, name)
		.then (async app => {

			console.log('SERVERJS ready to render app...' + app)
			const html = await renderToString(app);
			console.log('rendered html: ' + JSON.stringify(html))
			return {html};
		})
}

export default {
	check,
	renderToStaticMarkup,
};
