import type { EndpointHandler } from '../../../@types/astro';
import type { SSROptions } from '../../render/dev';
import { preload } from '../../render/dev/index.js';
import { call as callEndpoint } from '../index.js';

export async function call(ssrOpts: SSROptions) {
	const [, mod] = await preload(ssrOpts);
	return await callEndpoint(mod as unknown as EndpointHandler, {
		...ssrOpts,
		ssr: ssrOpts.settings.config.output === 'server',
	});
}
