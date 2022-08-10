import type { APIRoute } from 'astro';
import etag from 'etag';
import { lookup } from 'mrmime';
// @ts-ignore
import loader from 'virtual:image-loader';
import { isRemoteImage, loadLocalImage, loadRemoteImage } from '../utils/images.js';

export const get: APIRoute = async ({ request }) => {
	try {
		const url = new URL(request.url);
		const transform = loader.parseTransform(url.searchParams);

		if (!transform) {
			return new Response('Bad Request', { status: 400 });
		}

		let inputBuffer: Buffer | undefined = undefined;

		if (isRemoteImage(transform.src)) {
			inputBuffer = await loadRemoteImage(transform.src);
		} else {
			const clientRoot = new URL('../client/', import.meta.url);
			const localPath = new URL('.' + transform.src, clientRoot);
			inputBuffer = await loadLocalImage(localPath);
		}

		if (!inputBuffer) {
			return new Response(`"${transform.src} not found`, { status: 404 });
		}

		const { data, format } = await loader.transform(inputBuffer, transform);

		return new Response(data, {
			status: 200,
			headers: {
				'Content-Type': lookup(format) || '',
				'Cache-Control': 'public, max-age=31536000',
				ETag: etag(inputBuffer),
				Date: new Date().toUTCString(),
			},
		});
	} catch (err: unknown) {
		return new Response(`Server Error: ${err}`, { status: 500 });
	}
};
