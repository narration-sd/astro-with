// What we are doing here is allowing an appropriate prepare script to create the
// app, so that it can add its own adjuncts, typically via app.use(). If this fails,
// or if appropriately named no prepare/integration--prepare.mjs script exists on 
// the client, we simply revert to the original creation of the app here. 

// n.b. should you ever change the path, watch out for browser and dev environment caching
// problems. Clear caches, restart both, then do a build-preview run intially, to avoid.

// note that you can't do this, must hard-code the path, as otherwise vite-rollup 
// won't recognize the string asa path, either to include its referred file in 
// the build dist chunks, or to uuid it. 
// 
//     const prepare_file = '../../../prepare/vue-prepare.mjs'
//     import (prepare_file)
//
// The good side of how this does work is that build or running under dev run will 
// fail on missing the prepare, or if you miss-spell its name, giving a hard warning..

// n.b. this folder offset differs between client.js and server.js; different calling points
import {h} from "vue";

const doPrepare = (Component, props, slots, createProper, name) => {
	
	// This is the means that binds client-side prepare scripting to Astro 
	// server use, whether it is in the upload prepared for the client,
	// or in the server itself. Thus it is called by both client.js and server.js
	// There is some amount of finesse involved in getting this to work,
	// and to give suitable use experience, as it runs via esbuild, vite, 
	// and rollup, along the various pathways of dev and build requirements
	// on library modules, vs. their actual conditions in real life npm.
	
	return import ('../../../../../prepare/vue-prepare.mjs')
		// this path will be converted in the built, but requires our monitoring,
		// as many possible errors will not get as far as execution of this promise.
		// It's required that the path be hard-coded, or the build system won't notice
		// its linkage to a real file, and convert with a hashcode, as we require.
		.catch (err => {
			throw new Error ('prepare script not present, by either means: ' + err)
		})
		.then (prepare => {
			const createArgs = { h, Component, props, slots };
			// this is what lets our vuetify elements show
			// *todo* but does this make sense now? Revisit on current vuetiry schemes, paths
			// props = Object.assign(props, { formatted: true})
			return prepare.default (createProper, createArgs, name); // .default because of import()
		})
		// .catch (err => {
		// 	console.log ('CLIENTJS:prepare failed:' + err.stack)
		// 	throw err;
		// })
		.then (app => {
			// console.log (name + ' ABOUT TO MOUNT PREPARE-BASED ELEMENT: ' + name)
			// app.mount(element, false)
			return app
		})
		.catch (err => {
			// *todo* condition logging on what kind of error -- not loading, no, normal?
			console.log(name + ':failed prepare: ' + err)
			console.log('doPrepare ABOUT TO CREATE OWN ELEMENT for: ' + name)
			const app = createProper({ name, render: () => h(Component, props, slots) })
			console.log ('doPrepare ABOUT TO MOUNT OWN ELEMENT: result')
			// app.mount(element, false)
			return app
		})
}

export { doPrepare }
