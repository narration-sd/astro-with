import type { AstroTelemetry } from '@astrojs/telemetry';
import type { AddressInfo } from 'net';
import { performance } from 'perf_hooks';
import * as vite from 'vite';
import type { AstroConfig } from '../../@types/astro';
import {
	runHookConfigDone,
	runHookConfigSetup,
	runHookServerDone,
	runHookServerSetup,
	runHookServerStart,
} from '../../integrations/index.js';
import { createVite } from '../create-vite.js';
import { info, LogOptions, warn } from '../logger/core.js';
import * as msg from '../messages.js';
import { apply as applyPolyfill } from '../polyfill.js';

export interface DevOptions {
	logging: LogOptions;
	telemetry: AstroTelemetry;
}

export interface DevServer {
	address: AddressInfo;
	watcher: vite.FSWatcher;
	stop(): Promise<void>;
}

/** `astro dev` */
export default async function dev(config: AstroConfig, options: DevOptions): Promise<DevServer> {
	const devStart = performance.now();
	applyPolyfill();
	await options.telemetry.record([]);
	config = await runHookConfigSetup({ config, command: 'dev', logging: options.logging });
	const { host, port } = config.server;

	// The client entrypoint for renderers. Since these are imported dynamically
	// we need to tell Vite to preoptimize them.
	const rendererClientEntries = config._ctx.renderers
		.map((r) => r.clientEntrypoint)
		.filter(Boolean) as string[];

	const viteConfig = await createVite(
		{
			mode: 'development',
			server: { host },
			optimizeDeps: {
				include: rendererClientEntries,
			},
		},
		{ astroConfig: config, logging: options.logging, mode: 'dev' }
	);
	await runHookConfigDone({ config, logging: options.logging });
	const viteServer = await vite.createServer(viteConfig);
	runHookServerSetup({ config, server: viteServer, logging: options.logging });
	await viteServer.listen(port);

	const devServerAddressInfo = viteServer.httpServer!.address() as AddressInfo;
	const site = config.site ? new URL(config.base, config.site) : undefined;
	info(
		options.logging,
		null,
		msg.devStart({
			startupTime: performance.now() - devStart,
			config,
			devServerAddressInfo,
			site,
			https: !!viteConfig.server?.https,
		})
	);

	const currentVersion = process.env.PACKAGE_VERSION ?? '0.0.0';
	if (currentVersion.includes('-')) {
		warn(options.logging, null, msg.prerelease({ currentVersion }));
	}
	if (viteConfig.server?.fs?.strict === false) {
		warn(options.logging, null, msg.fsStrictWarning());
	}

	await runHookServerStart({ config, address: devServerAddressInfo, logging: options.logging });

	return {
		address: devServerAddressInfo,
		get watcher() {
			return viteServer.watcher;
		},
		stop: async () => {
			await viteServer.close();
			await runHookServerDone({ config, logging: options.logging });
		},
	};
}
